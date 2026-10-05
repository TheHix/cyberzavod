# Деплой

```
push в main
  └─ CI: web, api, infra (проверки)
       └─ images: сборка → ghcr.io/bysavelii/cyberzavod-{api,web}:<sha>
            └─ deploy: ssh deploy@сервер <sha>      (только если sha всё ещё последний в main)

Сервер (Ubuntu, /srv/cyberzavod, владелец root)
  nginx на хосте :80/:443 ── /api/ → 127.0.0.1:8081 (api)
                          └─ /     → 127.0.0.1:8082 (web, статика Astro)
  db (Postgres) — только во внутренней сети Docker
```

## Что где лежит

| Файл | Назначение |
|---|---|
| `compose.prod.yaml` | сервисы на сервере; `make server-bootstrap` кладёт его в `/srv/cyberzavod/compose.yaml` |
| `server/bootstrap.sh` | приводит сервер к нужному состоянию, идемпотентен |
| `server/cyberzavod-deploy` | выкатка версии по sha |
| `server/cyberzavod-backup` + `.service` + `.timer` | ежедневный `pg_dump`, хранятся 14 последних |
| `server/sshd-hardening.conf`, `server/fail2ban-sshd.local` | вход только по ключу, защита от перебора |
| `server/sudoers-deploy`, `server/deploy_key.pub` | права и ключ пользователя `deploy` |
| `nginx/` | nginx на хосте: временный HTTP-конфиг и основной HTTPS |
| `check-nginx.sh` | `nginx -t` конфигов локально и в CI |

На сервере вне репозитория живут только `/srv/cyberzavod/.env` (пароль базы и текущий тег), данные базы и бэкапы.

## Первичная настройка

Предусловие: Ubuntu, администратор с sudo и SSH-ключом, SSH-алиас `cyberzavod` на него.

```bash
make server-bootstrap   # Docker, nginx, certbot, файрвол, fail2ban, пользователь deploy, временный HTTP
make server-cert        # сертификат Let's Encrypt
make server-bootstrap   # повторно: теперь ставится HTTPS-конфиг
```

В GitHub:
- окружение `production`, доступное только ветке `main`, с секретами `DEPLOY_SSH_KEY` (приватный ключ), `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS` (отпечаток сервера);
- пакеты `cyberzavod-api` и `cyberzavod-web` в GHCR — публичные: сервер скачивает образы без логина в реестр. Пакеты появляются после первой сборки, поэтому первая выкатка упадёт на скачивании образов (безопасно, сайт не тронут): сделать пакеты публичными в настройках пакета на GitHub и перезапустить job `deploy`.

На сервере `ufw` ограничивает SSH: больше 6 подключений за 30 секунд с одного адреса — временный бан. Чтобы серия команд `ssh cyberzavod` шла через одно соединение, в `~/.ssh/config` у алиаса стоит `ControlMaster auto` и `ControlPersist`.

## Как устроена выкатка

1. Скачать образы нового sha и применить миграции — работающая версия при этом не тронута. Если миграция упала, выкатка останавливается, сайт продолжает работать на старой версии.
2. Записать новый тег в `.env` и поднять `api` и `web`, дождаться healthcheck и `/api/ready`.
3. Если новая версия не поднялась — автоматически вернуть предыдущий тег.

Две выкатки одновременно не идут: вторая ждёт первую (блокировка `flock`).

Поэтому миграции должны быть совместимы с предыдущей версией API: сначала добавляем, удаляем только следующим релизом.

## Изменение compose.prod.yaml и конфигов сервера

Выкатка меняет только тег. Всё остальное в `deploy/` применяется на сервер командой `make server-bootstrap` — до выкатки версии, которой нужны эти изменения.

## Безопасность

- Ключ `deploy` в `authorized_keys` ограничен `command="/usr/local/bin/cyberzavod-deploy",restrict`: ни shell, ни проброса портов. Скрипт принимает только sha и через единственное правило sudoers работает от root.
- `deploy` не состоит в группе `docker` (это было бы равно root). Compose-файл и `.env` принадлежат root, поэтому владелец ключа может лишь выбрать, какие образы из GHCR запустить, а их собирает CI только из `main`.
- Домашний каталог и `authorized_keys` пользователя `deploy` принадлежат root — ограничение не снять изнутри.
- Порты контейнеров опубликованы только на `127.0.0.1`: Docker обходит ufw, поэтому наружу их не открываем.
- Пароль базы генерируется на сервере при первой настройке и никуда не выводится.

## Откат

Обычный путь — `git revert` проблемного коммита и push в `main`: прод всегда совпадает с `main`, а CI выкатит исправленную версию.

Срочно, не дожидаясь CI, — на сервере:

```bash
sudo cyberzavod-deploy <полный sha рабочей версии>
```

Перезапуск job `deploy` у старого коммита в GitHub Actions не откатит: job выкатывает только последний коммит `main` и пропустит остальные.

## Бэкапы

`/srv/cyberzavod/backups`, каждый день в 03:30 UTC. Копии пока лежат только на этом же сервере — следующий шаг: отправка во внешнее хранилище.

Восстановление: база пересоздаётся пустой, дамп применяется одной транзакцией и останавливается на первой ошибке — частичного восстановления не бывает.

```bash
sudo -i
cd /srv/cyberzavod
docker compose stop api
docker compose exec -T db psql -U cyberzavod -d postgres \
  -c 'DROP DATABASE cyberzavod WITH (FORCE)' -c 'CREATE DATABASE cyberzavod'
gunzip -c backups/cyberzavod-<время>.sql.gz \
  | docker compose exec -T db psql -U cyberzavod -d cyberzavod -v ON_ERROR_STOP=1 --single-transaction
docker compose start api
```
