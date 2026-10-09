# syntax=docker/dockerfile:1
# Built from the repository root: the site needs the packages/core and packages/player
# packages, the project journal .cyberzavod/journal/, project cards and guides.
#   docker build -f apps/web/Dockerfile .

FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /src
# Manifests first: the dependency layer is reused as long as they do not change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/player/package.json packages/player/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY packages/player packages/player
COPY .cyberzavod/journal .cyberzavod/journal
COPY projects projects
COPY guides guides
COPY apps/web apps/web
RUN pnpm --filter @cyberzavod/web build

# Static files are served by nginx without root; TLS and routing are done by nginx on the host.
FROM nginxinc/nginx-unprivileged:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/apps/web/dist /usr/share/nginx/html
