#!/usr/bin/env bash
# Сценарии хуков turn-start.sh и stop-gate.sh на временном git-репозитории с конфигом проекта
# и подставным Makefile.
# Запускается из `make check-scripts`.
set -uo pipefail

HOOKS_DIR=$(cd "$(dirname "$0")" && pwd)
readonly HOOKS_DIR
readonly SESSION=test-session
readonly BLOCKED=2
readonly RELEASED=0
readonly DEFAULT_CONFIG='{"verification": {"commands": ["make check"], "paths": ["apps"]}}'
passed=0
failed=0

# Временный репозиторий с конфигом проекта. Конфиг — необязательный аргумент: пустая строка
# значит «без конфига». По умолчанию проверки — `make check`, он падает, если существует файл
# apps/broken. Файлы самих хуков (вывод, состояние) git не видит, чтобы не попадали в отпечаток.
make_repo() {
  local config="${1-$DEFAULT_CONFIG}" repo
  repo=$(mktemp -d)
  (
    cd "$repo" || exit 1
    git init -q
    mkdir -p apps .cyberzavod
    printf 'check:\n\t@test ! -f apps/broken || (echo "ошибка типов в apps/broken"; exit 1)\n' > Makefile
    echo ok > apps/main.ts
    if [[ -n "$config" ]]; then
      echo "$config" > .cyberzavod/project.json
    fi
    printf 'out\ncyberzavod-*\n' > .git/info/exclude
    git add -A
    git -c user.email=t@t -c user.name=t commit -qm init
  )
  echo "$repo"
}

commit_all() {
  (cd "$1" && git add -A && git -c user.email=t@t -c user.name=t commit -qm change)
}

# Запускает хук как Claude Code: JSON на stdin, папка проекта и TMPDIR — в переменных.
run_hook() {
  local repo="$1" hook="$2"
  jq -n --arg s "$SESSION" '{session_id: $s}' \
    | CLAUDE_PROJECT_DIR="$repo" TMPDIR="$repo" "$HOOKS_DIR/$hook" > "$repo/out" 2>&1
}

# Запускает хук с PATH, где есть только bash (нужен шебангу), — как на машине без jq. Ввод подаётся
# here-string, а не конвейером: без jq хук выходит, не прочитав stdin, и тогда писатель в
# конвейере получает SIGPIPE, а pipefail отдаёт 141 вместо кода хука.
run_hook_without_jq() {
  local repo="$1" hook="$2" tools
  tools=$(mktemp -d)
  ln -s "$(command -v bash)" "$tools/bash"
  CLAUDE_PROJECT_DIR="$repo" TMPDIR="$repo" PATH="$tools" "$HOOKS_DIR/$hook" > "$repo/out" 2>&1 <<< "{\"session_id\": \"$SESSION\"}"
  local code=$?
  rm -rf "$tools"
  return "$code"
}

check() {
  local name="$1" condition="$2"
  if eval "$condition"; then
    passed=$((passed + 1))
  else
    echo "✗ $name" >&2
    failed=$((failed + 1))
  fi
}

test_agent_edits_with_red_checks_block_stop() {
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"

  run_hook "$repo" stop-gate.sh
  code=$?

  check "красные проверки после правок агента держат остановку" "[[ $code -eq $BLOCKED ]] && grep -q 'попытка 1 из 3' '$repo/out'"
  rm -rf "$repo"
}

test_agent_is_released_after_three_blocks() {
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"
  run_hook "$repo" stop-gate.sh
  run_hook "$repo" stop-gate.sh
  run_hook "$repo" stop-gate.sh

  run_hook "$repo" stop-gate.sh
  code=$?

  check "после трёх отказов агент отпускается с сообщением" "[[ $code -eq $RELEASED ]] && grep -q 'нужен человек' '$repo/out'"
  rm -rf "$repo"
}

test_agent_released_after_three_blocks_leaves_human_call_marker() {
  local repo
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"
  for _ in 1 2 3; do run_hook "$repo" stop-gate.sh; done

  run_hook "$repo" stop-gate.sh

  check "оставляет отметку вызова человека после трёх отказов" "[[ -f '$repo/cyberzavod-human-call-$SESSION' ]]"
  rm -rf "$repo"
}

test_unwritable_human_call_marker_is_named_in_message() {
  # На месте файла отметки каталог — записать нельзя; агент всё равно отпускается.
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"
  mkdir "$repo/cyberzavod-human-call-$SESSION"
  for _ in 1 2 3; do run_hook "$repo" stop-gate.sh; done

  run_hook "$repo" stop-gate.sh
  code=$?

  check "без отметки агент отпускается с сообщением о ней" "[[ $code -eq $RELEASED ]] && grep -q 'Отметка для записи не сохранена' '$repo/out'"
  rm -rf "$repo"
}

test_green_checks_leave_no_human_call_marker() {
  local repo
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  echo changed > "$repo/apps/main.ts"

  run_hook "$repo" stop-gate.sh

  check "не оставляет отметку при зелёных проверках" "[[ ! -e '$repo/cyberzavod-human-call-$SESSION' ]]"
  rm -rf "$repo"
}

