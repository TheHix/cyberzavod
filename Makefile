# Единые команды проекта. `make help` — список.
.DEFAULT_GOAL := help
.PHONY: help up down dev check check-web check-api check-docker

help: ## Показать команды
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

up: ## Поднять Postgres и API в Docker и дождаться готовности
	docker compose up -d --build --wait

down: ## Остановить Docker-окружение (данные базы сохраняются)
	docker compose down

dev: up ## API в Docker + фронт с горячей перезагрузкой
	pnpm dev

check: check-web check-api check-docker ## Все проверки: то же, что запускает CI

check-web: ## Типы, тесты и сборка фронта и ядра
	pnpm -r run check

check-api: ## go vet, тесты и сборка API
	cd apps/api && go vet ./... && go test ./... && go build -o /dev/null ./cmd/api

check-docker: ## Сборка Docker-образа API
	docker build -q -t cyberzavod-api:check apps/api >/dev/null
