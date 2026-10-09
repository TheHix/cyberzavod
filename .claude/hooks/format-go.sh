#!/usr/bin/env bash
# PostToolUse hook: after the agent edits a Go file, it is brought to the project style — gofumpt
# and goimports via golangci-lint fmt, as in make check-api. Without this the edit would pass the
# hook but fail the check in stop-gate and cost the agent an attempt.
#
# Syntax is checked separately with gofmt -e: on a broken file golangci-lint fmt
# only warns and exits with code 0, but the agent needs to learn about the error right away.
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

# The .golangci.yml config is looked up from the file's directory upwards, so we run next to it.
if ! (cd "$(dirname "$file")" && golangci-lint fmt "$(basename "$file")"); then
  echo "golangci-lint fmt не смог отформатировать $file" >&2
  exit "$SHOW_TO_USER_EXIT_CODE"
fi