test_release_without_code_changes_leaves_no_human_call_marker() {
  local repo
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh

  run_hook "$repo" stop-gate.sh

  check "не оставляет отметку при отпуске без изменений кода" "[[ ! -e '$repo/cyberzavod-human-call-$SESSION' ]]"
  rm -rf "$repo"
}

test_block_does_not_leave_human_call_marker() {
  local repo
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"

  run_hook "$repo" stop-gate.sh

  check "не оставляет отметку, пока агента ещё возвращают к работе" "[[ ! -e '$repo/cyberzavod-human-call-$SESSION' ]]"
  rm -rf "$repo"
}

test_new_turn_counts_attempts_again() {
  # Прошлый ход исчерпал попытки и отпустил агента.
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"
  for _ in 1 2 3 4; do run_hook "$repo" stop-gate.sh; done
  run_hook "$repo" turn-start.sh
  echo changed > "$repo/apps/main.ts"

  run_hook "$repo" stop-gate.sh
  code=$?

  check "новый ход считает попытки заново" "[[ $code -eq $BLOCKED ]] && grep -q 'попытка 1 из 3' '$repo/out'"
  rm -rf "$repo"
}

test_work_before_turn_does_not_block() {
  # Чужая незаконченная работа есть ещё до начала хода.
  local repo code
  repo=$(make_repo)
  touch "$repo/apps/broken"
  run_hook "$repo" turn-start.sh

  run_hook "$repo" stop-gate.sh
  code=$?

  check "работа до начала хода не держит агента" "[[ $code -eq $RELEASED ]]"
  rm -rf "$repo"
}

test_commit_inside_turn_is_checked() {
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"
  commit_all "$repo"

  run_hook "$repo" stop-gate.sh
  code=$?

  check "закоммиченные в ходе правки тоже проверяются" "[[ $code -eq $BLOCKED ]]"
  rm -rf "$repo"
}

test_service_message_mid_turn_keeps_turn_start() {
  # Отчёт сабагента посреди хода приходит тем же событием, что и промпт.
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"
  run_hook "$repo" turn-start.sh

  run_hook "$repo" stop-gate.sh
  code=$?

  check "сообщение посреди хода не сдвигает начало хода" "[[ $code -eq $BLOCKED ]]"
  rm -rf "$repo"
}

test_green_checks_release_and_end_turn() {
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  echo changed > "$repo/apps/main.ts"

  run_hook "$repo" stop-gate.sh
  code=$?

  check "зелёные проверки отпускают и завершают ход" \
    "[[ $code -eq $RELEASED && ! -e '$repo/cyberzavod-turn-start-$SESSION' ]]"
  rm -rf "$repo"
}

test_without_turn_start_dirty_red_code_blocks() {
  # Хуки подключились посреди хода — отпечатка начала нет.
  local repo code
  repo=$(make_repo)
  touch "$repo/apps/broken"

  run_hook "$repo" stop-gate.sh
  code=$?

  check "без отпечатка красные правки в коде держат остановку" "[[ $code -eq $BLOCKED ]]"
  rm -rf "$repo"
}

test_unwritable_counter_releases_instead_of_looping() {
  # На месте файла счётчика каталог — записать нельзя.
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"
  mkdir "$repo/cyberzavod-stop-blocks-$SESSION"

  run_hook "$repo" stop-gate.sh
  code=$?

  check "незаписываемый счётчик отпускает, а не зацикливает" "[[ $code -eq $RELEASED ]]"
  rm -rf "$repo"
}

test_checks_command_from_config_runs_and_is_named() {
  local repo code
  repo=$(make_repo '{"verification": {"commands": ["touch checks-ran; exit 1"], "paths": ["apps"]}}')
  run_hook "$repo" turn-start.sh
  echo changed > "$repo/apps/main.ts"

  run_hook "$repo" stop-gate.sh
  code=$?

  check "запускается команда из конфига, и отказ называет её" \
    "[[ $code -eq $BLOCKED && -e '$repo/checks-ran' ]] && grep -q 'touch checks-ran; exit 1 не проходит' '$repo/out'"
  rm -rf "$repo"
}

test_all_verification_commands_run_in_order() {
  local repo code
  repo=$(make_repo '{"verification": {"commands": ["touch first-ran", "touch second-ran; exit 1"]}}')
  run_hook "$repo" turn-start.sh
  echo changed > "$repo/apps/main.ts"

  run_hook "$repo" stop-gate.sh
  code=$?

  check "проверки — все команды по порядку, красная последняя держит агента" \
    "[[ $code -eq $BLOCKED && -e '$repo/first-ran' && -e '$repo/second-ran' ]]"
  rm -rf "$repo"
}

test_edits_outside_paths_do_not_block() {
  local repo code
  repo=$(make_repo '{"verification": {"commands": ["false"], "paths": ["apps"]}}')
  run_hook "$repo" turn-start.sh
  mkdir "$repo/docs"
  echo changed > "$repo/docs/note.md"

  run_hook "$repo" stop-gate.sh
  code=$?

  check "правки вне paths не держат агента" "[[ $code -eq $RELEASED ]]"
  rm -rf "$repo"
}

