#!/usr/bin/env bash
# Scenarios for session-start.sh on a temporary project with fake pnpm, go and golangci-lint:
# the stubs write their calls to a log and, like the real commands, print to stdout. No network and
# no real installs are needed.
# Run from `make check-scripts`.
set -uo pipefail

HOOKS_DIR=$(cd "$(dirname "$0")" && pwd)
readonly HOOKS_DIR
readonly GO_VERSION=1.99.1
readonly LINTER_VERSION=9.9.9
readonly CURRENT_LINTER="golangci-lint has version $LINTER_VERSION built with go$GO_VERSION"
readonly STALE_LINTER="golangci-lint has version 2.5.0 built with go1.25.1"
passed=0
failed=0

make_project() {
  local project
  project=$(mktemp -d)
  mkdir -p "$project/apps/api" "$project/.devcontainer" "$project/bin"
  printf 'module example.com/api\n\ngo %s\n' "$GO_VERSION" > "$project/apps/api/go.mod"
  printf 'FROM scratch\nARG GOLANGCI_LINT_VERSION=%s\n' "$LINTER_VERSION" > "$project/.devcontainer/Dockerfile"
  make_stub "$project" pnpm << 'STUB'
echo "pnpm $*" >> "$STUB_LOG"
echo Done
STUB
  make_stub "$project" go << 'STUB'
echo "go $* GOTOOLCHAIN=$GOTOOLCHAIN GOBIN=$GOBIN" >> "$STUB_LOG"
echo go: downloading
STUB
  make_stub "$project" golangci-lint << 'STUB'
echo "$STUB_LINTER_VERSION"
STUB
  echo "$project"
}

# Puts an executable command stub into the project's bin; the stub body comes on stdin.
make_stub() {
  local project="$1" name="$2"
  { echo '#!/usr/bin/env bash'; cat; } > "$project/bin/$name"
  chmod +x "$project/bin/$name"
}

# Runs the hook in the project: remote is the value of CLAUDE_CODE_REMOTE, linter is what the
# golangci-lint stub prints. Hook stdout goes to $project/stdout, stub calls to $project/calls.
# System PATH only: the machine's real go and golangci-lint must not replace the stubs.
run_hook() {
  local project="$1" remote="$2" linter="$3"
  CLAUDE_CODE_REMOTE="$remote" CLAUDE_PROJECT_DIR="$project" STUB_LOG="$project/calls" \
    STUB_LINTER_VERSION="$linter" PATH="$project/bin:/usr/bin:/bin" \
    "$HOOKS_DIR/session-start.sh" > "$project/stdout" 2> /dev/null
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

test_outside_cloud_installs_nothing() {
  local project code
  project=$(make_project)

  run_hook "$project" "" "$STALE_LINTER"
  code=$?

  check "вне облака хук выходит с кодом 0" "[[ $code -eq 0 ]]"
  check "вне облака ничего не ставится" "[[ ! -e '$project/calls' ]]"
  rm -rf "$project"
}

test_current_linter_is_kept() {
  local project code
  project=$(make_project)

  run_hook "$project" true "$CURRENT_LINTER"
  code=$?

  check "с нужным линтером хук выходит с кодом 0" "[[ $code -eq 0 ]]"
  check "зависимости pnpm ставятся по lock-файлу" "grep -qx 'pnpm install --frozen-lockfile' '$project/calls'"
  check "нужный линтер не пересобирается" "! grep -q '^go ' '$project/calls'"
  check "stdout хука пуст и не попадает в контекст агента" "[[ ! -s '$project/stdout' ]]"
  rm -rf "$project"
}

test_stale_linter_is_rebuilt_with_project_go() {
  local project code
  project=$(make_project)

  run_hook "$project" true "$STALE_LINTER"
  code=$?

  check "со старым линтером хук выходит с кодом 0" "[[ $code -eq 0 ]]"
  check "линтер версии dev-контейнера собирается Go из go.mod на место старого" \
    "grep -qxF 'go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v$LINTER_VERSION GOTOOLCHAIN=go$GO_VERSION GOBIN=$project/bin' '$project/calls'"
  check "вывод сборки линтера не попадает в контекст агента" "[[ ! -s '$project/stdout' ]]"
  rm -rf "$project"
}

test_missing_linter_is_installed_to_default_dir() {
  local project code
  project=$(make_project)
  rm "$project/bin/golangci-lint"

  run_hook "$project" true ""
  code=$?

  check "без линтера хук выходит с кодом 0" "[[ $code -eq 0 ]]"
  check "без линтера он ставится в /usr/local/bin" \
    "grep -q '^go install .* GOBIN=/usr/local/bin$' '$project/calls'"
  rm -rf "$project"
}

test_missing_versions_fail_loudly() {
  local project code
  project=$(make_project)
  : > "$project/.devcontainer/Dockerfile"

  run_hook "$project" true "$CURRENT_LINTER"
  code=$?

  check "без версии линтера хук падает" "[[ $code -ne 0 ]]"
  check "без версии линтера зависимости pnpm всё равно ставятся" "grep -q '^pnpm install' '$project/calls'"
  check "без версии линтера он не собирается" "! grep -q '^go ' '$project/calls'"
  rm -rf "$project"
}

test_outside_cloud_installs_nothing
test_current_linter_is_kept
test_stale_linter_is_rebuilt_with_project_go
test_missing_linter_is_installed_to_default_dir
test_missing_versions_fail_loudly

if [[ $failed -eq 0 ]]; then
  echo "хук начала сессии: прошло проверок — $passed"
fi
exit "$((failed > 0))"
