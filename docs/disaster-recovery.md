# Disaster Recovery

## Cenários e Procedimentos

### Cenário 1: Container caiu inesperadamente

```bash
# Identificar container
docker ps -a | grep -v "Up "

# Verificar logs do container
docker logs <container-name> --tail 50

# Reiniciar via compose
docker compose -f infra/<service>/docker-compose.yml restart

# Verificar saúde
bash scripts/healthcheck.sh
```

### Cenário 2: Banco de dados corrompido

```bash
# Parar todos os serviços
bash scripts/down.sh

# Remover volume corrompido
docker volume rm postgres-auth-data

# Recriar redes (caso necessário)
bash scripts/create-networks.sh

# Subir PostgreSQL (o init script recria os databases)
docker compose -f infra/postgres-auth/docker-compose.yml up -d

# Aguardar healthy
until docker inspect --format='{{.State.Health.Status}}' postgres-auth | grep -q "healthy"; do sleep 5; done

# Restaurar do backup mais recente
ls -lt /opt/backups/iam-platform/*.dump.gpg | head -1
bash scripts/restore.sh /opt/backups/iam-platform/<backup-mais-recente>.dump.gpg

# Subir plataforma completa
bash scripts/up.sh
```

### Cenário 3: Keycloak não inicializa

**Diagnóstico:**
```bash
docker logs keycloak --tail 100 | grep -iE "(error|fatal|exception)"
```

**Causas comuns:**
- Banco indisponível → verifique `docker logs postgres-auth --tail 20`
- Credenciais erradas → verifique `KC_DB_USER` e `KC_DB_PASSWORD` no `.env`
- Certificado TLS inválido → verifique `KC_HOSTNAME` no `.env`
- Falta memória → verifique `docker stats keycloak`

```bash
# Aguardar postgres antes de subir Keycloak (up.sh faz isso automaticamente)
docker compose -f infra/postgres-auth/docker-compose.yml up -d
until docker inspect --format='{{.State.Health.Status}}' postgres-auth | grep -q "healthy"; do sleep 5; done
docker compose -f infra/keycloak/docker-compose.yml up -d
```

### Cenário 4: Perda total do servidor

```bash
# ===== NO NOVO SERVIDOR =====

# 1. Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 2. Clonar repositório
git clone <repo-url> /opt/iam-platform
cd /opt/iam-platform

# 3. Restaurar .env de backup seguro (cofre de senhas, Infisical backup, etc.)
# cp <.env-backup> .env

# 4. Copiar backups do storage offsite
# rsync -av user@storage-box:/iam-platform-backup/ /opt/backups/iam-platform/

# 5. Criar redes Docker
bash scripts/create-networks.sh

# 6. Subir PostgreSQL e restaurar
docker compose -f infra/postgres-auth/docker-compose.yml up -d
until docker inspect --format='{{.State.Health.Status}}' postgres-auth | grep -q "healthy"; do sleep 5; done
bash scripts/restore.sh /opt/backups/iam-platform/<backup-mais-recente>.dump.gpg

# 7. Subir plataforma completa
bash scripts/up.sh

# 8. Verificar
bash scripts/healthcheck.sh
```

### Cenário 5: Secret comprometido

```bash
# 1. Identificar secret comprometido (ex: KC_DB_PASSWORD)
# 2. Revogar imediatamente no sistema de origem

# 3. Gerar novo valor
NEW_PASS=$(openssl rand -base64 32)

# 4. Atualizar no banco (se for credencial de DB)
docker exec postgres-auth psql -U postgres -c \
    "ALTER USER keycloak_user WITH PASSWORD '$NEW_PASS';"

# 5. Atualizar .env
sed -i "s/^KC_DB_PASSWORD=.*/KC_DB_PASSWORD=$NEW_PASS/" .env

# 6. Reiniciar serviço afetado
docker compose -f infra/keycloak/docker-compose.yml restart

# 7. Verificar logs de auditoria (Keycloak Events, Infisical Audit Logs)
# 8. Documentar o incidente
```

## RPO / RTO por Cenário

| Cenário                  | RTO           | RPO      | Prioridade |
|--------------------------|---------------|----------|------------|
| Restart de container     | < 5 min       | Zero     | Alta       |
| Restore de volume        | 30–60 min     | 24 horas | Alta       |
| Rebuild de VPS completa  | 2–4 horas     | 24 horas | Média      |
| Falha de rede Cloudflare | 0 (automático)| Zero     | N/A        |

## Checklist de Teste Mensal

Execute mensalmente para validar o DR:

- [ ] `bash scripts/backup.sh` — backup atual criado
- [ ] Provisionar VM temporária com Ubuntu 24.04 + Docker
- [ ] Clonar repositório na VM temporária
- [ ] Copiar backup mais recente para a VM
- [ ] `bash scripts/restore.sh <backup>` — restore executado
- [ ] `bash scripts/up.sh` — plataforma sobe corretamente
- [ ] Acessar Keycloak via browser — login funciona
- [ ] Acessar Infisical via browser — secrets visíveis
- [ ] Registrar o tempo total (RTO real)
- [ ] Destruir VM temporária
- [ ] Documentar resultado no log de DR

## Contatos de Emergência

Documente aqui os contatos para situações de incidente:
- Administrador da plataforma: `<nome>` — `<contato>`
- Provedor VPS (suporte): `<link>`
- Cloudflare suporte: dashboard.cloudflare.com → Support
