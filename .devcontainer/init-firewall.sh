#!/usr/bin/env bash
# Dev container firewall: outbound connections only to the allowlist.
# Based on the script from the Claude Code dev container. Differences:
#   - any error closes the network entirely instead of leaving it open;
#   - DNS only through Docker's embedded resolver (127.0.0.11), not to any address;
#   - SSH only to allowlisted addresses (GitHub), not to any host;
#   - project domains: npm, Go modules, Claude sign-in.
#
# This protects against accidental access, not against deliberate exfiltration: GitHub addresses and
# shared CDN addresses are reachable. More in .devcontainer/README.md.
#
# Domain IPs are resolved at startup. CDNs sometimes change addresses; then a rerun
# helps: `sudo /usr/local/bin/init-firewall.sh`.
set -euo pipefail
IFS=$'\n\t'

readonly ALLOWED_DOMAINS=(
  # packages
  registry.npmjs.org
  proxy.golang.org
  sum.golang.org
  # Claude: API and subscription sign-in
  api.anthropic.com
  claude.ai
  console.anthropic.com
  platform.claude.com
  # VS Code: extensions and updates, if the container is opened from it
  marketplace.visualstudio.com
  vscode.blob.core.windows.net
  update.code.visualstudio.com
)
readonly BLOCKED_PROBE_URL=https://example.com
readonly ALLOWED_PROBE_URL=https://api.github.com/zen
readonly PROBE_TIMEOUT_SECONDS=5

log() { echo "==> $*"; }

# On any error the network is closed entirely: better no network than no firewall.
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

# --- Collecting addresses. Rules are not touched yet.

# Temporary access to api.github.com: without it a rerun after an emergency close
# could not download the ranges. These rules are reset below along with all the others.
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

# Docker network: neighbouring services (the db database) and ports published from the host.
host_ip=$(ip route | awk '/^default/ {print $3}')
[[ -n "$host_ip" ]]
host_network="${host_ip%.*}.0/24"

# --- Applying. DNS inside Docker goes through 127.0.0.11 over loopback: its NAT rules
# survive the table reset, and UDP/53 is not opened to the outside.

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
# Including SSH: only to allowlisted addresses, that is, to GitHub.
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# --- Checking.

if curl -s --connect-timeout "$PROBE_TIMEOUT_SECONDS" "$BLOCKED_PROBE_URL" > /dev/null; then
  echo "проверка не прошла: $BLOCKED_PROBE_URL доступен" >&2
  false
fi
curl -s --connect-timeout "$PROBE_TIMEOUT_SECONDS" "$ALLOWED_PROBE_URL" > /dev/null
log "файрвол настроен: наружу только белый список"
