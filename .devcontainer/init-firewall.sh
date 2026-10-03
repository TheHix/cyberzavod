#!/usr/bin/env bash
# Файрвол dev-контейнера: исходящие соединения только на белый список.
# Основан на эталонном скрипте Claude Code. Отличия:
#   - любая ошибка закрывает сеть целиком, а не оставляет её открытой;
#   - DNS только через встроенный резолвер Docker (127.0.0.11), а не на любой адрес;
#   - SSH только на адреса из белого списка (GitHub), а не на любой хост;
#   - домены проекта: npm, Go-модули, вход в Claude.
#
# Это защита от случайного доступа, а не от целенаправленной утечки: на адреса GitHub и
# общие адреса CDN выйти можно. Подробнее — .devcontainer/README.md.
#
# IP доменов резолвятся при запуске. CDN иногда меняют адреса — тогда помогает
# повторный запуск: `sudo /usr/local/bin/init-firewall.sh`.
set -euo pipefail
IFS=$'\n\t'

readonly ALLOWED_DOMAINS=(
  # пакеты
  registry.npmjs.org
  proxy.golang.org
  sum.golang.org
  # Claude: API и вход в подписку
  api.anthropic.com
  claude.ai
  console.anthropic.com
  platform.claude.com
  # VS Code: расширения и обновления, если контейнер открыт из него
  marketplace.visualstudio.com
  vscode.blob.core.windows.net
  update.code.visualstudio.com
)
readonly BLOCKED_PROBE_URL=https://example.com
readonly ALLOWED_PROBE_URL=https://api.github.com/zen
readonly PROBE_TIMEOUT_SECONDS=5

log() { echo "==> $*"; }

# При любой ошибке сеть закрывается полностью: лучше контейнер без сети, чем без файрвола.
lock_down() {
  iptables -P INPUT DROP
  iptables -P FORWARD DROP
  iptables -P OUTPUT DROP
  iptables -F
  iptables -A INPUT -i lo -j ACCEPT
  iptables -A OUTPUT -o lo -j ACCEPT
  echo "ошибка настройки файрвола — сеть закрыта полностью; запустите скрипт снова" >&2
}
trap lock_down ERR

# --- Сбор адресов. Правила пока не тронуты.

# Временный выход к api.github.com: без него повторный запуск после аварийного закрытия
# не смог бы скачать диапазоны. Эти правила сбрасываются ниже вместе со всеми остальными.
mapfile -t github_api_ips < <(dig +short A api.github.com | grep -E '^[0-9.]+$')
iptables -I INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
for ip in "${github_api_ips[@]}"; do
  iptables -I OUTPUT -d "$ip" -p tcp --dport 443 -j ACCEPT
done

log "диапазоны GitHub"
github_meta=$(curl -fsS https://api.github.com/meta)
echo "$github_meta" | jq -e '.web and .api and .git' > /dev/null
mapfile -t github_ranges < <(echo "$github_meta" | jq -r '(.web + .api + .git)[]' | grep -v ':' | aggregate -q)
for cidr in "${github_ranges[@]}"; do
  [[ "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]
done

domain_ips=()
for domain in "${ALLOWED_DOMAINS[@]}"; do
  mapfile -t ips < <(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')
  if [[ ${#ips[@]} -eq 0 ]]; then
    echo "не удалось получить адрес $domain" >&2
    false
  fi
  domain_ips+=("${ips[@]}")
done

# Сеть Docker: соседние сервисы (база db) и опубликованные порты с хоста.
host_ip=$(ip route | awk '/^default/ {print $3}')
[[ -n "$host_ip" ]]
host_network="${host_ip%.*}.0/24"

# --- Применение. DNS внутри Docker идёт через 127.0.0.11 по loopback — его NAT-правила
# переживают сброс таблиц, а наружу UDP/53 не открывается.

docker_dns_rules=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2> /dev/null || true

iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT
if [[ -n "$docker_dns_rules" ]]; then
  iptables -t nat -N DOCKER_OUTPUT 2> /dev/null || true
  iptables -t nat -N DOCKER_POSTROUTING 2> /dev/null || true
  echo "$docker_dns_rules" | xargs -L 1 iptables -t nat
fi

ipset create allowed-domains hash:net
for cidr in "${github_ranges[@]}"; do
  ipset add allowed-domains "$cidr"
done
for ip in "${domain_ips[@]}"; do
  ipset add -exist allowed-domains "$ip"
done

log "сеть Docker: $host_network"
iptables -A INPUT -s "$host_network" -j ACCEPT
iptables -A OUTPUT -d "$host_network" -j ACCEPT
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
# В том числе SSH: только к адресам из белого списка, то есть к GitHub.
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# --- Проверка.

if curl -s --connect-timeout "$PROBE_TIMEOUT_SECONDS" "$BLOCKED_PROBE_URL" > /dev/null; then
  echo "проверка не прошла: $BLOCKED_PROBE_URL доступен" >&2
  false
fi
curl -s --connect-timeout "$PROBE_TIMEOUT_SECONDS" "$ALLOWED_PROBE_URL" > /dev/null
log "файрвол настроен: наружу только белый список"
