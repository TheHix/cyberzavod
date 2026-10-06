#!/usr/bin/env bash
# Хук SessionStart: готовит облачную сессию Claude Code к make check-web check-api, иначе
# stop-gate не отпустит агента. Образ облака не знает о проекте: в нём нет зависимостей pnpm,
# а golangci-lint бывает собран Go старше, чем в apps/api/go.mod, и тогда отказывается
# проверять модуль. Локально и в dev-контейнере хук ничего не делает: там окружение собирают
# человек и Dockerfile.
#
# Версия линтера берётся из dev-контейнера, Go — из go.mod, чтобы не заводить ещё одну копию.
# Вывод установок уходит в stderr: stdout хука SessionStart попадает в контекст агента.
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

# Новый линтер встаёт на место найденного в PATH, чтобы старый его не заслонял.
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
