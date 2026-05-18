# CLAUDE.md — Identity Security Platform

## Visão Geral do Projeto

Plataforma enterprise self-hosted de identidade, autenticação, gerenciamento de segredos e observabilidade. Projeto de portfólio público no GitHub: `https://github.com/educarvallho/Identity-Security-Platform`

**Stack:**
- IAM: Keycloak 24 (SSO, MFA obrigatório, OIDC/SAML)
- Secrets: Infisical (latest-postgres)
- Banco: PostgreSQL 15-alpine (dois DBs: keycloak_db, infisical_db)
- Cache: Redis 7-alpine (ephemeral — sem persistência)
- Proxy: Nginx 1.25-alpine (reverse proxy + security headers)
- Tunnel: cloudflare/cloudflared (Zero Trust, sem portas expostas)
- SMTP: boky/postfix relay → Microsoft 365 (smtp.office365.com:587)
- Monitoring: Grafana 10.4 + Loki 2.9.4 + Promtail 2.9.4 + Prometheus 2.51.0 + Node Exporter 1.8.0 + Uptime Kuma 1
- Deploy: Docker Compose v2 (um docker-compose.yml por serviço)
- Host alvo: Ubuntu Server 24.04 LTS

---

## Estrutura do Repositório

```
Identity-Security-Platform/
├── infra/
│   ├── cloudflared/          # Cloudflare Tunnel (edge-network)
│   ├── nginx/                # Reverse proxy + conf.d/ + ssl/
│   ├── keycloak/             # IAM + realm-export.json
│   │   ├── docker-compose.yml
│   │   └── docker-compose.dev.yml   # start-dev, porta 8180, KC_HOSTNAME_PORT=8180
│   ├── postgres-auth/        # PostgreSQL + init/01-init-databases.sh
│   ├── redis-auth/           # Redis ephemeral
│   ├── smtp-relay/           # Postfix → M365
│   ├── infisical/            # Secrets manager
│   │   ├── docker-compose.yml
│   │   └── docker-compose.dev.yml   # porta 8181, SITE_URL=http://localhost:8181
│   └── monitoring/
│       ├── grafana/
│       │   ├── docker-compose.yml
│       │   ├── docker-compose.dev.yml   # porta 3001
│       │   └── provisioning/
│       │       └── datasources/         # loki.yaml + prometheus.yaml
│       ├── loki/             # + loki-config.yaml
│       ├── promtail/         # + promtail-config.yaml
│       ├── prometheus/       # + prometheus.yml (30d retention)
│       ├── node-exporter/
│       └── uptime-kuma/
├── scripts/
│   ├── create-networks.sh    # Cria 5 redes Docker (idempotente)
│   ├── up.sh                 # Boot completo em ordem de dependência
│   ├── down.sh               # Shutdown reverso
│   ├── dev-up.sh             # Startup local — wait_keycloak usa curl no host :8180
│   ├── backup.sh             # pg_dumpall + realm export + GPG AES256
│   ├── restore.sh            # GPG decrypt + psql restore
│   └── healthcheck.sh        # Verifica 13 containers + 5 redes
├── docs/
│   ├── IMG/diagrama-visual.png   # Diagrama usado no README (sem espaços no nome)
│   ├── TXT/                      # Arquivos de referência originais (gitignored)
│   ├── arquitetura.md
│   ├── redes.md
│   ├── backup.md
│   ├── restore.md
│   ├── onboarding.md
│   ├── security.md
│   └── disaster-recovery.md
├── apps/
│   └── weather-dashboard/    # Sistema de testes FastAPI+Next.js (removível)
├── .env.template             # Template com placeholders CHANGE_ME_*
└── README.md
```

---

## Redes Docker (5 redes segregadas)

| Rede               | Containers                                               |
|--------------------|----------------------------------------------------------|
| edge-network       | cloudflared, nginx                                       |
| auth-network       | nginx, keycloak, smtp-relay, redis-auth, infisical       |
| db-auth-network    | keycloak, infisical, postgres-auth                       |
| monitoring-network | grafana, loki, promtail, prometheus, node-exporter, uptime-kuma, nginx |
| backup-network     | postgres-auth, infisical                                 |

**Regra:** `postgres-auth` e `redis-auth` NUNCA estão na edge-network. Deny-by-default.

---

## Portas Dev Local

| Serviço   | Host  | Container |
|-----------|-------|-----------|
| Keycloak  | 8180  | 8080      |
| Infisical | 8181  | 8080      |
| Grafana   | 3001  | 3000      |

Em produção, **nenhuma porta** é exposta ao host.

---

## Comandos Essenciais

### Dev local (sem domínio/Cloudflare)
```bash
cp .env.template .env
# Editar .env — IMPORTANTE: use hex para senhas em URLs:
#   REDIS_PASSWORD e INFISICAL_DB_PASSWORD → openssl rand -hex 32
#   Demais senhas → openssl rand -base64 32
bash scripts/dev-up.sh
# Keycloak: http://localhost:8180/admin
# Infisical: http://localhost:8181
# Grafana:   http://localhost:3001  (incluído por padrão no dev-up.sh)
```

### Quando rodar docker compose manualmente (fora do script)
```bash
# Sempre passar --env-file .env — Docker Compose procura .env na pasta do compose file,
# não na raiz do projeto quando usando -f com caminho relativo
docker compose --env-file .env -f infra/keycloak/docker-compose.yml \
  -f infra/keycloak/docker-compose.dev.yml up -d
```

### Produção (VPS com domínio)
```bash
bash scripts/up.sh          # Boot completo com wait_healthy
bash scripts/down.sh        # Shutdown
bash scripts/healthcheck.sh # Status de todos os serviços
```

