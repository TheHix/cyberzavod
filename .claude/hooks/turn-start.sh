#!/usr/bin/env bash
# Хук UserPromptSubmit: начинает ход — запоминает отпечаток кода и обнуляет счётчик попыток
# хука остановки. По отпечатку stop-gate.sh понимает, менял ли агент код именно в этом ходе.
# Нет конфига проекта, `checks` в нём или конфиг битый — хук ничего не запоминает: stop-gate.sh
# в этих случаях отпускает агента без проверок.
#
# Ход начинается, только если отпечатка ещё нет: отчёты сабагентов посреди работы приходят
# тем же событием и не должны сдвигать начало хода. stop-gate.sh удаляет отпечаток, когда
# отпускает агента. Если ход прервали (Stop не вызван), следующий ход наследует и начало
# прерванного хода, и его счётчик попыток: проверка выйдет строже, а попыток может остаться
# меньше трёх. Зацикливания при этом нет.
set -euo pipefail

# Без jq хук не прочитает ни ввод, ни конфиг; stop-gate.sh сообщит об этом при остановке.
command -v jq > /dev/null || exit 0

hooks_dir=$(dirname "$0")
# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$hooks_dir/lib.sh"

session=$(jq -r '.session_id // "unknown"')
cd "${CLAUDE_PROJECT_DIR:-.}"

read_checks || exit 0
[[ -n "$CHECKS_COMMAND" ]] || exit 0

turn_start=$(state_file "$session" turn-start)
if [[ ! -f "$turn_start" ]]; then
  rm -f "$(state_file "$session" stop-blocks)"
  code_fingerprint > "$turn_start"
fi
