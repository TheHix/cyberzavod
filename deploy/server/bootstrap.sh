#!/usr/bin/env bash
# Приводит VPS к состоянию, описанному в deploy/. Идемпотентен: повторный запуск безопасен.
# Запускается с машины разработчика: `make server-bootstrap` копирует deploy/ и выполняет скрипт от root.
#
# Предусловие: Ubuntu и администратор с sudo и SSH-ключом (в этом проекте — claude).
# Всё остальное на сервере описано здесь.
set -euo pipefail

readonly SRC_DIR="${1:?укажите путь к распакованной папке deploy/}"
readonly APP_DIR=/srv/cyberzavod
readonly DEPLOY_USER=deploy
readonly CERT=/etc/letsencrypt/live/cyberzavod.com/fullchain.pem
readonly NGINX_SITE=/etc/nginx/sites-available/cyberzavod
# Свежая система первые полчаса ставит обновления; ждём apt, а не падаем.
readonly APT_LOCK_TIMEOUT_SECONDS=600
readonly DB_PASSWORD_BYTES=32

log() { echo "==> $*"; }

# Ставит конфиг и проверяет его командой. Если проверка не прошла, возвращает прежний файл:
# сломанный конфиг sshd или nginx не должен дожить до перезапуска сервиса.
install_checked() {
  local src="$1" dest="$2"
  shift 2
  local backup=""
  if [[ -f "$dest" ]]; then
    backup=$(mktemp)
    cp -p "$dest" "$backup"
  fi
  install -m 0644 "$src" "$dest"
  if "$@"; then
    rm -f "$backup"
    return 0
  fi
  log "проверка «$*» не прошла, возвращаю прежний $dest"
  if [[ -n "$backup" ]]; then
    install -m 0644 "$backup" "$dest"
    rm -f "$backup"
  else
    rm -f "$dest"
  fi
  return 1
}

configure_apt() {
  printf 'DPkg::Lock::Timeout "%s";\n' "$APT_LOCK_TIMEOUT_SECONDS" > /etc/apt/apt.conf.d/90-wait-for-lock
}

