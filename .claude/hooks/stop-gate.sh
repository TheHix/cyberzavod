#!/usr/bin/env bash
# Хук Stop: если агент в этом ходе менял код, он не может закончить, пока проверки проекта
# красные. Команду проверок и пути, за которыми следит хук, задаёт `checks` в конфиге проекта.
# Нет конфига или `checks` — агент отпускается без проверок; битый конфиг — отпускается
# с сообщением. Код выхода 2 возвращает агента к работе, а stderr он получает как задание.
# Защита от вечного цикла: после MAX_BLOCKS отказов за ход агент отпускается и зовёт
# человека и оставляет отметку `human-call` для записи сборки; если счётчик не удаётся записать,
# агент тоже отпускается. Счётчик обнуляет turn-start.sh в начале хода, поэтому здесь он только
# растёт; отметку забирает рекордер на следующем промпте человека.
#
# Без set -e: коды проверок и записи файлов разбираются вручную.
set -uo pipefail

# Без jq хук не прочитает ни ввод, ни конфиг, поэтому сообщение собирается без него.
if ! command -v jq > /dev/null; then
  printf '{"systemMessage": "Хук остановки: нет jq — проверки не запускались, агент отпущен."}\n'
  exit 0
fi

readonly MAX_BLOCKS=3
readonly OUTPUT_TAIL_LINES=40
readonly BLOCK_EXIT_CODE=2

hooks_dir=$(dirname "$0")
# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$hooks_dir/lib.sh"

session=$(jq -r '.session_id // "unknown"')

turn_start=$(state_file "$session" turn-start)
counter=$(state_file "$session" stop-blocks)

# Ход закончен: следующий промпт начнёт новый.
release() {
  rm -f "$turn_start" "$counter"
  exit 0
}

release_with_message() {
  jq -n --arg text "$1" '{systemMessage: $text}'
  release
}

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 1

if ! read_checks; then
  release_with_message "Конфиг $PROJECT_CONFIG не читается — проверки пропущены, агент отпущен."
fi
if [[ -z "$CHECKS_COMMAND" ]]; then
  release
fi

# Код в этом ходе не менялся — проверять нечего. Если отпечатка начала хода нет
# (хуки подключились посреди хода), проверяем при любых правках в коде.
if [[ -f "$turn_start" && "$(cat "$turn_start")" == "$(code_fingerprint)" ]]; then
  release
fi
if [[ ! -f "$turn_start" && -z "$(git status --porcelain -- "${CHECKS_PATHS[@]}")" ]]; then
  release
fi

if output=$(bash -c "$CHECKS_COMMAND" 2>&1); then
  release
fi

blocks=$(($(cat "$counter" 2> /dev/null || echo 0) + 1))
if ((blocks > MAX_BLOCKS)); then
  # Отметка нужна рекордеру завода: следующий промпт человека — вызов хуком остановки.
  # Сам хук про рекордер не знает и своё состояние оставляет.
  message="Проверки красные после $MAX_BLOCKS попыток исправить — агент остановлен, нужен человек."
  human_call=$(human_call_marker "$session")
  if ! echo "$blocks" > "$human_call"; then
    message="$message Отметка для записи не сохранена."
  fi
  release_with_message "$message"
fi
if ! echo "$blocks" > "$counter"; then
  release_with_message "Хук остановки не смог записать счётчик попыток ($counter) — проверки красные, агент отпущен без повторов."
fi

{
  echo "$CHECKS_COMMAND не проходит — закончить работу нельзя (попытка $blocks из $MAX_BLOCKS). Исправь:"
  tail -n "$OUTPUT_TAIL_LINES" <<< "$output"
} >&2
exit "$BLOCK_EXIT_CODE"
