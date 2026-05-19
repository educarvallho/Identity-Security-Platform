#!/usr/bin/env bash
# =============================================================
# 02-setup-repo.sh — Clone repo and configure git
# =============================================================
# Run as deploy user (not root) after 01-harden-vps.sh.
#
# Usage:
#   bash 02-setup-repo.sh
#
# Env vars (optional overrides):
#   REPO_URL=https://github.com/educarvallho/Identity-Security-Platform.git
#   INSTALL_DIR=/opt/iam-platform
# =============================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/educarvallho/Identity-Security-Platform.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/iam-platform}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
info() { echo -e "${CYAN}[i]${NC} $*"; }

[[ $EUID -eq 0 ]] && warn "Running as root is not recommended. Consider switching to the deploy user."

# ── Clone or update repo ───────────────────────────────────────────────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Repo already exists at $INSTALL_DIR — pulling latest..."
    git -C "$INSTALL_DIR" pull origin main
else
    log "Cloning repo to $INSTALL_DIR..."
    sudo mkdir -p "$INSTALL_DIR"
    sudo chown "$(whoami):$(whoami)" "$INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
    log "Clone complete"
fi

# ── Git identity ───────────────────────────────────────────────────────────
GIT_NAME=$(git config --global user.name 2>/dev/null || true)
GIT_EMAIL=$(git config --global user.email 2>/dev/null || true)

if [[ -z "$GIT_NAME" ]]; then
    read -rp "  Git name (for commits from this server): " GIT_NAME
    git config --global user.name "$GIT_NAME"
fi
if [[ -z "$GIT_EMAIL" ]]; then
    read -rp "  Git email: " GIT_EMAIL
    git config --global user.email "$GIT_EMAIL"
fi

log "Git identity: $GIT_NAME <$GIT_EMAIL>"

# ── SSH key for GitHub push ────────────────────────────────────────────────
SSH_KEY="$HOME/.ssh/id_ed25519"

if [[ ! -f "$SSH_KEY" ]]; then
    log "Generating SSH key for GitHub push access..."
    mkdir -p "$HOME/.ssh"
    chmod 700 "$HOME/.ssh"
    ssh-keygen -t ed25519 -C "${GIT_EMAIL}" -f "$SSH_KEY" -N ""
    log "Key generated: $SSH_KEY"
fi

# Ensure github.com is in known_hosts
if ! ssh-keygen -F github.com &>/dev/null; then
    ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null
fi

# Test GitHub SSH connection
if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    log "GitHub SSH authentication: OK"
    # Switch remote to SSH for push access
    git -C "$INSTALL_DIR" remote set-url origin \
        "$(git -C "$INSTALL_DIR" remote get-url origin | \
           sed 's|https://github.com/|git@github.com:|')"
    info "Remote switched to SSH: $(git -C "$INSTALL_DIR" remote get-url origin)"
else
    warn "GitHub SSH not yet authorized."
    echo ""
    echo "  Add this public key to GitHub (Settings → SSH Keys):"
    echo "  ────────────────────────────────────────────────────"
    cat "${SSH_KEY}.pub"
    echo "  ────────────────────────────────────────────────────"
    echo "  After adding the key, run:"
    echo "    ssh -T git@github.com   (should say 'successfully authenticated')"
    echo "    git -C $INSTALL_DIR remote set-url origin git@github.com:<org>/<repo>.git"
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}[+] Repo ready at $INSTALL_DIR${NC}"
echo ""
echo "  Next step:"
echo "    cd $INSTALL_DIR && bash scripts/bootstrap/03-generate-env.sh"
echo ""
