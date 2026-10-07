# shellcheck shell=bash
# Общее для хуков turn-start.sh и stop-gate.sh. Подключается через source.

# Конфиг проекта относительно его корня; проверки перед остановкой описаны в его `checks`.
readonly PROJECT_CONFIG=".cyberzavod/project.json"

# Проверять весь репозиторий, если в `checks` не заданы пути.
readonly WHOLE_REPOSITORY=.

# Заполняются read_checks: команда проверок и пути, изменения в которых её запускают.
CHECKS_COMMAND=""
CHECKS_PATHS=()

# Читает `checks` из конфига проекта в CHECKS_COMMAND и CHECKS_PATHS. Нет файла или команды —
# команда пустая, и вызывающий хук ничего не проверяет. Битый конфиг — код 1.
read_checks() {
  local paths path
  CHECKS_COMMAND=""
  CHECKS_PATHS=()
  [[ -f "$PROJECT_CONFIG" ]] || return 0
  CHECKS_COMMAND=$(jq -r '.checks.command // empty' "$PROJECT_CONFIG") || return 1
  [[ -n "$CHECKS_COMMAND" ]] || return 0
  paths=$(jq -r '.checks.paths // [] | .[]' "$PROJECT_CONFIG") || return 1
  while IFS= read -r path; do
    [[ -z "$path" ]] || CHECKS_PATHS+=("$path")
  done <<< "$paths"
  if ((${#CHECKS_PATHS[@]} == 0)); then
    CHECKS_PATHS=("$WHOLE_REPOSITORY")
  fi
}

# Отпечаток кода: текущий коммит, незакоммиченные правки и содержимое новых файлов в CHECKS_PATHS.
# Коммит входит в отпечаток, чтобы правки, закоммиченные внутри хода, тоже считались изменением.
code_fingerprint() {
  {
    git rev-parse HEAD
    git diff HEAD -- "${CHECKS_PATHS[@]}"
    git ls-files --others --exclude-standard -z -- "${CHECKS_PATHS[@]}" | xargs -0 -r shasum
  } | shasum | cut -d' ' -f1
}

# Файл состояния хука для сессии. session_id чистится: он уходит в имя файла.
state_file() {
  local session="$1" name="$2"
  local safe_session
  safe_session=$(tr -cd 'A-Za-z0-9_-' <<< "$session")
  echo "${TMPDIR:-/tmp}/factory-${name}-${safe_session:-unknown}"
}

# Отметка «хук остановки сдался и позвал человека»: её читает рекордер завода, поэтому имя
# `human-call` общее для хука и рекордера.
human_call_marker() {
  state_file "$1" human-call
}