install_docker() {
  if command -v docker > /dev/null; then
    log "Docker уже установлен: $(docker --version)"
    return
  fi
  log "ставлю Docker из официального репозитория"
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck source=/dev/null  # системный файл, есть на любом Ubuntu
  . /etc/os-release
  cat > /etc/apt/sources.list.d/docker.sources << EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${VERSION_CODENAME}
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

install_packages() {
  log "ставлю nginx, certbot и fail2ban"
  apt-get update -qq
  apt-get install -y -qq nginx certbot fail2ban python3-systemd
}

harden_ssh() {
  log "SSH: только ключи, без root"
  install_checked "$SRC_DIR/server/sshd-hardening.conf" /etc/ssh/sshd_config.d/00-hardening.conf sshd -t
  systemctl reload ssh
}

setup_firewall() {
  log "файрвол: SSH с ограничением частоты, HTTP и HTTPS"
  ufw default deny incoming > /dev/null
  ufw default allow outgoing > /dev/null
  # Маршрутизацию для контейнеров Docker настраивает сам, ufw её не открывает.
  ufw default deny routed > /dev/null
  ufw limit 22/tcp > /dev/null
  ufw allow 80/tcp > /dev/null
  ufw allow 443/tcp > /dev/null
  ufw --force enable > /dev/null
}

setup_fail2ban() {
  log "fail2ban для SSH"
  install -m 0644 "$SRC_DIR/server/fail2ban-sshd.local" /etc/fail2ban/jail.d/sshd.local
  systemctl enable --now fail2ban
  systemctl restart fail2ban
}

# deploy — пользователь только для входа GitHub Actions. В группе docker его нет:
# это равно root. Вместо этого sudoers разрешает ему ровно один скрипт выкатки.
create_deploy_user() {
  if ! id "$DEPLOY_USER" > /dev/null 2>&1; then
    log "создаю пользователя $DEPLOY_USER"
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
  fi
  if id -nG "$DEPLOY_USER" | grep -qw docker; then
    gpasswd -d "$DEPLOY_USER" docker > /dev/null
  fi
}

# Домашний каталог и ключ принадлежат root: deploy не может ни заменить ключ,
# ни снять ограничение command=.
install_deploy_key() {
  local home="/home/$DEPLOY_USER"
  chown root:root "$home"
  chmod 0755 "$home"
  install -d -m 0755 -o root -g root "$home/.ssh"
  printf 'command="/usr/local/bin/cyberzavod-deploy",restrict %s\n' "$(cat "$SRC_DIR/server/deploy_key.pub")" \
    > "$home/.ssh/authorized_keys"
  chmod 0644 "$home/.ssh/authorized_keys"
}

install_deploy_sudoers() {
  visudo -cqf "$SRC_DIR/server/sudoers-deploy"
  install -m 0440 "$SRC_DIR/server/sudoers-deploy" /etc/sudoers.d/cyberzavod-deploy
}

setup_app_dir() {
  log "готовлю $APP_DIR"
  install -d -m 0750 -o root -g root "$APP_DIR"
  install -d -m 0700 -o root -g root "$APP_DIR/backups"
  install -m 0644 "$SRC_DIR/compose.prod.yaml" "$APP_DIR/compose.yaml"

  local env_file="$APP_DIR/.env"
  if [[ ! -f "$env_file" ]]; then
    log "генерирую пароль базы в $env_file"
    local password
    password=$(openssl rand -hex "$DB_PASSWORD_BYTES")
    (umask 077 && printf 'POSTGRES_PASSWORD=%s\nTAG=\n' "$password" > "$env_file")
  fi
  chown root:root "$env_file"
  chmod 0600 "$env_file"
}

install_scripts() {
  log "ставлю скрипты деплоя и бэкапа"
  install -m 0755 -o root -g root "$SRC_DIR/server/cyberzavod-deploy" /usr/local/bin/cyberzavod-deploy
  install -m 0755 -o root -g root "$SRC_DIR/server/cyberzavod-backup" /usr/local/bin/cyberzavod-backup
  install -m 0644 "$SRC_DIR/server/cyberzavod-backup.service" /etc/systemd/system/
  install -m 0644 "$SRC_DIR/server/cyberzavod-backup.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now cyberzavod-backup.timer
}

setup_nginx() {
  install -d -m 0755 /var/www/certbot
  install_checked "$SRC_DIR/nginx/cyberzavod-routes.conf" /etc/nginx/snippets/cyberzavod-routes.conf nginx -t -q

  local site_conf="$SRC_DIR/nginx/cyberzavod-http.conf"
  if [[ -f "$CERT" ]]; then
    log "nginx: HTTPS-конфиг"
    site_conf="$SRC_DIR/nginx/cyberzavod.conf"
  else
    log "nginx: сертификата ещё нет, временный HTTP-конфиг"
  fi

  ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/cyberzavod
  rm -f /etc/nginx/sites-enabled/default
  if ! install_checked "$site_conf" "$NGINX_SITE" nginx -t -q; then
    # При первой установке возвращать нечего — убираем ссылку, чтобы nginx мог стартовать.
    [[ -f "$NGINX_SITE" ]] || rm -f /etc/nginx/sites-enabled/cyberzavod
    exit 1
  fi
  systemctl enable --now nginx
  systemctl reload nginx
}

# После продления сертификата nginx перечитывает его без простоя.
install_renewal_hook() {
  install -d /etc/letsencrypt/renewal-hooks/deploy
  printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
  chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
}

export DEBIAN_FRONTEND=noninteractive
configure_apt
install_docker
install_packages
harden_ssh
setup_firewall
setup_fail2ban
create_deploy_user
install_deploy_key
install_deploy_sudoers
setup_app_dir
install_scripts
setup_nginx
install_renewal_hook
log "готово"
