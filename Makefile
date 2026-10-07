# Единые команды проекта. `make help` — список.

.DEFAULT_GOAL := help
.PHONY: help up down dev api-dev format check check-web check-api check-docker check-scripts

help: ## Показать команды
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-17s %s\n", $$1, $$2}'

up: ## Поднять Postgres и API в Docker и дождаться готовности
	docker compose up -d --build --wait

down: ## Остановить Docker-окружение (данные базы сохраняются)
	docker compose down

dev: up ## API в Docker + фронт с горячей перезагрузкой
	pnpm dev

api-dev: ## API из исходников: миграции и запуск (нужен DATABASE_URL; в dev-контейнере задан)
	cd apps/api && go run ./cmd/api migrate && go run ./cmd/api serve

format: ## Привести код к стилю: Prettier и ESLint --fix для TS, gofumpt и goimports для Go
	pnpm format
	cd apps/api && golangci-lint fmt ./...

check: check-web check-api check-docker check-scripts ## Все проверки: то же, что запускает CI

# Сверка файлов агента с harness — здесь, а не в check-scripts: CLI нужны Node и зависимости
# workspace, а job scripts их не ставит.
check-web: ## Стиль, типы, тесты и сборка фронта и пакетов, файлы агента совпадают с harness
	pnpm lint
	pnpm -r run check
	node packages/cli/src/bin/cyberzavod.ts sync --check

# Тест хука форматирования Go — здесь, а не в check-scripts: хуку нужны Go и golangci-lint,
# а они есть везде, где запускается check-api (CI-job api, dev-контейнер).
check-api: ## golangci-lint, тесты и сборка API, тест хука форматирования Go
	cd apps/api && golangci-lint run ./... && go test ./... && go build -o /dev/null ./cmd/api
	.claude/hooks/format-go.test.sh

check-docker: ## Сборка Docker-образов API и сайта
	docker build -q -t cyberzavod-api:check apps/api >/dev/null
	docker build -q -f apps/web/Dockerfile -t cyberzavod-web:check . >/dev/null

check-scripts: ## Shell-скрипты dev-контейнера и хуков: shellcheck и тесты хуков
	docker run --rm -v "$(CURDIR):/mnt:ro" koalaman/shellcheck:stable -x \
		/mnt/.devcontainer/init-firewall.sh /mnt/adapters/claude/hooks/lib.sh \
		/mnt/adapters/claude/hooks/turn-start.sh /mnt/adapters/claude/hooks/stop-gate.sh \
		/mnt/adapters/claude/hooks/stop-gate.test.sh /mnt/.claude/hooks/format-go.sh \
		/mnt/.claude/hooks/format-go.test.sh /mnt/.claude/hooks/session-start.sh \
		/mnt/.claude/hooks/session-start.test.sh
	adapters/claude/hooks/stop-gate.test.sh
	.claude/hooks/session-start.test.sh
