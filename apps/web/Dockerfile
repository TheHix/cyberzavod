# syntax=docker/dockerfile:1
# Собирается из корня репозитория: сайту нужны пакет packages/core и опубликованные записи.
#   docker build -f apps/web/Dockerfile .

FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /src
# Сначала только манифесты — слой с зависимостями переиспользуется, пока они не меняются.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY recordings/published recordings/published
COPY apps/web apps/web
RUN pnpm --filter @cyberzavod/web build

# Статика отдаётся nginx без root; TLS и маршрутизацию делает nginx на хосте.
FROM nginxinc/nginx-unprivileged:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/apps/web/dist /usr/share/nginx/html
