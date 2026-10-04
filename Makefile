# Единые команды проекта. `make help` — список.

# SSH-алиас сервера из ~/.ssh/config; пользователь с sudo.
SERVER ?= cyberzavod
.DEFAULT_GOAL := help
.PHONY: help up down dev api-dev recording-draft check check-web check-api check-docker check-deploy server-bootstrap server-cert

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
	node packages/recorder/src/draft.ts $(RAW)

check: check-web check-api check-docker check-deploy ## Все проверки: то же, что запускает CI

check-web: ## Типы, тесты и сборка фронта и ядра
	pnpm -r run check

check-api: ## go vet, тесты и сборка API
	cd apps/api && go vet ./... && go test ./... && go build -o /dev/null ./cmd/api

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
		/mnt/.claude/hooks/stop-gate.sh /mnt/.claude/hooks/stop-gate.test.sh /mnt/.claude/hooks/format-go.sh
	docker run --rm -v "$(CURDIR)/deploy/server:/s:ro" bash:5 /s/cyberzavod-deploy.test.sh
	.claude/hooks/stop-gate.test.sh
	deploy/check-nginx.sh

server-bootstrap: ## Привести VPS к состоянию из deploy/ (идемпотентно)
	COPYFILE_DISABLE=1 tar --no-xattrs -C deploy -czf - . | ssh $(SERVER) 'set -e; d=$$(mktemp -d); trap "rm -rf $$d" EXIT; tar -xzf - -C $$d; sudo bash $$d/server/bootstrap.sh $$d'

server-cert: ## Выпустить сертификат Let's Encrypt для cyberzavod.com (один раз)
	ssh $(SERVER) 'sudo certbot certonly --webroot -w /var/www/certbot -d cyberzavod.com -d www.cyberzavod.com --agree-tos --register-unsafely-without-email --non-interactive'
