# Единые команды проекта. `make help` — список.

.DEFAULT_GOAL := help
.PHONY: help up down dev api-dev recording-draft recording-publish project-init format check check-web check-api check-docker check-scripts

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

recording-draft: ## Черновик записи из журнала сборки (RAW=файл, по умолчанию самый свежий)
	node packages/recorder/src/bin/draft.ts $(RAW)

# VERSION и BUILD берутся только из командной строки: одноимённая переменная окружения (у версий
# инструментов они бывают, а BUILD ставят многие сборочные системы) молча выбрала бы чужую версию
# завода или опубликовала бы одну сборку вместо всех.
recording-publish: ## Опубликовать черновик (DRAFT=файл, по умолчанию самый свежий; BUILD=id — одну сборку)
	node packages/recorder/src/bin/publish.ts "$(DRAFT)" $(if $(filter command line,$(origin BUILD)),"$(BUILD)")

project-init: ## Подключить внешний репозиторий к заводу (DIR=путь ID=id [VERSION=версия])
	factory/project-init.sh "$(CURDIR)" "$(DIR)" "$(ID)" $(if $(filter command line,$(origin VERSION)),"$(VERSION)")

format: ## Привести код к стилю: Prettier и ESLint --fix для TS, gofumpt и goimports для Go
	pnpm format
	cd apps/api && golangci-lint fmt ./...

check: check-web check-api check-docker check-scripts ## Все проверки: то же, что запускает CI

# Тест подключения проектов — здесь, а не в check-scripts: сценарию хука записи нужны Node
# и зависимости workspace, а job scripts их не ставит.
check-web: ## Стиль, типы, тесты и сборка фронта и пакетов, тест подключения проектов
	pnpm lint
	pnpm -r run check
	factory/project-init.test.sh

# Тест хука форматирования Go — здесь, а не в check-scripts: хуку нужны Go и golangci-lint,
# а они есть везде, где запускается check-api (CI-job api, dev-контейнер).
check-api: ## golangci-lint, тесты и сборка API, тест хука форматирования Go
	cd apps/api && golangci-lint run ./... && go test ./... && go build -o /dev/null ./cmd/api
	.claude/hooks/format-go.test.sh

check-docker: ## Сборка Docker-образов API и сайта
	docker build -q -t cyberzavod-api:check apps/api >/dev/null
	docker build -q -f apps/web/Dockerfile -t cyberzavod-web:check . >/dev/null

check-scripts: ## Shell-скрипты dev-контейнера, хуков и завода: shellcheck и тесты хуков
	docker run --rm -v "$(CURDIR):/mnt:ro" koalaman/shellcheck:stable -x \
		/mnt/.devcontainer/init-firewall.sh /mnt/.claude/hooks/lib.sh /mnt/.claude/hooks/turn-start.sh \
		/mnt/.claude/hooks/stop-gate.sh /mnt/.claude/hooks/stop-gate.test.sh /mnt/.claude/hooks/format-go.sh \
		/mnt/.claude/hooks/format-go.test.sh /mnt/.claude/hooks/session-start.sh \
		/mnt/.claude/hooks/session-start.test.sh \
		/mnt/factory/project-init.sh /mnt/factory/project-init.test.sh
	.claude/hooks/stop-gate.test.sh
	.claude/hooks/session-start.test.sh
