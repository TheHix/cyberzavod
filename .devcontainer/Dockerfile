# Isolated environment for development and for agents: only the project folder is visible,
# outbound network only by allowlist (init-firewall.sh). Based on the dev container
# from the Claude Code repository: https://github.com/anthropics/claude-code/tree/main/.devcontainer

FROM golang:1.27-trixie AS go

FROM node:24-trixie

ARG TZ=Europe/Moscow
ENV TZ="$TZ"
ARG CLAUDE_CODE_VERSION=latest

RUN apt-get update && apt-get install -y --no-install-recommends \
    aggregate dnsutils gh git ipset iproute2 iptables jq less make nano procps sudo zsh \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Go is the same major version as in apps/api/go.mod. GOTOOLCHAIN=local: no toolchain downloads.
COPY --from=go /usr/local/go /usr/local/go
ENV PATH=/usr/local/go/bin:/home/node/go/bin:$PATH \
    GOTOOLCHAIN=local

# golangci-lint is the same version as in CI; the archive is verified against the release checksum.
ARG GOLANGCI_LINT_VERSION=2.14.0
ARG GOLANGCI_LINT_SHA256_AMD64=ab90aeb7b066f92a33415b638a50fe5344bbb75a0d32ad30cc248d88f81032ab
ARG GOLANGCI_LINT_SHA256_ARM64=ee7ec5f3453d15ddf106fae5a4d6c71737712348a979d1fe9cd52ec7ea299bae
RUN set -eu; arch=$(dpkg --print-architecture); \
  case "$arch" in amd64) sum=$GOLANGCI_LINT_SHA256_AMD64 ;; arm64) sum=$GOLANGCI_LINT_SHA256_ARM64 ;; *) exit 1 ;; esac; \
  archive="golangci-lint-${GOLANGCI_LINT_VERSION}-linux-${arch}.tar.gz"; \
  curl -fsSLo "/tmp/$archive" "https://github.com/golangci/golangci-lint/releases/download/v${GOLANGCI_LINT_VERSION}/$archive"; \
  echo "$sum  /tmp/$archive" | sha256sum -c -; \
  tar -xzf "/tmp/$archive" -C /tmp; \
  install -m 0755 "/tmp/golangci-lint-${GOLANGCI_LINT_VERSION}-linux-${arch}/golangci-lint" /usr/local/bin/; \
  rm -rf /tmp/golangci-lint-*

# pnpm comes from the packageManager field of the root package.json via corepack.
RUN corepack enable

ENV DEVCONTAINER=true \
    NPM_CONFIG_PREFIX=/usr/local/share/npm-global \
    SHELL=/bin/zsh \
    EDITOR=nano
ENV PATH=$PATH:/usr/local/share/npm-global/bin
# Debian login shells (/etc/profile) overwrite PATH, so we restore Go and global npm packages.
RUN printf 'export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH:/usr/local/share/npm-global/bin"\n' \
  > /etc/profile.d/devcontainer-path.sh

# Directories on which compose mounts named volumes. An empty volume on first mount
# takes the owner of the directory from the image, so they are created here as node, and no
# chown as root is needed at run time.
RUN mkdir -p /usr/local/share/npm-global /commandhistory \
    /home/node/.claude /home/node/.config/gh /home/node/.local/share/pnpm /home/node/go \
    /workspace/node_modules /workspace/apps/web/node_modules \
    /workspace/packages/core/node_modules /workspace/packages/storage/node_modules \
    /workspace/packages/cli/node_modules /workspace/adapters/claude/node_modules \
  && chown -R node:node /usr/local/share/npm-global /commandhistory /home/node /workspace

# The only thing node can do as root is restart the firewall. The script is owned by root.
COPY init-firewall.sh /usr/local/bin/
RUN chmod 0755 /usr/local/bin/init-firewall.sh \
  && printf 'node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh\n' > /etc/sudoers.d/node-firewall \
  && chmod 0440 /etc/sudoers.d/node-firewall

USER node
WORKDIR /workspace
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}
