#!/usr/bin/env bash
# Local development startup — exposes Keycloak and Infisical directly on localhost.
# Use this for initial configuration and testing WITHOUT a domain or Cloudflare Tunnel.
#
# Keycloak → http://localhost:8180
# Infisical → http://localhost:8181
# Grafana   → http://localhost:3001
#
# Requirements: Docker running, .env file populated (cp .env.template .env && edit)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")/infra"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$ROOT_DIR/.env" ]; then
    echo "ERROR: .env not found. Run: cp .env.template .env && nano .env"
    exit 1
fi

set -a; source "$ROOT_DIR/.env"; set +a

wait_healthy() {
    local name=$1 timeout=${2:-120}
    echo "  Waiting for $name (max ${timeout}s)..."
    local elapsed=0
    until docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null | grep -q "healthy"; do
        sleep 5; elapsed=$((elapsed+5))
        if [ $elapsed -ge $timeout ]; then
            echo "  TIMEOUT: $name not healthy after ${timeout}s"
            echo "  Check logs: docker logs $name --tail 50"
            exit 1
        fi
        # Print progress every 30s
        [ $((elapsed % 30)) -eq 0 ] && echo "  ... ${elapsed}s elapsed, still waiting for $name"
    done
    echo "  [OK] $name (${elapsed}s)"
}

echo "=== IAM Platform — Local Dev Startup ==="
echo ""

echo "[1/5] Creating Docker networks..."
bash "$SCRIPT_DIR/create-networks.sh"

echo "[2/5] Starting PostgreSQL Auth..."
docker compose -f "$INFRA_DIR/postgres-auth/docker-compose.yml" up -d
wait_healthy postgres-auth 120

echo "[3/5] Starting Redis Auth..."
docker compose -f "$INFRA_DIR/redis-auth/docker-compose.yml" up -d

echo "[4/5] Starting Keycloak (dev mode — port 8080 exposed)..."
docker compose \
    -f "$INFRA_DIR/keycloak/docker-compose.yml" \
    -f "$INFRA_DIR/keycloak/docker-compose.dev.yml" \
    up -d
wait_healthy keycloak 360

echo "[5/5] Starting Infisical (dev mode — port 8081 exposed)..."
docker compose \
    -f "$INFRA_DIR/infisical/docker-compose.yml" \
    -f "$INFRA_DIR/infisical/docker-compose.dev.yml" \
    up -d

echo ""
echo "=== Services starting. Access at: ==="
echo "  Keycloak Admin:  http://localhost:8180/admin"
echo "  Keycloak Health: http://localhost:8180/health/ready"
echo "  Infisical:       http://localhost:8181"
echo ""
echo "Credentials: check your .env (KC_ADMIN_USER / KC_ADMIN_PASSWORD)"
echo ""
echo "To also start monitoring (Grafana on :3000):"
echo "  docker compose -f infra/monitoring/loki/docker-compose.yml up -d"
echo "  docker compose -f infra/monitoring/loki/docker-compose.yml up -d"
echo "  docker compose -f infra/monitoring/grafana/docker-compose.yml \\"
echo "    -f infra/monitoring/grafana/docker-compose.dev.yml up -d"
echo "  Grafana: http://localhost:3001"
