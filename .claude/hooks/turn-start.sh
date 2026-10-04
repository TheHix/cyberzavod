#!/usr/bin/env bash
# Хук UserPromptSubmit: начинает ход — запоминает отпечаток кода и обнуляет счётчик попыток
# хука остановки. По отпечатку stop-gate.sh понимает, менял ли агент код именно в этом ходе.
#
# Ход начинается, только если отпечатка ещё нет: отчёты сабагентов посреди работы приходят
# тем же событием и не должны сдвигать начало хода. stop-gate.sh удаляет отпечаток, когда
# отпускает агента. Если ход прервали (Stop не вызван), следующий ход наследует и начало
# прерванного хода, и его счётчик попыток: проверка выйдет строже, а попыток может остаться
# меньше трёх. Зацикливания при этом нет.
set -euo pipefail

hooks_dir=$(dirname "$0")
# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$hooks_dir/lib.sh"

session=$(jq -r '.session_id // "unknown"')
cd "${CLAUDE_PROJECT_DIR:-.}"

turn_start=$(state_file "$session" turn-start)
if [[ ! -f "$turn_start" ]]; then
  rm -f "$(state_file "$session" stop-blocks)"
  code_fingerprint > "$turn_start"
fi
