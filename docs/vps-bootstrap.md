# VPS Bootstrap — Deploy em Novo Servidor

Processo padronizado para provisionar qualquer VPS do zero até a plataforma rodando. Baseado no processo real de bootstrap do servidor de treinamento (Hetzner Debian 13, Maio 2026).

**Tempo estimado:** 15–20 minutos (excluindo pull de imagens Docker)

---

## Visão Geral

```
VPS criada pelo provedor
        ↓
[01] 01-harden-vps.sh     ← roda como root
        ↓
  Verificar SSH como deploy
        ↓
[01 --finalize]            ← desativa root
        ↓
[02] 02-setup-repo.sh     ← roda como deploy
        ↓
[03] 03-generate-env.sh   ← roda como deploy, na raiz do repo
        ↓
   bash scripts/up.sh
        ↓
   bash scripts/healthcheck.sh
```

---

## Pré-requisitos (fora do servidor)

Antes de iniciar, você precisa ter em mãos:

| Item | Onde obter |
|------|-----------|
| IP do servidor | Painel do provedor (Hetzner, DigitalOcean, etc.) |
| Sua chave SSH pública | `cat ~/.ssh/id_ed25519.pub` |
| Domínio com DNS na Cloudflare | Dashboard Cloudflare |
| Token do Cloudflare Tunnel | Ver seção abaixo |

### Obter o token do Cloudflare Tunnel

No Cloudflare Zero Trust Dashboard (one.dash.cloudflare.com):

1. **Networks → Tunnels → Create a tunnel**
2. Tipo: **Cloudflared**
3. Dê um nome (ex: `platform-prod`)
4. Em **Install connector**, copie o token do comando mostrado:
   ```
   cloudflared service install eyJhIjoiYzlk...
   ```
   O token é a string longa após `service install` — salve-a.
5. Configure os **Public Hostnames** (após o tunnel estar ativo):
   - `sso.SEU_DOMINIO.com` → `http://nginx:80`
   - `secrets.SEU_DOMINIO.com` → `http://nginx:80`
   - `monitoring.SEU_DOMINIO.com` → `http://nginx:80`
   - `status.SEU_DOMINIO.com` → `http://nginx:80`

---

## Passo 1 — Adicionar sua chave SSH ao servidor

O provedor geralmente oferece isso na criação da VPS. Se não:

```bash
# Da sua máquina local:
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@<IP_DO_SERVIDOR>

# Ou manualmente:
ssh root@<IP_DO_SERVIDOR> "mkdir -p ~/.ssh && echo '<SUA_CHAVE_PUBLICA>' >> ~/.ssh/authorized_keys"
```

---

## Passo 2 — Hardening do servidor

```bash
# Conecte como root:
ssh root@<IP_DO_SERVIDOR>

# Baixe e rode o script de hardening:
curl -fsSL https://raw.githubusercontent.com/educarvallho/Identity-Security-Platform/main/scripts/bootstrap/01-harden-vps.sh -o 01-harden-vps.sh
bash 01-harden-vps.sh
```

O script faz automaticamente:
- `apt update && apt upgrade`
- Instala: `curl git ufw fail2ban python3 ca-certificates gnupg`
- NTP: configura `time.cloudflare.com` como servidor primário
- SSH: desativa autenticação por senha, X11 forwarding, MaxAuthTries 3
- Cria usuário `deploy` com sudo + docker, copia authorized_keys do root
- Instala Docker Engine (repositório oficial)
- UFW: deny incoming, allow outgoing, allow SSH
- fail2ban: sshd jail, bantime 24h, maxretry 3

### Verificar e finalizar

**Em um terminal separado**, teste o acesso como deploy:

```bash
ssh deploy@<IP_DO_SERVIDOR>
# Deve entrar sem senha e sem solicitar password
```

Após confirmar o acesso, desative o root (de dentro do servidor como root):

```bash
bash 01-harden-vps.sh --finalize
# PermitRootLogin no + passwd -l root
```

---

## Passo 3 — Clonar o repositório

```bash
# Como deploy no servidor:
ssh deploy@<IP_DO_SERVIDOR>

curl -fsSL https://raw.githubusercontent.com/educarvallho/Identity-Security-Platform/main/scripts/bootstrap/02-setup-repo.sh -o 02-setup-repo.sh
bash 02-setup-repo.sh
```

O script:
- Clona o repo em `/opt/iam-platform`
- Configura identidade git (pergunta nome e email)
- Gera chave SSH ed25519 (se não existir) para push ao GitHub
- Mostra a chave pública para adicionar no GitHub (Settings → SSH keys)

---

## Passo 4 — Gerar o `.env`

```bash
cd /opt/iam-platform
bash scripts/bootstrap/03-generate-env.sh
```

O script pede **3 inputs**:

| Input | Exemplo |
|-------|---------|
| Domínio | `minha-empresa.com` |
| Cloudflare Tunnel Token | `eyJhIjoiYzlk...` |
| Senha admin Keycloak | (Enter para auto-gerar) |

E auto-gera todos os demais secrets:
- `POSTGRES_AUTH_PASSWORD` — base64
- `KC_DB_PASSWORD` — base64
- `INFISICAL_DB_PASSWORD` — **hex** (obrigatório, vai em URL)
- `REDIS_PASSWORD` — **hex** (obrigatório, vai em URL)
- `INFISICAL_ENCRYPTION_KEY` — hex 16 bytes (32 chars exatos)
- `INFISICAL_AUTH_SECRET` — base64
- `GRAFANA_ADMIN_PASSWORD` — base64
- `BACKUP_ENCRYPTION_KEY` — base64

> **Salve as senhas geradas.** O `.env` fica em `/opt/iam-platform/.env` com `chmod 600` e está no `.gitignore`.

