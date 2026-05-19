#!/usr/bin/env bash
# =============================================================
# 03-generate-env.sh — Generate .env from template
# =============================================================
# Run as deploy user from the repo root directory.
# Prompts for 3 required values; auto-generates everything else.
#
# Usage:
#   cd /opt/iam-platform
#   bash scripts/bootstrap/03-generate-env.sh
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
TEMPLATE="$ROOT_DIR/.env.template"
OUTPUT="$ROOT_DIR/.env"
NGINX_CONF_DIR="$ROOT_DIR/infra/nginx/conf.d"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
info() { echo -e "${CYAN}[i]${NC} $*"; }

[[ -f "$TEMPLATE" ]] || { echo "ERROR: $TEMPLATE not found. Run from repo root."; exit 1; }
command -v python3 &>/dev/null || { echo "ERROR: python3 required"; exit 1; }

if [[ -f "$OUTPUT" ]]; then
    warn ".env already exists."
    read -rp "  Overwrite? [y/N]: " yn
    [[ "$yn" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

echo ""
echo -e "${CYAN}══════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Identity Security Platform — Environment Setup${NC}"
echo -e "${CYAN}══════════════════════════════════════════════${NC}"
echo ""
echo "  3 required inputs — everything else is auto-generated."
echo ""

# ── Required inputs ────────────────────────────────────────────────────────
read -rp "  Domain (e.g. example.com): " DOMAIN
[[ -n "$DOMAIN" ]] || { echo "ERROR: domain required"; exit 1; }

read -rsp "  Cloudflare Tunnel Token: " CF_TOKEN
echo ""
[[ -n "$CF_TOKEN" ]] || { echo "ERROR: tunnel token required"; exit 1; }

echo ""
read -rsp "  Keycloak admin password [leave blank to auto-generate]: " KC_ADMIN_PASS
echo ""
if [[ -z "$KC_ADMIN_PASS" ]]; then
    KC_ADMIN_PASS=$(openssl rand -base64 32)
    GENERATED_KC_PASS=true
else
    GENERATED_KC_PASS=false
fi

# ── Auto-generate secrets ──────────────────────────────────────────────────
log "Generating secrets..."

POSTGRES_AUTH_PASSWORD=$(openssl rand -base64 32)
KC_DB_PASSWORD=$(openssl rand -base64 32)
INFISICAL_DB_PASSWORD=$(openssl rand -hex 32)   # hex — used in DB URL
REDIS_PASSWORD=$(openssl rand -hex 32)           # hex — used in Redis URL
INFISICAL_ENCRYPTION_KEY=$(openssl rand -hex 16) # exactly 32 hex chars
INFISICAL_AUTH_SECRET=$(openssl rand -base64 32)
GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 32)
BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 32)

# ── Write .env via Python (handles special chars safely) ───────────────────
log "Writing .env..."

python3 - <<PYEOF
import re

with open("$TEMPLATE") as f:
    content = f.read()

replacements = {
    "CHANGE_ME_strong_postgres_password":       "$POSTGRES_AUTH_PASSWORD",
    "CHANGE_ME_strong_keycloak_db_password":    "$KC_DB_PASSWORD",
    "CHANGE_ME_strong_infisical_db_password":   "$INFISICAL_DB_PASSWORD",
    "CHANGE_ME_strong_redis_password":           "$REDIS_PASSWORD",
    "CHANGE_ME_32_hex_chars_here_xxxxx":         "$INFISICAL_ENCRYPTION_KEY",
    "CHANGE_ME_jwt_signing_secret_min_32_chars": "$INFISICAL_AUTH_SECRET",
    "CHANGE_ME_strong_keycloak_admin_password":  "$KC_ADMIN_PASS",
    "CHANGE_ME_strong_grafana_password":          "$GRAFANA_ADMIN_PASSWORD",
    "CHANGE_ME_gpg_passphrase_min_32_chars":      "$BACKUP_ENCRYPTION_KEY",
    "CHANGE_ME_cloudflare_tunnel_token":          "$CF_TOKEN",
    "YOUR_DOMAIN.com":                            "$DOMAIN",
}

for placeholder, value in replacements.items():
    content = content.replace(placeholder, value)

with open("$OUTPUT", "w") as f:
    f.write(content)

print("  .env written")
PYEOF

chmod 600 "$OUTPUT"

# ── Update nginx conf files with real domain ───────────────────────────────
if [[ -d "$NGINX_CONF_DIR" ]]; then
    log "Updating nginx conf files with domain: $DOMAIN..."
    for conf in "$NGINX_CONF_DIR"/*.conf; do
        [[ -f "$conf" ]] || continue
        # Replace generic placeholder or any existing domain pattern
        sed -i "s/YOUR_DOMAIN\.com/$DOMAIN/g" "$conf"
    done
    info "nginx conf files updated"
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Environment configured                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Domain:          ${CYAN}$DOMAIN${NC}"
echo -e "  Keycloak Admin:  ${CYAN}admin${NC}"
if $GENERATED_KC_PASS; then
echo -e "  Keycloak Pass:   ${YELLOW}$KC_ADMIN_PASS${NC}  ← SAVE THIS NOW"
fi
echo -e "  Grafana Admin:   ${CYAN}admin${NC} / ${YELLOW}$GRAFANA_ADMIN_PASSWORD${NC}  ← SAVE"
echo ""
echo -e "  ${YELLOW}All generated secrets are in .env (chmod 600, gitignored).${NC}"
echo -e "  ${YELLOW}After the platform is running, migrate secrets to Infisical.${NC}"
echo ""

# Remaining CHANGE_ME values (SMTP, Azure) — inform user
REMAINING=$(grep -c "CHANGE_ME" "$OUTPUT" 2>/dev/null || true)
if [[ "$REMAINING" -gt 0 ]]; then
    warn "$REMAINING placeholder(s) still in .env (SMTP / Azure — deferred):"
    grep "CHANGE_ME" "$OUTPUT" | grep -v "^#" | awk -F= '{print "    " $1}'
fi

echo ""
echo "  Next step:"
echo "    bash scripts/up.sh"
echo ""
