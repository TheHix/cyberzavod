# Киберзавод

Цех, в котором ИИ-агенты собирают продукты, и сайт, который показывает эту работу. Первый продукт завода — он сам: каждая запись на сайте — настоящая сборка этого репозитория.

## Стек

| Часть | Технологии |
|---|---|
| Ядро | TypeScript без зависимостей (`packages/core`) |
| Сайт | Astro, SolidJS, Feature-Sliced Design (`apps/web`); PixiJS — в планах |
| API | Go, Postgres, goose (`apps/api`) |
| Инфраструктура | Docker Compose, GitHub Actions, GHCR, nginx, Let's Encrypt; dev-контейнер с файрволом |

## Запуск

Нужны Node 24+, pnpm, Go и Docker.

```bash
pnpm install
make dev
```

Сайт — http://localhost:4321, API — http://localhost:8080/api/health.

`make check` прогоняет все проверки, `make help` показывает остальные команды.

Для работы ИИ-агентов есть изолированный dev-контейнер с файрволом — см. [.devcontainer/README.md](.devcontainer/README.md). Как устроен деплой — [deploy/README.md](deploy/README.md).