Secrets deixados como `CHANGE_ME` propositalmente (configuração posterior):
- SMTP / Microsoft 365 credentials
- Azure AD OAuth2 (SMTP upgrade path)
- Grafana OIDC client secret (integração Keycloak → deferred)

---

## Passo 5 — Subir a plataforma

```bash
cd /opt/iam-platform
bash scripts/up.sh
```

Ordem de startup automática (9 etapas):
1. Cria redes Docker (idempotente)
2. PostgreSQL Auth → aguarda healthy
3. Redis Auth
4. SMTP Relay
5. Keycloak → aguarda healthy (até 360s — inclui build phase)
6. Infisical
7. Loki + Uptime Kuma → aguarda Loki healthy
8. Nginx → aguarda healthy → Cloudflare Tunnel
9. Promtail + Prometheus → aguarda healthy → Node Exporter → Grafana → aguarda healthy

---

## Passo 6 — Verificar saúde

```bash
bash scripts/healthcheck.sh
# Esperado: 13/13 containers healthy, 5/5 redes OK
```

---

## Passo 7 — Configuração inicial dos serviços

### Keycloak

1. Acesse `https://sso.SEU_DOMINIO.com/admin`
2. Login: `admin` / senha gerada no passo 4
3. Importe o realm: **Manage → Import realm** → `infra/keycloak/realm-export.json`
4. O realm `platform` já vem configurado com MFA obrigatório (TOTP)

### Infisical

1. Acesse `https://secrets.SEU_DOMINIO.com`
2. **Crie a primeira conta** — ela automaticamente se torna admin
3. (Opcional) Integre com Keycloak via Settings → SSO → OIDC

### Grafana

1. Acesse `https://monitoring.SEU_DOMINIO.com`
2. Login: `admin` / senha gerada no passo 4
3. Datasources já pré-configurados (Loki e Prometheus via provisioning)

---

## Decisões de Design documentadas

### Por que `X-Forwarded-Proto https` hardcoded no nginx (Keycloak)?

Cloudflare termina o TLS e conecta ao nginx via HTTP. O `$scheme` do nginx seria `http`, fazendo o Keycloak gerar URLs internas como `http://...`. O Admin UI é uma SPA que chama essas URLs — o browser bloqueia como *mixed content* (HTTPS page + HTTP API). Fix: hardcodar `https` no header, já que toda requisição legítima chega via Cloudflare.

### Por que hex nas senhas do Redis e Infisical DB?

Essas senhas são embutidas em URLs de conexão (`redis://:SENHA@host`, `postgresql://user:SENHA@host`). Caracteres base64 como `+`, `/` e `=` quebram o parser de URL sem percent-encoding. Hex usa apenas `[0-9a-f]` — seguro em qualquer contexto.

### Por que `INFISICAL_ENCRYPTION_KEY` com `openssl rand -hex 16`?

O Infisical exige exatamente 32 caracteres hexadecimais para esta chave. `openssl rand -hex 16` gera 16 bytes = 32 chars hex. `openssl rand -base64 32` geraria 44 chars (32 bytes em base64) — formato errado.

### Ordem do startup (loki + uptime-kuma antes do nginx)

O nginx resolve hostnames Docker em tempo de startup. Se `uptime-kuma` não estiver rodando quando o nginx inicia, o bloco `upstream uptime_kuma_backend` falha na resolução DNS do Docker → nginx entra em crash loop. Solução: subir `loki` e `uptime-kuma` (step 7) antes do nginx (step 8).

---

## Troubleshooting

### Keycloak: login carrega mas tela não aparece (spinner infinito)

**Causa:** `X-Forwarded-Proto: http` chegando ao Keycloak com `KC_HOSTNAME_STRICT_HTTPS=true`.
**Fix:** Em `infra/nginx/conf.d/keycloak.conf`, confirme `proxy_set_header X-Forwarded-Proto https;` (hardcoded, não `$scheme`).

### nginx crash loop no startup

**Causa:** Container referenciado em bloco `upstream` ainda não está rodando.
**Fix:** Confirme a ordem do `up.sh` — todos os containers em blocos `upstream` do nginx devem iniciar antes do nginx.

### promtail sempre `unhealthy`

**Causa:** A imagem `grafana/promtail:2.9.4` não tem `wget` ou `curl`.
**Fix:** Healthcheck via `/proc/net/tcp6`: `grep -q :2378 /proc/net/tcp6` (porta 9080 = `0x2378` hex).

### fail2ban bloqueou seu IP

```bash
# No servidor via console do provedor:
fail2ban-client set sshd unbanip <SEU_IP>
```

---

## Checklist de Deploy

```
[ ] VPS criada, chave SSH do deploy adicionada
[ ] 01-harden-vps.sh executado com sucesso
[ ] SSH como deploy funciona em terminal separado
[ ] 01-harden-vps.sh --finalize executado (root desativado)
[ ] 02-setup-repo.sh executado, repo em /opt/iam-platform
[ ] Chave SSH do deploy adicionada ao GitHub (se necessário push do servidor)
[ ] 03-generate-env.sh executado, .env gerado
[ ] Senhas geradas salvas em local seguro (Infisical, 1Password, etc.)
[ ] Tunnel configurado no dashboard Cloudflare (public hostnames)
[ ] bash scripts/up.sh executado com sucesso
[ ] bash scripts/healthcheck.sh: 13/13 healthy
[ ] Keycloak acessível em https://sso.SEU_DOMINIO.com/admin
[ ] Realm importado e admin testado
[ ] Infisical acessível, conta admin criada
[ ] Grafana acessível, datasources OK
[ ] Backup configurado no crontab
```
