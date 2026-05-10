#!/usr/bin/env bash
# Stops all IAM platform services in reverse startup order.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")/infra"

echo "=== Identity Security Platform — Shutdown ==="

docker compose -f "$INFRA_DIR/monitoring/uptime-kuma/docker-compose.yml" down 2>/dev/null || true
docker compose -f "$INFRA_DIR/monitoring/grafana/docker-compose.yml" down 2>/dev/null || true
docker compose -f "$INFRA_DIR/monitoring/loki/docker-compose.yml" down 2>/dev/null || true
docker compose -f "$INFRA_DIR/cloudflared/docker-compose.yml" down 2>/dev/null || true
docker compose -f "$INFRA_DIR/nginx/docker-compose.yml" down 2>/dev/null || true
docker compose -f "$INFRA_DIR/infisical/docker-compose.yml" down 2>/dev/null || true
docker compose -f "$INFRA_DIR/keycloak/docker-compose.yml" down 2>/dev/null || true
docker compose -f "$INFRA_DIR/smtp-relay/docker-compose.yml" down 2>/dev/null || true
docker compose -f "$INFRA_DIR/redis-auth/docker-compose.yml" down 2>/dev/null || true
docker compose -f "$INFRA_DIR/postgres-auth/docker-compose.yml" down 2>/dev/null || true

echo "=== Platform DOWN ==="
