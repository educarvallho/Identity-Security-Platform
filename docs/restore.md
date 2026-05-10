# Procedimento de Restore

## Pré-requisitos

- Arquivo de backup disponível (`.dump.gpg` ou `.sql`)
- Variável `BACKUP_ENCRYPTION_KEY` configurada no `.env`
- Docker em execução: `docker info`
- Redes Docker criadas: `bash scripts/create-networks.sh`

## Restore Completo (Recuperação Total)

```bash
# 1. Parar todos os serviços
bash scripts/down.sh

# 2. Subir apenas PostgreSQL
docker compose -f infra/postgres-auth/docker-compose.yml up -d

# 3. Aguardar PostgreSQL ficar healthy
echo "Aguardando postgres-auth..."
until docker inspect --format='{{.State.Health.Status}}' postgres-auth 2>/dev/null | grep -q "healthy"; do
    sleep 5
done
echo "postgres-auth pronto."

# 4. Executar restore
bash scripts/restore.sh /opt/backups/iam-platform/postgres-auth_YYYYMMDD_HHMMSS.dump.gpg

# 5. Subir plataforma completa
bash scripts/up.sh
```

## Restore do Realm Keycloak

Use quando precisar restaurar apenas a configuração IAM sem restaurar o banco completo:

```bash
# Copiar realm export para o container
docker cp /opt/backups/iam-platform/realm-export_YYYYMMDD.json \
    keycloak:/tmp/realm-export.json

# Importar (Keycloak deve estar rodando e healthy)
docker exec keycloak /opt/keycloak/bin/kc.sh import \
    --file /tmp/realm-export.json \
    --override true
```

## Restore Parcial (Apenas um Banco)

```bash
# Descriptografar backup
gpg --decrypt --passphrase "$BACKUP_ENCRYPTION_KEY" --batch \
    /opt/backups/iam-platform/postgres-auth_YYYYMMDD.dump.gpg > /tmp/restore.sql

# Restaurar apenas keycloak_db
docker exec -i postgres-auth pg_restore \
    -U postgres -d keycloak_db --clean --if-exists < /tmp/restore.sql

rm -f /tmp/restore.sql
```

## Validação Pós-Restore

```bash
# Healthcheck geral
bash scripts/healthcheck.sh

# Verificar databases
docker exec postgres-auth psql -U postgres -c "\l" | grep -E "(keycloak_db|infisical_db)"

# Keycloak responde
curl -sf https://sso.YOUR_DOMAIN.com/health/ready && echo "Keycloak OK"

# Infisical responde
curl -sf https://secrets.YOUR_DOMAIN.com/api/status && echo "Infisical OK"

# Verificar usuários Keycloak (requer autenticação)
docker exec keycloak /opt/keycloak/bin/kcadm.sh get users \
    --server http://localhost:8080 \
    --realm platform \
    --user admin --password "$KC_ADMIN_PASSWORD" \
    --fields username,enabled | head -20
```

## Estimativas RTO/RPO

| Cenário                   | Tempo Estimado | RPO     |
|---------------------------|----------------|---------|
| Restart de container      | < 5 minutos    | Zero    |
| Restore de volume corrompido | 20–45 minutos | 24h máx |
| Rebuild VPS completo      | 2–4 horas      | 24h máx |

## Troubleshooting

**Erro: "BACKUP_ENCRYPTION_KEY required"**
→ Certifique-se de que o `.env` está no diretório raiz do repositório.

**Erro: "role already exists" durante restore**
→ É normal em pg_dumpall. O restore continua e os dados são restaurados.

**Keycloak não inicia após restore**
→ Verifique se `keycloak_db` foi corretamente restaurado:
```bash
docker exec postgres-auth psql -U postgres -c "\c keycloak_db; \dt" | head -20
```
