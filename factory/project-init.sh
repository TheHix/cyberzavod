#!/usr/bin/env bash
# Подключает внешний git-репозиторий к заводу: копирует из тега `factory-v<версия>` набор
# playbooks (агенты, скилл, хуки остановки), ставит хуки записи и остановки, заводит
# `.cyberzavod/project.json` и заготовку карточки проекта в заводе.
#
# Набор берётся из тега, а не из рабочей копии: проект получает выпущенную версию, и в записи
# сборки по `factory` видно, какой набор работал. Все проверки идут до первой записи: при отказе
# ничего не создано и скрипт можно запустить заново. Уже подключённый проект скрипт не
# обновляет: любой конфликт — отказ с перечнем путей.
#
# Вызов: project-init.sh <завод> <DIR> <ID> [VERSION]. Завод — аргументом, а не по расположению
# скрипта, чтобы тест подставлял временный завод.
set -euo pipefail

# Набор playbooks; список продублирован в разделе «Playbooks завода» корневого CLAUDE.md,
# меняется в обоих местах.
readonly PLAYBOOKS=(
  .claude/agents/analyst.md
  .claude/agents/coder.md
  .claude/agents/tester.md
  .claude/agents/reviewer.md
  .claude/skills/feature/SKILL.md
  .claude/hooks/stop-gate.sh
  .claude/hooks/turn-start.sh
  .claude/hooks/lib.sh
)
readonly SETTINGS_TEMPLATE=factory/project-settings.json
readonly TAG_PREFIX=factory-v
readonly ID_PATTERN='^[A-Za-z0-9_-]+$'
readonly PROJECT_SETTINGS=.claude/settings.json
readonly PROJECT_CONFIG=.cyberzavod/project.json
readonly CARDS_DIR=projects
readonly CARD_DESCRIPTION_PLACEHOLDER="Описание проекта ещё не заполнено."

# Заполняются по ходу проверок: read_arguments, resolve_version, check_target_is_repository_root.
FACTORY_DIR=""
TARGET_DIR=""
PROJECT_ID=""
REQUESTED_VERSION=""
FACTORY_TAG=""
FACTORY_VERSION=""

fail() {
  echo "project-init: $1" >&2
  exit 1
}

usage() {
  echo "Использование: project-init.sh <завод> <DIR> <ID> [VERSION]" >&2
  echo "  DIR — корень git-репозитория проекта, ID — идентификатор проекта (буквы, цифры, - и _)," >&2
  echo "  VERSION — версия завода (по умолчанию старшая из тегов $TAG_PREFIX*)." >&2
  exit 1
}

require_tools() {
  local tool
  for tool in git jq tar; do
    command -v "$tool" > /dev/null || fail "нужен $tool, а его нет в PATH"
  done
}

