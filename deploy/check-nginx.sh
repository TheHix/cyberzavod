#!/usr/bin/env bash
# Проверяет конфиги nginx из deploy/nginx через `nginx -t` той же мажорной версии, что на сервере.
# Настоящего сертификата локально нет, поэтому подставляется самоподписанный.
set -euo pipefail

readonly NGINX_IMAGE=nginx:1.28-alpine
NGINX_DIR=$(cd "$(dirname "$0")/nginx" && pwd)
readonly NGINX_DIR

certs=$(mktemp -d)
trap 'rm -rf "$certs"' EXIT
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=cyberzavod.com \
  -keyout "$certs/privkey.pem" -out "$certs/fullchain.pem" 2> /dev/null

for site in cyberzavod.conf cyberzavod-http.conf; do
  docker run --rm \
    -v "$NGINX_DIR/$site:/etc/nginx/conf.d/default.conf:ro" \
    -v "$NGINX_DIR/cyberzavod-routes.conf:/etc/nginx/snippets/cyberzavod-routes.conf:ro" \
    -v "$certs:/etc/letsencrypt/live/cyberzavod.com:ro" \
    --entrypoint nginx "$NGINX_IMAGE" -t -q
  echo "nginx -t: $site ok"
done