### Backup / Restore
```bash
bash scripts/backup.sh
bash scripts/restore.sh /opt/backups/iam-platform/<file>.dump.gpg
```

---

## Overrides de Desenvolvimento

| Arquivo | O que faz |
|---|---|
| `infra/keycloak/docker-compose.dev.yml` | `start-dev`, porta 8180, `KC_HOSTNAME_PORT=8180`, `KC_HEALTH_ENABLED=true` |
| `infra/infisical/docker-compose.dev.yml` | Porta 8181, `SITE_URL=http://localhost:8181` |
| `infra/monitoring/grafana/docker-compose.dev.yml` | Porta 3001, desativa OIDC |

---

## Variáveis de Ambiente — Regras

```bash
openssl rand -base64 32   # senhas gerais (KC_ADMIN_PASSWORD, etc.)
openssl rand -hex 32      # REDIS_PASSWORD e INFISICAL_DB_PASSWORD (vão em URLs)
openssl rand -hex 16      # INFISICAL_ENCRYPTION_KEY (exige exatamente 32 hex chars)
```

**Por que hex para Redis e Infisical DB:** essas senhas são embutidas em URLs
(`redis://:SENHA@host` e `postgresql://user:SENHA@host`). Caracteres base64 como
`+`, `/`, `=` quebram o parser de URL sem percent-encoding.

---

## Configuração Inicial (Ordem)

1. `bash scripts/dev-up.sh` — sobe postgres + redis + keycloak + infisical
2. **Keycloak**: `http://localhost:8180/admin` → criar realm importando `infra/keycloak/realm-export.json`
3. **Infisical**: `http://localhost:8181` → primeiro registro vira admin (auth independente)
4. Opcional: integrar SSO via Infisical Settings → SSO (OIDC apontando para Keycloak)
5. **Grafana** (opcional): `docker compose --env-file .env -f infra/monitoring/grafana/docker-compose.yml -f infra/monitoring/grafana/docker-compose.dev.yml up -d` → `http://localhost:3001`

---

## Decisões de Design

### Keycloak — modo produção vs dev
- **Produção** (`command: start`): passa por build/otimização (~12s), hostname estrito, HTTPS exigido.
- **Dev** (`command: start-dev` no override): sem build, sem HTTPS, inicia em ~5s. O banco continua sendo o postgres-auth — só as validações de produção são relaxadas.

### Keycloak — geração de URLs (KC_HOSTNAME_PORT)
`KC_HOSTNAME=localhost` sem porta → Keycloak gera URLs com porta 80 (padrão HTTP).
O Admin UI é uma SPA que usa essas URLs para chamar a API — se a porta estiver errada, o UI carrega mas não funciona.
**Fix:** `KC_HOSTNAME_PORT=8180` no dev override.

### Keycloak — healthcheck
A imagem `quay.io/keycloak/keycloak:24.0` usa `ubi9-micro` como base — não tem `curl` nem `wget`.
O docker-compose.yml usa `bash -c 'exec 3<>/dev/tcp/localhost/8080'` (TCP puro).
O `dev-up.sh` usa `wait_keycloak()` que faz curl do HOST em `/realms/master` (mais confiável).

### Keycloak — env vars e docker compose
O Docker Compose busca `.env` na pasta do arquivo compose quando usa `-f caminho/relativo`.
Scripts (`dev-up.sh`, `up.sh`) fazem `source .env` antes de chamar docker compose.
Comandos manuais precisam de `--env-file .env`.

### Autenticações independentes
Keycloak e Infisical têm logins separados por padrão. A integração SSO é opcional e feita depois via Infisical Settings → SSO.

### Restart automático
`restart: unless-stopped` em todos os containers. `up.sh` usa `wait_healthy` com timeout.

### PostgreSQL init
Script shell em `docker-entrypoint-initdb.d/` para substituição de env vars na criação dos dois bancos (`keycloak_db`, `infisical_db`) e usuários dedicados. Roda apenas na primeira inicialização do volume.

### Redis ephemeral
`--save "" --appendonly no` — sem persistência. `read_only: true` no container.

### Nginx buffers
`proxy_buffer_size 128k` para Keycloak (tokens JWT grandes).

### Diagrama no README
`docs/IMG/diagrama-visual.png` (sem espaços). Originais em `docs/TXT/` (gitignored).

---

## Roadmap — VPS com Domínio

1. Provisionar Ubuntu 24.04 + Docker
2. `cloudflared tunnel create platform` → obter token
3. Preencher `.env` com domínio real (substituir `YOUR_DOMAIN.com`)
4. `bash scripts/up.sh` (sem overrides dev)
5. DNS Cloudflare para 4 subdomínios: `sso`, `secrets`, `monitoring`, `status`
6. Keycloak em produção usa `command: start` (não start-dev)

Migração multi-VPS: estrutura por serviço facilita mover cada `infra/<service>/` para VPS dedicada.

---

## Status Atual

- **Keycloak**: funcionando em dev (`http://localhost:8180/admin`) ✓
- **Infisical**: container sobe (porta 8181) — configuração inicial pendente
- **Monitoramento**: implementado — Grafana + Loki + Promtail + Prometheus + Node Exporter + Uptime Kuma ✓
- **SMTP**: deixado para depois
- **Produção/VPS**: aguardando VPS disponível

---

## Weather Dashboard (apps/weather-dashboard/)

Sistema FastAPI + Next.js funcional (cobaia de testes IAM).
- `COMPOSE_PROJECT_NAME=weather-dashboard` para isolamento de containers
- Removível com `rm -rf apps/` após validação da integração Keycloak OIDC
