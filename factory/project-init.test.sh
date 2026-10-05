#!/usr/bin/env bash
# Сценарии project-init.sh на временном заводе с тегами и временном внешнем git-репозитории.
# Запускается из `make check-web`: сценарию хука записи нужны Node и зависимости workspace,
# которых нет в job infra.
set -uo pipefail

FACTORY_SOURCE=$(cd "$(dirname "$0")/.." && pwd)
readonly FACTORY_SOURCE
readonly INIT_SCRIPT="$FACTORY_SOURCE/factory/project-init.sh"
readonly SETTINGS_TEMPLATE="$FACTORY_SOURCE/factory/project-settings.json"
readonly FACTORY_SETTINGS="$FACTORY_SOURCE/.claude/settings.json"
readonly VERSION=0.1.0
readonly PROJECT_ID=demo
readonly SESSION=s
readonly SESSION_START_PAYLOAD='{"session_id":"s","hook_event_name":"SessionStart"}'
readonly HOOKS=(
  .claude/hooks/stop-gate.sh
  .claude/hooks/turn-start.sh
)
# Список набора намеренно записан отдельно от PLAYBOOKS скрипта: тест сверяет скрипт
# с ожидаемым, а не с самим собой. Меняется вместе с ним.
readonly PLAYBOOK_FILES=(
  .claude/agents/analyst.md
  .claude/agents/coder.md
  .claude/agents/tester.md
  .claude/agents/reviewer.md
  .claude/skills/feature/SKILL.md
  .claude/hooks/lib.sh
  "${HOOKS[@]}"
)
passed=0
failed=0

# Все временные каталоги — внутри одного, который удаляется и при падении теста.
WORKDIR=$(mktemp -d)
readonly WORKDIR
trap 'rm -rf "$WORKDIR"' EXIT
# Вывод последнего запуска project-init.sh; читают проверки через says.
readonly OUTPUT="$WORKDIR/output"

# Временный завод: git-репозиторий с файлами набора (в каждом метка с версией), настоящим
# шаблоном настроек и тегом на каждую версию из аргументов. Хуки исполняемые, как в настоящем
# заводе. Symlink packages нужен сценарию рекордера: зависимости рекордера лежат в настоящем
# workspace, а Node ищет их от реального пути скрипта.
make_factory() {
  local factory path version
  factory=$(mktemp -d "$WORKDIR/factory.XXXXXX")
  (
    cd "$factory" || exit 1
    git init -q
    for path in "${PLAYBOOK_FILES[@]}"; do
      mkdir -p "$(dirname "$path")"
      echo "метка $path" > "$path"
    done
    chmod +x "${HOOKS[@]}"
    mkdir factory
    cp "$SETTINGS_TEMPLATE" factory/project-settings.json
    git add -A
    git -c user.email=t@t -c user.name=t commit -qm init
    for version in "$@"; do
      git tag "factory-v$version"
    done
    ln -s "$FACTORY_SOURCE/packages" packages
  )
  echo "$factory"
}

# Внешний репозиторий проекта: пустой, с одним коммитом. Имя каталога — необязательный аргумент.
make_project() {
  local project
  project=$(mktemp -d "$WORKDIR/${1:-project}.XXXXXX")
  (
    cd "$project" || exit 1
    git init -q
    git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
  )
  echo "$project"
}

# Корень и содержимое каталога без .git: по нему видно, что скрипт ничего не менял.
snapshot() {
  (
    cd "$1" || exit 1
    find . -path ./.git -prune -o -print | sort
    find . -path ./.git -prune -o -type f -exec cksum {} + | sort
  )
}

run_init() {
  "$INIT_SCRIPT" "$@" > "$OUTPUT" 2>&1
}

says() {
  grep -qF -- "$1" "${2:-$OUTPUT}"
}

