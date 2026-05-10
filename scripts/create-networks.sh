#!/usr/bin/env bash
# Creates the 5 Docker networks for the IAM platform.
# Idempotent: safe to run multiple times.
set -euo pipefail

NETWORKS=(
    "edge-network"
    "auth-network"
    "db-auth-network"
    "monitoring-network"
    "backup-network"
)

echo "=== Creating Docker networks ==="
for network in "${NETWORKS[@]}"; do
    if docker network inspect "$network" &>/dev/null; then
        echo "  [EXISTS]  $network"
    else
        docker network create "$network"
        echo "  [CREATED] $network"
    fi
done
echo "=== Networks ready ==="
