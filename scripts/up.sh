#!/usr/bin/env bash
# Starts the full IAM platform in dependency order.
# Prerequisites: .env loaded, Docker running, networks created.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$ROOT_DIR/infra"

# Load .env if present
if [ -f "$ROOT_DIR/.env" ]; then
    set -a; source "$ROOT_DIR/.env"; set +a
fi

wait_healthy() {
    local name=$1 timeout=${2:-120}
    echo "  Waiting for $name to be healthy (max ${timeout}s)..."
    local elapsed=0
    until docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null | grep -q "healthy"; do
        sleep 5; elapsed=$((elapsed + 5))
        if [ "$elapsed" -ge "$timeout" ]; then
            echo "  TIMEOUT: $name not healthy after ${timeout}s"
            docker logs "$name" --tail 20
            exit 1
        fi
    done
    echo "  [OK] $name healthy"
}

echo "=== Identity Security Platform — Startup ==="
echo ""

echo "[1/9] Creating Docker networks..."
bash "$SCRIPT_DIR/create-networks.sh"

echo "[2/9] Starting PostgreSQL Auth..."
docker compose -f "$INFRA_DIR/postgres-auth/docker-compose.yml" up -d
wait_healthy postgres-auth 120

echo "[3/9] Starting Redis Auth..."
docker compose -f "$INFRA_DIR/redis-auth/docker-compose.yml" up -d

echo "[4/9] Starting SMTP Relay..."
docker compose -f "$INFRA_DIR/smtp-relay/docker-compose.yml" up -d

echo "[5/9] Starting Keycloak..."
docker compose -f "$INFRA_DIR/keycloak/docker-compose.yml" up -d
wait_healthy keycloak 360

echo "[6/9] Starting Infisical..."
docker compose -f "$INFRA_DIR/infisical/docker-compose.yml" up -d

echo "[7/9] Starting Loki + Uptime Kuma (required before nginx)..."
docker compose -f "$INFRA_DIR/monitoring/loki/docker-compose.yml" up -d
wait_healthy loki 60
docker compose -f "$INFRA_DIR/monitoring/uptime-kuma/docker-compose.yml" up -d

echo "[8/9] Starting Nginx + Cloudflare Tunnel..."
docker compose -f "$INFRA_DIR/nginx/docker-compose.yml" up -d
wait_healthy nginx 60
docker compose -f "$INFRA_DIR/cloudflared/docker-compose.yml" up -d

echo "[9/9] Starting metrics collectors + dashboards..."
docker compose -f "$INFRA_DIR/monitoring/promtail/docker-compose.yml" up -d
docker compose -f "$INFRA_DIR/monitoring/prometheus/docker-compose.yml" up -d
wait_healthy prometheus 60
docker compose -f "$INFRA_DIR/monitoring/node-exporter/docker-compose.yml" up -d
docker compose -f "$INFRA_DIR/monitoring/grafana/docker-compose.yml" up -d
wait_healthy grafana 60

echo ""
echo "=== Platform UP — running healthcheck ==="
bash "$SCRIPT_DIR/healthcheck.sh"