# Запускает команду хука как Claude Code: через sh, JSON события на stdin.
run_session_start_hook() {
  local project="$1" factory_home="$2" command
  command=$(jq -r '.hooks.SessionStart[0].hooks[0].command' "$project/.claude/settings.json")
  printf '%s' "$SESSION_START_PAYLOAD" \
    | CLAUDE_PROJECT_DIR="$project" CYBERZAVOD_HOME="$factory_home" sh -c "$command"
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

test_installs_playbooks_config_and_settings() {
  local factory project code path missing_files="" not_executable=""
  factory=$(make_factory "$VERSION")
  project=$(make_project)

  run_init "$factory" "$project" "$PROJECT_ID" "$VERSION"
  code=$?

  for path in "${PLAYBOOK_FILES[@]}"; do
    [[ -f "$project/$path" ]] || missing_files="$missing_files $path"
  done
  for path in "${HOOKS[@]}"; do
    [[ -x "$project/$path" ]] || not_executable="$not_executable $path"
  done
  check "команда завершается успешно" "[[ $code -eq 0 ]]"
  check "файлы набора на месте:$missing_files" "[[ -z '$missing_files' ]]"
  check "хуки исполняемые:$not_executable" "[[ -z '$not_executable' ]]"
  check "project.json содержит ровно id и factory" \
    "jq -e --arg id '$PROJECT_ID' --arg v '$VERSION' '. == {id: \$id, factory: \$v}' '$project/.cyberzavod/project.json' > /dev/null"
  check "settings.json совпадает с шаблоном" "cmp -s '$SETTINGS_TEMPLATE' '$project/.claude/settings.json'"
}

test_playbooks_come_from_tag_not_working_copy() {
  local factory project agent=.claude/agents/coder.md
  factory=$(make_factory "$VERSION")
  project=$(make_project)
  echo "правка после тега" > "$factory/$agent"

  run_init "$factory" "$project" "$PROJECT_ID" "$VERSION"

  check "файл набора взят из тега" "[[ \$(cat '$project/$agent') == 'метка $agent' ]]"
}

test_without_version_takes_highest_tag() {
  local factory project
  factory=$(make_factory 0.10.0 0.9.0)
  project=$(make_project)

  run_init "$factory" "$project" "$PROJECT_ID"

  check "0.10.0 старше 0.9.0" "[[ \$(jq -r .factory '$project/.cyberzavod/project.json') == 0.10.0 ]]"
}

test_unknown_version_refuses_and_writes_nothing() {
  local factory project code factory_before project_before
  factory=$(make_factory "$VERSION")
  project=$(make_project)
  factory_before=$(snapshot "$factory")
  project_before=$(snapshot "$project")

  run_init "$factory" "$project" "$PROJECT_ID" 9.9.9
  code=$?

  check "версия без тега — отказ с именем тега" "[[ $code -ne 0 ]] && says factory-v9.9.9"
  check "проект и завод не тронуты" \
    "[[ \$(snapshot '$factory') == '$factory_before' && \$(snapshot '$project') == '$project_before' ]]"
}

test_version_that_is_a_revision_expression_refuses() {
  # Тег стоит на втором коммите: `0.2.0~1` указал бы на первый, а `0.2.0^{}` — на сам коммит.
  local factory project expression code
  factory=$(make_factory "$VERSION")
  git -C "$factory" -c user.email=t@t -c user.name=t commit -q --allow-empty -m second
  git -C "$factory" tag factory-v0.2.0
  project=$(make_project)

  for expression in '0.2.0~1' '0.2.0^{}'; do
    run_init "$factory" "$project" "$PROJECT_ID" "$expression"
    code=$?

    check "версия $expression — не тег, отказ" \
      "[[ $code -ne 0 && ! -e '$project/.cyberzavod' && ! -e '$factory/projects' ]] && says 'нет тега'"
  done
}

test_factory_without_tags_refuses() {
  local factory project code
  factory=$(make_factory)
  project=$(make_project)

  run_init "$factory" "$project" "$PROJECT_ID"
  code=$?

  check "завод без тегов — отказ" "[[ $code -ne 0 && ! -e '$project/.cyberzavod' ]] && says factory-v"
}

test_tag_without_playbook_file_refuses() {
  local factory project code
  factory=$(make_factory)
  git -C "$factory" rm -q .claude/agents/tester.md
  git -C "$factory" -c user.email=t@t -c user.name=t commit -qm "без тестировщика"
  git -C "$factory" tag "factory-v$VERSION"
  project=$(make_project)

  run_init "$factory" "$project" "$PROJECT_ID" "$VERSION"
  code=$?

  check "в теге нет файла набора — отказ с его именем" \
    "[[ $code -ne 0 && ! -e '$project/.claude' ]] && says tester.md"
}

test_second_run_refuses_and_changes_nothing() {
  local factory project code factory_before project_before
  factory=$(make_factory "$VERSION")
  project=$(make_project)
  run_init "$factory" "$project" "$PROJECT_ID" "$VERSION"
  factory_before=$(snapshot "$factory")
  project_before=$(snapshot "$project")

  run_init "$factory" "$project" "$PROJECT_ID" "$VERSION"
  code=$?

  check "повторный запуск — отказ с перечнем путей" \
    "[[ $code -ne 0 ]] && says .cyberzavod && says .claude/settings.json && says projects/$PROJECT_ID.json"
  check "повторный запуск ничего не меняет" \
    "[[ \$(snapshot '$factory') == '$factory_before' && \$(snapshot '$project') == '$project_before' ]]"
}

test_refusal_lists_all_playbook_files_and_quotes_paths() {
  local factory project path missing_files=""
  factory=$(make_factory "$VERSION")
  project=$(make_project "p dir")
  run_init "$factory" "$project" "$PROJECT_ID" "$VERSION"

  run_init "$factory" "$project" "$PROJECT_ID" "$VERSION"

  # Пути набора есть и в перечне конфликтов, поэтому ищем их только в самой команде.
  grep -F archive "$OUTPUT" > "$WORKDIR/archive-command"
  for path in "${PLAYBOOK_FILES[@]}"; do
    says "$path" "$WORKDIR/archive-command" || missing_files="$missing_files $path"
  done
  check "команда archive называет все файлы набора:$missing_files" "[[ -z '$missing_files' ]]"
  check "каталог с пробелом экранирован в команде" "says 'p\\ dir'"
  check "набор распаковывается во временный каталог" "says 'tar -x -C \"\$staging\"'"
}

test_existing_settings_refuses_before_any_write() {
  local factory project code
  factory=$(make_factory "$VERSION")
  project=$(make_project)
  mkdir "$project/.claude"
  echo '{}' > "$project/.claude/settings.json"

  run_init "$factory" "$project" "$PROJECT_ID" "$VERSION"
  code=$?

  check "готовый settings.json — отказ с его путём" "[[ $code -ne 0 ]] && says .claude/settings.json"
  check "ничего не создано" \
    "[[ ! -e '$project/.cyberzavod' && ! -e '$project/.claude/agents' && ! -e '$factory/projects' ]]"
  check "settings.json не изменён" "[[ \$(cat '$project/.claude/settings.json') == '{}' ]]"
}

test_existing_card_refuses() {
  local factory project code
  factory=$(make_factory "$VERSION")
  project=$(make_project)
  mkdir "$factory/projects"
  echo '{}' > "$factory/projects/$PROJECT_ID.json"

  run_init "$factory" "$project" "$PROJECT_ID" "$VERSION"
  code=$?

  check "карточка уже есть — отказ с её путём" "[[ $code -ne 0 ]] && says projects/$PROJECT_ID.json"
  check "проект не тронут, карточка не изменена" \
    "[[ ! -e '$project/.cyberzavod' && ! -e '$project/.claude' && \$(cat '$factory/projects/$PROJECT_ID.json') == '{}' ]]"
}

test_directory_that_is_not_repository_root_refuses() {
  local factory project code
  factory=$(make_factory "$VERSION")
  project=$(make_project)
  mkdir "$project/sub"

  run_init "$factory" "$project/sub" "$PROJECT_ID" "$VERSION"
  code=$?

  check "подкаталог репозитория — отказ" \
    "[[ $code -ne 0 && ! -e '$project/sub/.cyberzavod' && ! -e '$factory/projects' ]] && says 'не корень'"
}

test_invalid_id_refuses() {
  local factory project code
  factory=$(make_factory "$VERSION")
  project=$(make_project)

  run_init "$factory" "$project" a/b "$VERSION"
  code=$?

  check "ID с косой чертой — отказ" \
    "[[ $code -ne 0 && ! -e '$project/.cyberzavod' && ! -e '$factory/projects' ]] && says a/b"
}

test_missing_arguments_print_usage() {
  local factory code
  factory=$(make_factory "$VERSION")

  run_init "$factory"
  code=$?

  check "без DIR и ID — использование" "[[ $code -ne 0 ]] && says Использование"
}

test_card_has_id_name_and_single_line_description() {
  local factory project card
  factory=$(make_factory "$VERSION")
  project=$(make_project)
  card="$factory/projects/$PROJECT_ID.json"

  run_init "$factory" "$project" "$PROJECT_ID" "$VERSION"

  check "id карточки — ID проекта" "[[ \$(jq -r .id '$card') == '$PROJECT_ID' ]]"
  check "name карточки — ID проекта" "[[ \$(jq -r .name '$card') == '$PROJECT_ID' ]]"
  check "description непустая и в одну строку" \
    "jq -e '.description | type == \"string\" and length > 0 and (contains(\"\\n\") | not)' '$card' > /dev/null"
}

test_template_records_same_events_as_factory_settings() {
  local recorder_events='.hooks | to_entries[] | select(any(.value[].hooks[]; .command | contains("record.ts"))) | .key'

  check "события рекордера в шаблоне те же, что у завода" \
    "[[ \$(jq -r '$recorder_events' '$SETTINGS_TEMPLATE' | sort) == \$(jq -r '$recorder_events' '$FACTORY_SETTINGS' | sort) ]]"
  check "format-go.sh в шаблоне нет" "! grep -q format-go.sh '$SETTINGS_TEMPLATE'"
}

test_session_start_hook_writes_project_and_factory() {
  local factory project journal code
  factory=$(make_factory "$VERSION")
  project=$(make_project)
  run_init "$factory" "$project" "$PROJECT_ID" "$VERSION"
  journal="$factory/recordings/raw/$SESSION.jsonl"

  run_session_start_hook "$project" "$factory"
  code=$?

  check "хук записи завершается успешно" "[[ $code -eq 0 ]]"
  check "session_start несёт проект и версию завода" \
    "jq -e --arg id '$PROJECT_ID' --arg v '$VERSION' 'select(.kind == \"session_start\" and .project == \$id and .factory == \$v)' '$journal' > /dev/null"
}

test_session_start_hook_without_factory_home_writes_nothing() {
  local factory project command code
  factory=$(make_factory "$VERSION")
  project=$(make_project)
  run_init "$factory" "$project" "$PROJECT_ID" "$VERSION"
  command=$(jq -r '.hooks.SessionStart[0].hooks[0].command' "$project/.claude/settings.json")

  printf '%s' "$SESSION_START_PAYLOAD" | env -u CYBERZAVOD_HOME CLAUDE_PROJECT_DIR="$project" sh -c "$command"
  code=$?

  check "без CYBERZAVOD_HOME хук выходит с кодом 0" "[[ $code -eq 0 ]]"
  check "без CYBERZAVOD_HOME журнала нет" "[[ ! -e '$factory/recordings' && ! -e '$project/recordings' ]]"
}

test_summary_names_what_is_left_to_do() {
  local factory project
  factory=$(make_factory "$VERSION")
  project=$(make_project)

  run_init "$factory" "$project" "$PROJECT_ID" "$VERSION"

  check "вывод называет CYBERZAVOD_HOME" "says CYBERZAVOD_HOME"
  check "вывод называет checks" "says checks"
  check "вывод называет CLAUDE.md" "says CLAUDE.md"
  check "вывод называет карточку" "says projects/$PROJECT_ID.json"
}

test_installs_playbooks_config_and_settings
test_playbooks_come_from_tag_not_working_copy
test_without_version_takes_highest_tag
test_unknown_version_refuses_and_writes_nothing
test_version_that_is_a_revision_expression_refuses
test_factory_without_tags_refuses
test_tag_without_playbook_file_refuses
test_second_run_refuses_and_changes_nothing
test_refusal_lists_all_playbook_files_and_quotes_paths
test_existing_settings_refuses_before_any_write
test_existing_card_refuses
test_directory_that_is_not_repository_root_refuses
test_invalid_id_refuses
test_missing_arguments_print_usage
test_card_has_id_name_and_single_line_description
test_template_records_same_events_as_factory_settings
test_session_start_hook_writes_project_and_factory
test_session_start_hook_without_factory_home_writes_nothing
test_summary_names_what_is_left_to_do

if [[ $failed -eq 0 ]]; then
  echo "подключение проектов: прошло проверок — $passed"
fi
exit "$((failed > 0))"
