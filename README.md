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

## Подключить внешний проект

Завод записывает и ведёт сборки не только этого репозитория. Чтобы подключить другой git-репозиторий, нужен тег `factory-v<версия>` в заводе:

```bash
make project-init DIR=/путь/к/проекту ID=my-project [VERSION=0.1.0]
```

`VERSION` задают только в командной строке (по умолчанию берётся старший тег). Команда копирует из тега агентов, скилл и хуки, ставит хуки записи и заводит карточку проекта. Дальше — путь к заводу в `.claude/settings.local.json` проекта (`{"env": {"CYBERZAVOD_HOME": "/путь/к/заводу"}}`, не коммитить), `checks` в `.cyberzavod/project.json` и CLAUDE.md проекта. Подробности — раздел «Playbooks завода» в [CLAUDE.md](CLAUDE.md).
