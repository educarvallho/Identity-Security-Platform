# Hardening e Segurança

## Hardening Linux (Ubuntu 24.04)

### Sistema e SSH

```bash
# Atualizar sistema completamente
apt update && apt upgrade -y && apt autoremove -y

# Configurar SSH — somente chave, sem root, sem senha
cat >> /etc/ssh/sshd_config <<EOF
PasswordAuthentication no
PermitRootLogin no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
EOF
systemctl restart ssh

# Adicionar sua chave pública antes de aplicar:
# echo "ssh-ed25519 AAAA... user@host" >> ~/.ssh/authorized_keys
```

### Firewall (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
# NÃO abrir 80 ou 443 — tráfego web vai pelo Cloudflare Tunnel
ufw enable
ufw status verbose
```

### fail2ban

```bash
apt install -y fail2ban

cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 3

[sshd]
enabled  = true
port     = ssh
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 86400
EOF

systemctl enable --now fail2ban
fail2ban-client status sshd
```

## Hardening Docker

Todas as regras já aplicadas nos `docker-compose.yml`:

| Medida                           | Implementado em       |
|----------------------------------|-----------------------|
| `no-new-privileges:true`         | Todos os containers   |
| Imagens Alpine (menor superfície)| postgres, redis, nginx|
| Redis `read_only: true`          | redis-auth            |
| Usuário não-root                 | Grafana (472), Loki (10001), cloudflared (65532), Node Exporter (65534) |
| Portas não expostas ao host       | redis, postgres, smtp, keycloak, infisical |
| Redes segregadas                 | 5 redes Docker        |
| Prometheus/Loki não expostos     | Acesso restrito à monitoring-network — sem mapeamento de portas ao host |

## MFA Obrigatório no Keycloak

Configurado em `infra/keycloak/realm-export.json` como Required Action (`CONFIGURE_TOTP`).

**Para verificar/forçar em usuários existentes:**

```bash
# Autenticar na CLI
docker exec keycloak /opt/keycloak/bin/kcadm.sh config credentials \
    --server http://localhost:8080 \
    --realm master \
    --user "$KC_ADMIN_USER" \
    --password "$KC_ADMIN_PASSWORD"

# Listar usuários sem OTP configurado
docker exec keycloak /opt/keycloak/bin/kcadm.sh get users \
    -r platform --fields username,totp | grep '"totp":false'

# Forçar configuração de OTP para todos
docker exec keycloak /opt/keycloak/bin/kcadm.sh update users/<USER_ID>/execute-actions-email \
    -r platform -s '["CONFIGURE_TOTP"]'
```

**Autenticadores recomendados:** Google Authenticator, Authy, Bitwarden Authenticator, Microsoft Authenticator.

## Rotação de Secrets

```bash
# 1. Gere novo valor
NEW_SECRET=$(openssl rand -base64 32)

# 2. Atualize no .env
sed -i "s/^KC_DB_PASSWORD=.*/KC_DB_PASSWORD=$NEW_SECRET/" .env

# 3. Atualize no banco PostgreSQL
docker exec postgres-auth psql -U postgres -c \
    "ALTER USER keycloak_user WITH PASSWORD '$NEW_SECRET';"

# 4. Reinicie o Keycloak
docker compose -f infra/keycloak/docker-compose.yml restart

# 5. Após estabilizar: migre para Infisical para gestão centralizada
```

## Auditoria

| Sistema   | Onde encontrar                                              |
|-----------|-------------------------------------------------------------|
| Keycloak  | Admin Console → Events → Login Events e Admin Events        |
| Infisical | Dashboard → Audit Logs                                      |
| Nginx     | `docker logs nginx` ou volume `nginx-logs`                  |
| Sistema   | `journalctl -u docker`, `/var/log/auth.log`, `fail2ban-client status` |

## Headers de Segurança Nginx

Configurados em todos os virtual hosts (`infra/nginx/conf.d/`):

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

## Gestão de Secrets com Infisical

Após o bootstrap inicial, migre TODOS os secrets do `.env` para o Infisical:

1. Acesse `https://secrets.YOUR_DOMAIN.com`
2. Crie projeto `iam-platform`
3. Adicione todos os secrets do `.env`
4. Configure cada serviço para buscar secrets do Infisical via SDK ou CLI

```bash
# Instalar Infisical CLI
curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | bash
apt install -y infisical

# Autenticar
infisical login

# Usar secrets ao subir serviços
infisical run -- docker compose -f infra/keycloak/docker-compose.yml up -d
```
