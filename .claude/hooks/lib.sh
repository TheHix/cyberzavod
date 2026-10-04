# shellcheck shell=bash
# Общее для хуков turn-start.sh и stop-gate.sh. Подключается через source.

# Каталоги, изменения в которых проверяются перед остановкой агента.
readonly CODE_DIRS=(apps packages)

# Отпечаток кода: текущий коммит, незакоммиченные правки и содержимое новых файлов в CODE_DIRS.
# Коммит входит в отпечаток, чтобы правки, закоммиченные внутри хода, тоже считались изменением.
code_fingerprint() {
  {
    git rev-parse HEAD
    git diff HEAD -- "${CODE_DIRS[@]}"
    git ls-files --others --exclude-standard -z -- "${CODE_DIRS[@]}" | xargs -0 -r shasum
  } | shasum | cut -d' ' -f1
}

# Файл состояния хука для сессии. session_id чистится: он уходит в имя файла.
state_file() {
  local session="$1" name="$2"
  local safe_session
  safe_session=$(tr -cd 'A-Za-z0-9_-' <<< "$session")
  echo "${TMPDIR:-/tmp}/cyberzavod-${name}-${safe_session:-unknown}"
}
