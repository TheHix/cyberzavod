#!/usr/bin/env bash
# SessionStart hook: prepares a Claude Code cloud session for make check-web check-api, otherwise
# stop-gate will not release the agent. The cloud image knows nothing about the project: it has no
# pnpm dependencies, and golangci-lint may be built with a Go older than in apps/api/go.mod, and
# then refuses to check the module. Locally and in the dev container the hook does nothing: there
# the environment is set up by the human and the Dockerfile.
#
# The linter version comes from the dev container, Go from go.mod, to avoid yet another copy.
# Install output goes to stderr: a SessionStart hook's stdout ends up in the agent's context.
set -euo pipefail

readonly LINTER_MODULE=github.com/golangci/golangci-lint/v2/cmd/golangci-lint
readonly DEFAULT_LINTER_DIR=/usr/local/bin

install_workspace_dependencies() {
  (cd "$project_dir" && pnpm install --frozen-lockfile) >&2
}

read_project_versions() {
  go_version=$(awk '$1 == "go" { print $2 }' "$project_dir/apps/api/go.mod")
  linter_version=$(sed -n 's/^ARG GOLANGCI_LINT_VERSION=//p' "$project_dir/.devcontainer/Dockerfile")
  if [[ -z "$go_version" || -z "$linter_version" ]]; then
    echo "не нашёл версию Go в apps/api/go.mod или GOLANGCI_LINT_VERSION в .devcontainer/Dockerfile" >&2
    exit 1
  fi
}

linter_matches_project() {
  golangci-lint version 2> /dev/null | grep -qF "version $linter_version built with go$go_version"
}

# The new linter replaces the one found in PATH, so that the old one does not shadow it.
install_linter() {
  local current target_dir
  current=$(command -v golangci-lint || true)
  target_dir=$(dirname "${current:-$DEFAULT_LINTER_DIR/golangci-lint}")
  GOTOOLCHAIN="go$go_version" GOBIN="$target_dir" go install "$LINTER_MODULE@v$linter_version" >&2
}

if [[ "${CLAUDE_CODE_REMOTE:-}" != "true" ]]; then
  exit 0
fi

project_dir="${CLAUDE_PROJECT_DIR:?CLAUDE_PROJECT_DIR не задан}"
install_workspace_dependencies
read_project_versions
if ! linter_matches_project; then
  install_linter
fi
