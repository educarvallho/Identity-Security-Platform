#!/usr/bin/env bash
# =============================================================
# 01-harden-vps.sh — VPS initial hardening + Docker install
# =============================================================
# Run as root on a fresh Debian/Ubuntu server.
# Idempotent: safe to run more than once.
#
# Usage:
#   bash 01-harden-vps.sh                 # harden + create deploy user
#   bash 01-harden-vps.sh --finalize      # disable root (run AFTER verifying deploy SSH)
#
# Env vars (optional overrides):
#   DEPLOY_USER=deploy   (default: deploy)
# =============================================================
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
FINALIZE=false
[[ "${1:-}" == "--finalize" ]] && FINALIZE=true

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
info() { echo -e "${CYAN}[i]${NC} $*"; }
die()  { echo -e "${RED}[x]${NC} $*" >&2; exit 1; }

[[ $EUID -ne 0 ]] && die "Must run as root. Use: sudo bash $0"

# ── Detect OS ──────────────────────────────────────────────────────────────
. /etc/os-release
OS_ID="$ID"
OS_VERSION="$VERSION_CODENAME"
info "Detected OS: $PRETTY_NAME"

# ── --finalize mode: disable root ─────────────────────────────────────────
if $FINALIZE; then
    log "Finalizing: disabling root login..."
    passwd -l root
    sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
    sshd -t && systemctl reload sshd
    echo ""
    echo -e "${GREEN}Root login disabled.${NC} Only $DEPLOY_USER can SSH in now."
    exit 0
fi

# ── System update ──────────────────────────────────────────────────────────
log "Updating system packages..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

# ── Base packages ──────────────────────────────────────────────────────────
log "Installing base packages..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    curl git ca-certificates gnupg lsb-release \
    ufw fail2ban python3 unzip htop

# ── NTP — Cloudflare as primary ────────────────────────────────────────────
log "Configuring NTP (Cloudflare primary)..."
cat > /etc/systemd/timesyncd.conf <<'EOF'
[Time]
NTP=time.cloudflare.com
FallbackNTP=0.debian.pool.ntp.org 1.debian.pool.ntp.org 2.debian.pool.ntp.org
EOF
systemctl enable --now systemd-timesyncd
timedatectl set-ntp true
info "NTP sync status: $(timedatectl show -p NTPSynchronized --value)"

# ── SSH hardening ──────────────────────────────────────────────────────────
log "Hardening SSH..."
SSHD_CONF=/etc/ssh/sshd_config

set_sshd() {
    local key="$1" val="$2"
    if grep -qE "^#?\s*${key}\s" "$SSHD_CONF"; then
        sed -i "s|^#\?\s*${key}\s.*|${key} ${val}|" "$SSHD_CONF"
    else
        echo "${key} ${val}" >> "$SSHD_CONF"
    fi
}

set_sshd PasswordAuthentication no
set_sshd ChallengeResponseAuthentication no
set_sshd KbdInteractiveAuthentication no
set_sshd PubkeyAuthentication yes
set_sshd PermitEmptyPasswords no
set_sshd X11Forwarding no
set_sshd MaxAuthTries 3
set_sshd LoginGraceTime 30
set_sshd AllowAgentForwarding no

sshd -t || die "sshd config test failed — check /etc/ssh/sshd_config"
systemctl reload sshd

# ── Deploy user ────────────────────────────────────────────────────────────
log "Creating deploy user: $DEPLOY_USER..."
if ! id "$DEPLOY_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$DEPLOY_USER"
    log "User $DEPLOY_USER created"
else
    info "User $DEPLOY_USER already exists"
fi

usermod -aG sudo "$DEPLOY_USER"
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$DEPLOY_USER"
chmod 440 "/etc/sudoers.d/$DEPLOY_USER"

DEPLOY_HOME=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
mkdir -p "$DEPLOY_HOME/.ssh"

if [[ -f /root/.ssh/authorized_keys ]]; then
    cp /root/.ssh/authorized_keys "$DEPLOY_HOME/.ssh/authorized_keys"
    log "SSH authorized_keys copied from root to $DEPLOY_USER"
else
    warn "No /root/.ssh/authorized_keys found."
    warn "Add your public key to $DEPLOY_HOME/.ssh/authorized_keys before proceeding."
fi

chmod 700 "$DEPLOY_HOME/.ssh"
chmod 600 "$DEPLOY_HOME/.ssh/authorized_keys" 2>/dev/null || true
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh"

# ── Docker ─────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    log "Installing Docker (official repository)..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/${OS_ID}/gpg" \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/${OS_ID} ${OS_VERSION} stable" \
        | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin
    log "Docker $(docker --version) installed"
else
    info "Docker already installed: $(docker --version)"
fi

usermod -aG docker "$DEPLOY_USER"
systemctl enable --now docker

# ── UFW ────────────────────────────────────────────────────────────────────
log "Configuring UFW firewall..."
ufw --force reset > /dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh comment "SSH access"
ufw --force enable
info "UFW status: $(ufw status | head -1)"

# ── fail2ban ───────────────────────────────────────────────────────────────
log "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 86400
maxretry = 3
findtime = 600

[sshd]
enabled  = true
port     = ssh
logpath  = %(sshd_log)s
backend  = %(sshd_backend)s
EOF
systemctl enable --now fail2ban
systemctl reload fail2ban || systemctl restart fail2ban
log "fail2ban active: $(fail2ban-client status | grep 'Number of jail')"

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        VPS hardening complete                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Deploy user: ${CYAN}${DEPLOY_USER}${NC}   (sudo + docker, SSH key from root)"
echo -e "  UFW:         ${CYAN}active — deny incoming, allow SSH${NC}"
echo -e "  fail2ban:    ${CYAN}active — sshd jail, bantime 24h, maxretry 3${NC}"
echo -e "  NTP:         ${CYAN}time.cloudflare.com${NC}"
echo -e "  Docker:      ${CYAN}$(docker --version 2>/dev/null || echo 'installed')${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. In a NEW terminal, verify SSH as deploy:"
echo "       ssh ${DEPLOY_USER}@$(hostname -I | awk '{print $1}')"
echo ""
echo "  2. After confirming access, disable root login:"
echo "       sudo bash $0 --finalize"
echo ""
echo "  3. As deploy user, run:"
echo "       bash scripts/bootstrap/02-setup-repo.sh"
echo ""
