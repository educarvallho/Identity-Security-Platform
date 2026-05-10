#!/usr/bin/env bash
# Checks health of all IAM platform containers and Docker networks.
set -uo pipefail

FAILED=0

check_container() {
    local name=$1
    local status health
    status=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo "not_found")
    health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}N/A{{end}}' \
        "$name" 2>/dev/null || echo "N/A")

    if [ "$status" = "running" ]; then
        printf "  %-22s %-10s health: %s\n" "$name" "[OK]" "$health"
    else
        printf "  %-22s %-10s status: %s\n" "$name" "[FAIL]" "$status"
        FAILED=$((FAILED + 1))
    fi
}

echo "=== IAM Platform Health Check ==="
echo ""
echo "--- Data Layer ---"
check_container postgres-auth
check_container redis-auth

echo ""
echo "--- Identity Layer ---"
check_container keycloak
check_container infisical
check_container smtp-relay

echo ""
echo "--- Edge Layer ---"
check_container nginx
check_container cloudflared

echo ""
echo "--- Monitoring ---"
check_container loki
check_container grafana
check_container uptime-kuma

echo ""
echo "--- Docker Networks ---"
for net in edge-network auth-network db-auth-network monitoring-network backup-network; do
    if docker network inspect "$net" &>/dev/null; then
        printf "  %-28s [OK]\n" "$net"
    else
        printf "  %-28s [MISSING]\n" "$net"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
if [ "$FAILED" -eq 0 ]; then
    echo "=== All checks passed ==="
else
    echo "=== $FAILED check(s) FAILED ==="
    exit 1
fi
