#!/usr/bin/env bash
# Encrypted backup of PostgreSQL Auth and Keycloak realm export.
# Required env vars: POSTGRES_AUTH_USER, BACKUP_DIR, BACKUP_ENCRYPTION_KEY, BACKUP_RETENTION_DAYS, KC_REALM
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$ROOT_DIR/.env" ]; then
    set -a; source "$ROOT_DIR/.env"; set +a
fi

BACKUP_DIR="${BACKUP_DIR:-/opt/backups/iam-platform}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DATE=$(date +%Y%m%d_%H%M%S)
TMP_SQL="/tmp/iam_backup_${DATE}.sql"

mkdir -p "$BACKUP_DIR"
echo "=== IAM Platform Backup — $DATE ==="

echo "[1/4] Dumping PostgreSQL Auth (all databases)..."
docker exec postgres-auth pg_dumpall -U "${POSTGRES_AUTH_USER}" > "$TMP_SQL"
echo "  Dump size: $(du -sh "$TMP_SQL" | cut -f1)"

echo "[2/4] Exporting Keycloak realm..."
docker exec keycloak /opt/keycloak/bin/kc.sh export \
    --file "/tmp/realm-export-${DATE}.json" \
    --realm "${KC_REALM:-platform}" \
    --users realm_file 2>/dev/null \
    && docker cp "keycloak:/tmp/realm-export-${DATE}.json" \
       "$BACKUP_DIR/realm-export_${DATE}.json" \
    && docker exec keycloak rm -f "/tmp/realm-export-${DATE}.json" \
    || echo "  WARNING: Keycloak realm export failed (service may not be running)"

echo "[3/4] Encrypting and storing backup..."
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    gpg --symmetric --cipher-algo AES256 \
        --passphrase "${BACKUP_ENCRYPTION_KEY}" \
        --batch --yes \
        -o "$BACKUP_DIR/postgres-auth_${DATE}.dump.gpg" \
        "$TMP_SQL"
    rm -f "$TMP_SQL"
    echo "  Saved (encrypted): $BACKUP_DIR/postgres-auth_${DATE}.dump.gpg"
else
    mv "$TMP_SQL" "$BACKUP_DIR/postgres-auth_${DATE}.sql"
    echo "  WARNING: BACKUP_ENCRYPTION_KEY not set — backup NOT encrypted"
    echo "  Saved: $BACKUP_DIR/postgres-auth_${DATE}.sql"
fi

echo "[4/4] Removing backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*.dump.gpg" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.sql" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "realm-export_*.json" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

echo ""
echo "=== Backup complete ==="
ls -lh "$BACKUP_DIR"
