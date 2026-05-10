# Onboarding — Setup Inicial do Zero

## Pré-requisitos

| Requisito          | Versão mínima | Como verificar              |
|--------------------|---------------|-----------------------------|
| Ubuntu Server      | 24.04 LTS     | `lsb_release -a`            |
| Docker Engine      | 25.0+         | `docker --version`          |
| Docker Compose     | v2.24+        | `docker compose version`    |
| Cloudflare         | Conta + domínio gerenciado | Dashboard Cloudflare |
| Azure AD           | Acesso ao App Registration | Portal Azure     |

## 1. Instalar Docker (Ubuntu 24.04)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

## 2. Clonar o Repositório

```bash
git clone <repo-url> /opt/iam-platform
cd /opt/iam-platform
```

## 3. Configurar o Ambiente

```bash
cp .env.template .env
nano .env  # Substitua TODOS os valores CHANGE_ME
```

**Geração de valores seguros:**

```bash
# Senhas fortes (use uma por variável de senha)
openssl rand -base64 32

# INFISICAL_ENCRYPTION_KEY — exatamente 32 hex chars
openssl rand -hex 16

# INFISICAL_AUTH_SECRET — mínimo 32 chars
openssl rand -base64 32
```

## 4. Configurar Cloudflare Tunnel

```bash
# Instalar cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared

# Autenticar (abre browser)
cloudflared tunnel login

# Criar tunnel
cloudflared tunnel create platform

# Criar rotas DNS (substitua YOUR_DOMAIN.com)
cloudflared tunnel route dns platform sso.YOUR_DOMAIN.com
cloudflared tunnel route dns platform secrets.YOUR_DOMAIN.com
cloudflared tunnel route dns platform monitoring.YOUR_DOMAIN.com
cloudflared tunnel route dns platform status.YOUR_DOMAIN.com

# Obter token e adicionar ao .env como CLOUDFLARE_TUNNEL_TOKEN
cloudflared tunnel token platform
```

## 5. Configurar SMTP (Microsoft 365)

1. No **Portal Azure** → Azure Active Directory → App Registrations → New Registration
2. Nome: `iam-smtp-relay`, tipo de conta: **single tenant**
3. Certificados e segredos → Novo segredo → copie para `SMTP_CLIENT_SECRET`
4. No Exchange Admin Center → Connectors → criar conector "From your app" → configurar TLS
5. Opcional: para XOAUTH2 real, configure permissões `SMTP.Send` na App Registration

Enquanto não implementar XOAUTH2 completo, use uma conta de serviço com App Password:
```
SMTP_USERNAME=noreply@YOUR_DOMAIN.com
SMTP_PASSWORD=<App Password gerado no M365>
```

## 6. Subir a Plataforma

```bash
bash scripts/up.sh
```

Aguarde todos os serviços ficarem healthy (~3–5 minutos).

## 7. Configurar Keycloak (Primeiro Acesso)

1. Acesse `https://sso.YOUR_DOMAIN.com/admin`
2. Login: `KC_ADMIN_USER` / `KC_ADMIN_PASSWORD` (do `.env`)
3. **Criar realm:** Administration → Create Realm → Import `infra/keycloak/realm-export.json`
4. **Verificar MFA:** Authentication → Required Actions → "Configure OTP" deve estar com Default ON
5. **Criar usuário admin:** Users → Create User → atribuir role `admin`
6. **Configurar client Grafana:** Clients → grafana → atualizar secret com `GRAFANA_OIDC_CLIENT_SECRET` do `.env`
7. **Testar MFA:** Logout e login com o novo usuário — TOTP será exigido

## 8. Configurar Infisical (Primeiro Acesso)

1. Acesse `https://secrets.YOUR_DOMAIN.com`
2. Crie a conta de administrador (primeiro usuário é admin automático)
3. Crie organização e projetos (ex: `platform-dev`, `platform-prod`)
4. Opcional: Configure SAML/OIDC via Keycloak em Settings → SSO

## 9. Configurar Grafana

1. Acesse `https://monitoring.YOUR_DOMAIN.com`
2. Login inicial: `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` (do `.env`)
3. Loki já está pré-configurado como datasource
4. Para ativar SSO via Keycloak: confirme que `GRAFANA_OIDC_CLIENT_SECRET` no `.env` corresponde ao segredo configurado no client Keycloak

## 10. Configurar Backup Automático

```bash
crontab -e
```

Adicione:
```cron
# Backup diário às 02:00
0 2 * * * /opt/iam-platform/scripts/backup.sh >> /var/log/iam-backup.log 2>&1
```

## 11. Verificação Final

```bash
bash scripts/healthcheck.sh
```

Todos os containers devem aparecer como `[OK]` com health `healthy`.