test_missing_paths_watch_whole_repository() {
  local repo code
  repo=$(make_repo '{"verification": {"commands": ["test ! -f broken"]}}')
  run_hook "$repo" turn-start.sh
  touch "$repo/broken"

  run_hook "$repo" stop-gate.sh
  code=$?

  check "без paths проверяется весь репозиторий" "[[ $code -eq $BLOCKED ]]"
  rm -rf "$repo"
}

test_without_config_agent_is_released() {
  local repo code
  repo=$(make_repo "")
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"

  run_hook "$repo" stop-gate.sh
  code=$?

  check "без конфига агент отпускается молча" "[[ $code -eq $RELEASED && ! -s '$repo/out' ]]"
  rm -rf "$repo"
}

test_without_checks_agent_is_released() {
  local repo code
  repo=$(make_repo '{"id": "test"}')
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"

  run_hook "$repo" stop-gate.sh
  code=$?

  check "без команд проверок агент отпускается молча" "[[ $code -eq $RELEASED && ! -s '$repo/out' ]]"
  rm -rf "$repo"
}

test_broken_config_releases_with_message() {
  local repo code
  repo=$(make_repo '{"verification": ')
  touch "$repo/apps/broken"

  run_hook "$repo" stop-gate.sh
  code=$?

  check "битый конфиг отпускает агента с сообщением" \
    "[[ $code -eq $RELEASED ]] && grep -q 'systemMessage' '$repo/out' && grep -q 'project.json' '$repo/out'"
  rm -rf "$repo"
}

test_turn_start_with_broken_config_remembers_nothing() {
  local repo code
  repo=$(make_repo '{"verification": ')

  run_hook "$repo" turn-start.sh
  code=$?

  check "turn-start с битым конфигом выходит без ошибки и без отпечатка" \
    "[[ $code -eq $RELEASED && ! -e '$repo/cyberzavod-turn-start-$SESSION' ]]"
  rm -rf "$repo"
}

test_turn_start_without_config_remembers_nothing() {
  local repo code
  repo=$(make_repo "")

  run_hook "$repo" turn-start.sh
  code=$?

  check "turn-start без конфига выходит без ошибки и без отпечатка" \
    "[[ $code -eq $RELEASED && ! -e '$repo/cyberzavod-turn-start-$SESSION' ]]"
  rm -rf "$repo"
}

test_turn_start_without_checks_remembers_nothing() {
  local repo code
  repo=$(make_repo '{"id": "test"}')

  run_hook "$repo" turn-start.sh
  code=$?

  check "turn-start без команд проверок выходит без ошибки и без отпечатка" \
    "[[ $code -eq $RELEASED && ! -e '$repo/cyberzavod-turn-start-$SESSION' ]]"
  rm -rf "$repo"
}

test_stop_gate_without_jq_releases_with_message() {
  local repo code
  repo=$(make_repo)
  touch "$repo/apps/broken"

  run_hook_without_jq "$repo" stop-gate.sh
  code=$?

  check "без jq хук остановки отпускает агента с сообщением" \
    "[[ $code -eq $RELEASED ]] && grep -q 'systemMessage' '$repo/out' && grep -q 'нет jq' '$repo/out'"
  rm -rf "$repo"
}

test_turn_start_without_jq_remembers_nothing() {
  local repo code
  repo=$(make_repo)

  run_hook_without_jq "$repo" turn-start.sh
  code=$?

  check "без jq turn-start выходит без ошибки и без отпечатка" \
    "[[ $code -eq $RELEASED && ! -e '$repo/cyberzavod-turn-start-$SESSION' ]]"
  rm -rf "$repo"
}

test_agent_edits_with_red_checks_block_stop
test_agent_is_released_after_three_blocks
test_agent_released_after_three_blocks_leaves_human_call_marker
test_unwritable_human_call_marker_is_named_in_message
test_green_checks_leave_no_human_call_marker
test_release_without_code_changes_leaves_no_human_call_marker
test_block_does_not_leave_human_call_marker
test_new_turn_counts_attempts_again
test_work_before_turn_does_not_block
test_commit_inside_turn_is_checked
test_service_message_mid_turn_keeps_turn_start
test_green_checks_release_and_end_turn
test_without_turn_start_dirty_red_code_blocks
test_unwritable_counter_releases_instead_of_looping
test_checks_command_from_config_runs_and_is_named
test_all_verification_commands_run_in_order
test_edits_outside_paths_do_not_block
test_missing_paths_watch_whole_repository
test_without_config_agent_is_released
test_without_checks_agent_is_released
test_broken_config_releases_with_message
test_turn_start_with_broken_config_remembers_nothing
test_turn_start_without_config_remembers_nothing
test_turn_start_without_checks_remembers_nothing
test_stop_gate_without_jq_releases_with_message
test_turn_start_without_jq_remembers_nothing

if [[ $failed -eq 0 ]]; then
  echo "хуки остановки: $passed сценариев прошли"
fi
exit "$((failed > 0))"
