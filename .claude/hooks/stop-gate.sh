#!/usr/bin/env bash
# Хук Stop: если агент в этом ходе менял код, он не может закончить, пока быстрые проверки
# красные. Код выхода 2 возвращает агента к работе, а stderr он получает как задание.
# Защита от вечного цикла: после MAX_BLOCKS отказов за ход агент отпускается и зовёт
# человека; если счётчик не удаётся записать, агент тоже отпускается. Счётчик обнуляет
# turn-start.sh в начале хода, поэтому здесь он только растёт.
#
# Без set -e: коды make и записи файлов разбираются вручную.
set -uo pipefail

readonly MAX_BLOCKS=3
readonly OUTPUT_TAIL_LINES=40
readonly BLOCK_EXIT_CODE=2

hooks_dir=$(dirname "$0")
# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$hooks_dir/lib.sh"

session=$(jq -r '.session_id // "unknown"')
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 1

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

# Код в этом ходе не менялся — проверять нечего. Если отпечатка начала хода нет
# (хуки подключились посреди хода), проверяем при любых правках в коде.
if [[ -f "$turn_start" && "$(cat "$turn_start")" == "$(code_fingerprint)" ]]; then
  release
fi
if [[ ! -f "$turn_start" && -z "$(git status --porcelain -- "${CODE_DIRS[@]}")" ]]; then
  release
fi

if output=$(make check-web check-api 2>&1); then
  release
fi

blocks=$(($(cat "$counter" 2> /dev/null || echo 0) + 1))
if ((blocks > MAX_BLOCKS)); then
  release_with_message "Проверки красные после $MAX_BLOCKS попыток исправить — агент остановлен, нужен человек."
fi
if ! echo "$blocks" > "$counter"; then
  release_with_message "Хук остановки не смог записать счётчик попыток ($counter) — проверки красные, агент отпущен без повторов."
fi

{
  echo "make check-web check-api не проходит — закончить работу нельзя (попытка $blocks из $MAX_BLOCKS). Исправь:"
  tail -n "$OUTPUT_TAIL_LINES" <<< "$output"
} >&2
exit "$BLOCK_EXIT_CODE"
