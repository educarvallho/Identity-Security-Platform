#!/usr/bin/env bash
# Restores PostgreSQL Auth from an encrypted (.dump.gpg) or plain (.sql) backup.
# Usage: restore.sh <path-to-backup-file>
set -euo pipefail

BACKUP_FILE="${1:?ERROR: Usage: restore.sh <backup-file>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$ROOT_DIR/.env" ]; then
    set -a; source "$ROOT_DIR/.env"; set +a
fi

echo "=== IAM Platform Restore ==="
echo "  Source: $BACKUP_FILE"

TMP_SQL="/tmp/iam_restore_$$.sql"

if [[ "$BACKUP_FILE" == *.gpg ]]; then
    echo "[1/3] Decrypting backup..."
    gpg --decrypt \
        --passphrase "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY required for .gpg files}" \
        --batch --yes \
        "$BACKUP_FILE" > "$TMP_SQL"
else
    echo "[1/3] Using plaintext backup (no decryption)..."
    cp "$BACKUP_FILE" "$TMP_SQL"
fi

echo "[2/3] Restoring to PostgreSQL Auth..."
echo "  WARNING: This will overwrite existing data. Press Ctrl+C to cancel (5s)..."
sleep 5
docker exec -i postgres-auth psql -U "${POSTGRES_AUTH_USER}" < "$TMP_SQL"

echo "[3/3] Validating restored databases..."
DB_COUNT=$(docker exec postgres-auth psql -U "${POSTGRES_AUTH_USER}" -t -c \
    "SELECT count(*) FROM pg_database WHERE datname IN ('keycloak_db','infisical_db');" \
    | tr -d '[:space:]')

if [ "$DB_COUNT" -ge 2 ]; then
    echo "  [OK] keycloak_db and infisical_db present"
else
    echo "  WARNING: Expected databases not found — verify restore manually"
fi

rm -f "$TMP_SQL"
echo ""
echo "=== Restore complete. Start services: bash scripts/up.sh ==="
