#!/usr/bin/env bash
# Хук PostToolUse: Go-файл после правки агентом приводится к стилю проекта — gofumpt
# и goimports через golangci-lint fmt, как в make check-api. Без этого правка проходила бы
# хук, но валила проверку в stop-gate и отнимала у агента попытку.
#
# Синтаксис проверяется отдельно через gofmt -e: golangci-lint fmt на сломанном файле
# только предупреждает и выходит с кодом 0, а агенту надо узнать об ошибке сразу.
set -uo pipefail

readonly SHOW_TO_AGENT_EXIT_CODE=2
readonly SHOW_TO_USER_EXIT_CODE=1

file=$(jq -r '.tool_input.file_path // empty')
if [[ "$file" != *.go || ! -f "$file" ]]; then
  exit 0
fi

if ! syntax_errors=$(gofmt -e -l "$file" 2>&1 > /dev/null); then
  echo "в $file синтаксическая ошибка:" >&2
  echo "$syntax_errors" >&2
  exit "$SHOW_TO_AGENT_EXIT_CODE"
fi

if ! command -v golangci-lint > /dev/null; then
  echo "golangci-lint не установлен — $file не отформатирован (brew install golangci-lint)" >&2
  exit "$SHOW_TO_USER_EXIT_CODE"
fi

# Конфиг .golangci.yml ищется от каталога файла вверх — поэтому запускаем рядом с ним.
if ! (cd "$(dirname "$file")" && golangci-lint fmt "$(basename "$file")"); then
  echo "golangci-lint fmt не смог отформатировать $file" >&2
  exit "$SHOW_TO_USER_EXIT_CODE"
fi
