#!/usr/bin/env bash
# Сценарии хуков turn-start.sh и stop-gate.sh на временном git-репозитории с подставным Makefile.
# Запускается из `make check-deploy`.
set -uo pipefail

HOOKS_DIR=$(cd "$(dirname "$0")" && pwd)
readonly HOOKS_DIR
readonly SESSION=test-session
readonly BLOCKED=2
readonly RELEASED=0
passed=0
failed=0

# Временный репозиторий: check-web падает, если существует файл apps/broken.
make_repo() {
  local repo
  repo=$(mktemp -d)
  (
    cd "$repo" || exit 1
    git init -q
    mkdir -p apps
    printf 'check-web:\n\t@test ! -f apps/broken || (echo "ошибка типов в apps/broken"; exit 1)\ncheck-api:\n\t@true\n' > Makefile
    echo ok > apps/main.ts
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
  # Arrange
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"

  # Act
  run_hook "$repo" stop-gate.sh
  code=$?

  # Assert
  check "красные проверки после правок агента держат остановку" "[[ $code -eq $BLOCKED ]] && grep -q 'попытка 1 из 3' '$repo/out'"
  rm -rf "$repo"
}

test_agent_is_released_after_three_blocks() {
  # Arrange
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"
  run_hook "$repo" stop-gate.sh
  run_hook "$repo" stop-gate.sh
  run_hook "$repo" stop-gate.sh

  # Act
  run_hook "$repo" stop-gate.sh
  code=$?

  # Assert
  check "после трёх отказов агент отпускается с сообщением" "[[ $code -eq $RELEASED ]] && grep -q 'нужен человек' '$repo/out'"
  rm -rf "$repo"
}

test_new_turn_counts_attempts_again() {
  # Arrange: прошлый ход исчерпал попытки и отпустил агента
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"
  for _ in 1 2 3 4; do run_hook "$repo" stop-gate.sh; done
  run_hook "$repo" turn-start.sh
  echo changed > "$repo/apps/main.ts"

  # Act
  run_hook "$repo" stop-gate.sh
  code=$?

  # Assert
  check "новый ход считает попытки заново" "[[ $code -eq $BLOCKED ]] && grep -q 'попытка 1 из 3' '$repo/out'"
  rm -rf "$repo"
}

test_work_before_turn_does_not_block() {
  # Arrange: чужая незаконченная работа есть ещё до начала хода
  local repo code
  repo=$(make_repo)
  touch "$repo/apps/broken"
  run_hook "$repo" turn-start.sh

  # Act
  run_hook "$repo" stop-gate.sh
  code=$?

  # Assert
  check "работа до начала хода не держит агента" "[[ $code -eq $RELEASED ]]"
  rm -rf "$repo"
}

test_commit_inside_turn_is_checked() {
  # Arrange
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"
  commit_all "$repo"

  # Act
  run_hook "$repo" stop-gate.sh
  code=$?

  # Assert
  check "закоммиченные в ходе правки тоже проверяются" "[[ $code -eq $BLOCKED ]]"
  rm -rf "$repo"
}

test_service_message_mid_turn_keeps_turn_start() {
  # Arrange: отчёт сабагента посреди хода приходит тем же событием, что и промпт
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"
  run_hook "$repo" turn-start.sh

  # Act
  run_hook "$repo" stop-gate.sh
  code=$?

  # Assert
  check "сообщение посреди хода не сдвигает начало хода" "[[ $code -eq $BLOCKED ]]"
  rm -rf "$repo"
}

test_green_checks_release_and_end_turn() {
  # Arrange
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  echo changed > "$repo/apps/main.ts"

  # Act
  run_hook "$repo" stop-gate.sh
  code=$?

  # Assert
  check "зелёные проверки отпускают и завершают ход" \
    "[[ $code -eq $RELEASED && ! -e '$repo/cyberzavod-turn-start-$SESSION' ]]"
  rm -rf "$repo"
}

test_without_turn_start_dirty_red_code_blocks() {
  # Arrange: хуки подключились посреди хода — отпечатка начала нет
  local repo code
  repo=$(make_repo)
  touch "$repo/apps/broken"

  # Act
  run_hook "$repo" stop-gate.sh
  code=$?

  # Assert
  check "без отпечатка красные правки в коде держат остановку" "[[ $code -eq $BLOCKED ]]"
  rm -rf "$repo"
}

test_unwritable_counter_releases_instead_of_looping() {
  # Arrange: на месте файла счётчика каталог — записать нельзя
  local repo code
  repo=$(make_repo)
  run_hook "$repo" turn-start.sh
  touch "$repo/apps/broken"
  mkdir "$repo/cyberzavod-stop-blocks-$SESSION"

  # Act
  run_hook "$repo" stop-gate.sh
  code=$?

  # Assert
  check "незаписываемый счётчик отпускает, а не зацикливает" "[[ $code -eq $RELEASED ]]"
  rm -rf "$repo"
}

test_agent_edits_with_red_checks_block_stop
test_agent_is_released_after_three_blocks
test_new_turn_counts_attempts_again
test_work_before_turn_does_not_block
test_commit_inside_turn_is_checked
test_service_message_mid_turn_keeps_turn_start
test_green_checks_release_and_end_turn
test_without_turn_start_dirty_red_code_blocks
test_unwritable_counter_releases_instead_of_looping

if [[ $failed -eq 0 ]]; then
  echo "хуки остановки: $passed сценариев прошли"
fi
exit "$((failed > 0))"
