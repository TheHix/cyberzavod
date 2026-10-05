# Единые команды проекта. `make help` — список.

# SSH-алиас сервера из ~/.ssh/config; пользователь с sudo.
SERVER ?= cyberzavod
.DEFAULT_GOAL := help
.PHONY: help up down dev api-dev recording-draft recording-publish project-init format check check-web check-api check-docker check-deploy server-bootstrap server-cert

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

check: check-web check-api check-docker check-deploy ## Все проверки: то же, что запускает CI

# Тест подключения проектов — здесь, а не в check-deploy: сценарию хука записи нужны Node
# и зависимости workspace, а job infra их не ставит.
check-web: ## Стиль, типы, тесты и сборка фронта и пакетов, тест подключения проектов
	pnpm lint
	pnpm -r run check
	factory/project-init.test.sh

# Тест хука форматирования Go — здесь, а не в check-deploy: хуку нужны Go и golangci-lint,
# а они есть везде, где запускается check-api (CI-job api, dev-контейнер).
check-api: ## golangci-lint, тесты и сборка API, тест хука форматирования Go
	cd apps/api && golangci-lint run ./... && go test ./... && go build -o /dev/null ./cmd/api
	.claude/hooks/format-go.test.sh

check-docker: ## Сборка Docker-образов API и сайта
	docker build -q -t cyberzavod-api:check apps/api >/dev/null
	docker build -q -f apps/web/Dockerfile -t cyberzavod-web:check . >/dev/null

# Фиктивные значения только для проверки синтаксиса compose: реальные лежат в .env на сервере.
CHECK_TAG := 0000000000000000000000000000000000000000

check-deploy: ## Деплой, dev-контейнер и хуки: compose, shellcheck, тест выкатки, nginx -t
	TAG=$(CHECK_TAG) POSTGRES_PASSWORD=check docker compose -f deploy/compose.prod.yaml config --quiet
	docker run --rm -v "$(CURDIR):/mnt:ro" koalaman/shellcheck:stable -x \
		/mnt/deploy/check-nginx.sh /mnt/deploy/server/bootstrap.sh /mnt/deploy/server/cyberzavod-deploy \
		/mnt/deploy/server/cyberzavod-deploy.test.sh /mnt/deploy/server/cyberzavod-backup \
		/mnt/.devcontainer/init-firewall.sh /mnt/.claude/hooks/lib.sh /mnt/.claude/hooks/turn-start.sh \
		/mnt/.claude/hooks/stop-gate.sh /mnt/.claude/hooks/stop-gate.test.sh /mnt/.claude/hooks/format-go.sh \
		/mnt/.claude/hooks/format-go.test.sh \
		/mnt/factory/project-init.sh /mnt/factory/project-init.test.sh
	docker run --rm -v "$(CURDIR)/deploy/server:/s:ro" bash:5 /s/cyberzavod-deploy.test.sh
	.claude/hooks/stop-gate.test.sh
	deploy/check-nginx.sh

server-bootstrap: ## Привести VPS к состоянию из deploy/ (идемпотентно)
	COPYFILE_DISABLE=1 tar --no-xattrs -C deploy -czf - . | ssh $(SERVER) 'set -e; d=$$(mktemp -d); trap "rm -rf $$d" EXIT; tar -xzf - -C $$d; sudo bash $$d/server/bootstrap.sh $$d'

server-cert: ## Выпустить сертификат Let's Encrypt для cyberzavod.com (один раз)
	ssh $(SERVER) 'sudo certbot certonly --webroot -w /var/www/certbot -d cyberzavod.com -d www.cyberzavod.com --agree-tos --register-unsafely-without-email --non-interactive'
