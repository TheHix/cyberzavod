#!/usr/bin/env bash
# Сценарии хука format-go.sh на временном Go-модуле с конфигом golangci-lint проекта.
# Запускается из `make check-api`: там есть Go и golangci-lint, которые нужны хуку.
set -uo pipefail

HOOKS_DIR=$(cd "$(dirname "$0")" && pwd)
readonly HOOKS_DIR
readonly PROJECT_CONFIG="$HOOKS_DIR/../../apps/api/.golangci.yml"
readonly SHOW_TO_AGENT=2
readonly PASSED=0
passed=0
failed=0

make_module() {
  local module
  module=$(mktemp -d)
  cp "$PROJECT_CONFIG" "$module/.golangci.yml"
  printf 'module example.com/probe\n\ngo 1.27\n' > "$module/go.mod"
  echo "$module"
}

run_hook() {
  local file="$1"
  jq -n --arg f "$file" '{tool_input: {file_path: $f}}' | "$HOOKS_DIR/format-go.sh" > /dev/null 2>&1
}

check() {
  local name="$1" condition="$2"
  if eval "$condition"; then
    passed=$((passed + 1))
  else
    echo "✗ $name" >&2
    failed=$((failed + 1))
  fi
}

test_broken_go_file_is_reported_to_agent() {
  local module code
  module=$(make_module)
  printf 'package probe\n\nfunc Broken( {\n' > "$module/broken.go"

  run_hook "$module/broken.go"
  code=$?

  check "сломанный Go-файл — сообщение агенту" "[[ $code -eq $SHOW_TO_AGENT ]]"
  rm -rf "$module"
}

test_valid_go_file_is_formatted_with_project_style() {
  local module code
  module=$(make_module)
  printf 'package probe\nimport "fmt"\nimport "os"\nfunc Print( ) {fmt.Println(os.Args)}\n' > "$module/ok.go"

  run_hook "$module/ok.go"
  code=$?

  check "корректный Go-файл отформатирован" \
    "[[ $code -eq $PASSED ]] && grep -q '^import (' '$module/ok.go' && grep -q '^func Print() {' '$module/ok.go'"
  rm -rf "$module"
}

test_non_go_file_is_skipped() {
  local module code
  module=$(make_module)
  printf 'const x  =  1\n' > "$module/x.ts"

  run_hook "$module/x.ts"
  code=$?

  check "не-Go файл пропускается без изменений" "[[ $code -eq $PASSED ]] && grep -q 'x  =  1' '$module/x.ts'"
  rm -rf "$module"
}

test_broken_go_file_is_reported_to_agent
test_valid_go_file_is_formatted_with_project_style
test_non_go_file_is_skipped

if [[ $failed -eq 0 ]]; then
  echo "хук форматирования Go: $passed сценария прошли"
fi
exit "$((failed > 0))"
