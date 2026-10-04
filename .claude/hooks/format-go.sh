#!/usr/bin/env bash
# Хук PostToolUse: Go-файл после правки агентом сразу приводится к gofmt.
set -euo pipefail

readonly SHOW_TO_AGENT_EXIT_CODE=2

file=$(jq -r '.tool_input.file_path // empty')
if [[ "$file" != *.go || ! -f "$file" ]]; then
  exit 0
fi
# Синтаксическая ошибка в файле — агенту полезно узнать о ней сразу, а не на make check.
if ! gofmt -w "$file"; then
  echo "gofmt не смог отформатировать $file: в файле синтаксическая ошибка" >&2
  exit "$SHOW_TO_AGENT_EXIT_CODE"
fi