read_arguments() {
  (($# >= 3 && $# <= 4)) || usage
  [[ -n "$1" && -n "$2" && -n "$3" ]] || usage
  FACTORY_DIR=$(cd "$1" 2> /dev/null && pwd -P) || fail "нет каталога завода: $1"
  git -C "$FACTORY_DIR" rev-parse --git-dir > /dev/null 2>&1 || fail "завод не git-репозиторий: $FACTORY_DIR"
  TARGET_DIR="$2"
  PROJECT_ID="$3"
  REQUESTED_VERSION="${4:-}"
}

check_id() {
  [[ "$PROJECT_ID" =~ $ID_PATTERN ]] || fail "недопустимый ID «$PROJECT_ID»: нужны латинские буквы, цифры, - и _"
}

# Без VERSION берётся старшая версия по номеру, а не по алфавиту: 0.10.0 новее 0.9.0.
resolve_version() {
  if [[ -n "$REQUESTED_VERSION" ]]; then
    FACTORY_TAG="$TAG_PREFIX$REQUESTED_VERSION"
    # show-ref принимает только точное имя ссылки; rev-parse пропустил бы выражения вроде
    # `0.1.0~1` и записал бы в проект версию, которой нет.
    git -C "$FACTORY_DIR" show-ref --verify --quiet "refs/tags/$FACTORY_TAG" \
      || fail "в заводе нет тега $FACTORY_TAG"
  else
    FACTORY_TAG=$(git -C "$FACTORY_DIR" tag --list "$TAG_PREFIX*" --sort=-v:refname | sed -n 1p)
    [[ -n "$FACTORY_TAG" ]] || fail "в заводе нет тегов $TAG_PREFIX*: выпустите версию тегом ${TAG_PREFIX}X.Y.Z"
  fi
  FACTORY_VERSION="${FACTORY_TAG#"$TAG_PREFIX"}"
}

check_tag_contents() {
  local path missing=""
  for path in "${PLAYBOOKS[@]}" "$SETTINGS_TEMPLATE"; do
    git -C "$FACTORY_DIR" cat-file -e "$FACTORY_TAG:$path" 2> /dev/null || missing="$missing $path"
  done
  [[ -z "$missing" ]] || fail "в теге $FACTORY_TAG нет файлов набора:$missing"
}

check_target_is_repository_root() {
  local expected toplevel
  [[ -d "$TARGET_DIR" ]] || fail "нет каталога проекта: $TARGET_DIR"
  expected=$(cd "$TARGET_DIR" && pwd -P)
  toplevel=$(git -C "$expected" rev-parse --show-toplevel 2> /dev/null) \
    || fail "$expected не git-репозиторий"
  [[ "$toplevel" == "$expected" ]] || fail "$expected не корень git-репозитория (корень — $toplevel)"
  TARGET_DIR="$expected"
}

card_path() {
  echo "$FACTORY_DIR/$CARDS_DIR/$PROJECT_ID.json"
}

exists() {
  [[ -e "$1" || -L "$1" ]]
}

# Команды печатаются с экранированием путей: каталог проекта или завода может быть с пробелами.
# Набор распаковывается во временный каталог, чтобы не перезаписать файлы, из-за которых отказ.
print_manual_transfer() {
  local factory tag template target playbooks
  printf -v factory '%q' "$FACTORY_DIR"
  printf -v tag '%q' "$FACTORY_TAG"
  printf -v template '%q' "$FACTORY_TAG:$SETTINGS_TEMPLATE"
  printf -v target '%q' "$TARGET_DIR"
  printf -v playbooks '%q ' "${PLAYBOOKS[@]}"
  echo "Перенесите нужное руками, ничего не перезаписывая:" >&2
  echo "  набор — во временный каталог, оттуда в $target только недостающие файлы:" >&2
  echo "    staging=\$(mktemp -d) && git -C $factory archive $tag -- $playbooks| tar -x -C \"\$staging\"" >&2
  echo "  хуки в .claude/settings.json — слить из: git -C $factory show $template" >&2
  echo "  $PROJECT_CONFIG — {\"id\": \"$PROJECT_ID\", \"factory\": \"$FACTORY_VERSION\"}" >&2
  echo "  карточка проекта — $CARDS_DIR/$PROJECT_ID.json в заводе" >&2
}

check_no_conflicts() {
  local path conflicts=""
  for path in .cyberzavod "$PROJECT_SETTINGS" "${PLAYBOOKS[@]}"; do
    ! exists "$TARGET_DIR/$path" || conflicts="$conflicts  $TARGET_DIR/$path"$'\n'
  done
  ! exists "$(card_path)" || conflicts="$conflicts  $(card_path)"$'\n'
  [[ -n "$conflicts" ]] || return 0
  echo "project-init: уже есть, ничего не изменено:" >&2
  printf '%s' "$conflicts" >&2
  print_manual_transfer
  exit 1
}

install_playbooks() {
  git -C "$FACTORY_DIR" archive "$FACTORY_TAG" -- "${PLAYBOOKS[@]}" | tar -x -C "$TARGET_DIR"
}

install_settings() {
  git -C "$FACTORY_DIR" show "$FACTORY_TAG:$SETTINGS_TEMPLATE" > "$TARGET_DIR/$PROJECT_SETTINGS"
}

write_project_config() {
  mkdir -p "$TARGET_DIR/.cyberzavod"
  jq -n --arg id "$PROJECT_ID" --arg factory "$FACTORY_VERSION" '{id: $id, factory: $factory}' \
    > "$TARGET_DIR/$PROJECT_CONFIG"
}

write_card() {
  mkdir -p "$FACTORY_DIR/$CARDS_DIR"
  jq -n --arg id "$PROJECT_ID" --arg description "$CARD_DESCRIPTION_PLACEHOLDER" \
    '{id: $id, name: $id, description: $description}' > "$(card_path)"
}

print_next_steps() {
  cat << REPORT
Проект $PROJECT_ID подключён к заводу, версия $FACTORY_VERSION.

Осталось сделать вам:
  1. Создайте $TARGET_DIR/.claude/settings.local.json и не коммитьте его (добавьте в .gitignore проекта):
       {"env": {"CYBERZAVOD_HOME": "$FACTORY_DIR"}}
  2. Заполните checks в $TARGET_DIR/$PROJECT_CONFIG: команду проверок и каталоги с кодом.
  3. Напишите CLAUDE.md проекта: команды форматирования, быстрых и полных проверок, правила кода
     и тестов (см. «Playbooks завода» в CLAUDE.md завода).
  4. Заполните description, repo, website в $(card_path) и закоммитьте карточку в заводе.
REPORT
}

main() {
  require_tools
  read_arguments "$@"
  check_id
  resolve_version
  check_tag_contents
  check_target_is_repository_root
  check_no_conflicts
  install_playbooks
  install_settings
  write_project_config
  write_card
  print_next_steps
}

main "$@"
