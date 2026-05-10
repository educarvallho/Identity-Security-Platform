# Arquitetura da Plataforma IAM

## Visão Geral

A Identity Security Platform é uma plataforma self-hosted de identidade e gerenciamento de segredos, construída sobre Docker Compose com segregação de redes e princípio de menor privilégio. Todo tráfego externo entra via Cloudflare Tunnel, eliminando portas públicas abertas na VPS.

## Componentes

| Componente      | Função                                        | Imagem                              |
|-----------------|-----------------------------------------------|-------------------------------------|
| Keycloak        | SSO, MFA obrigatório, OIDC/SAML, gestão IAM   | quay.io/keycloak/keycloak:24.0      |
| Infisical       | Secrets centralizados, rotação, auditoria     | infisical/infisical:latest-postgres |
| PostgreSQL      | Persistência do Keycloak e Infisical          | postgres:15-alpine                  |
| Redis           | Cache de sessões (ephemeral)                  | redis:7-alpine                      |
| Nginx           | Reverse proxy, TLS termination, headers       | nginx:1.25-alpine                   |
| cloudflared     | Tunnel Zero Trust — sem portas públicas       | cloudflare/cloudflared:latest       |
| SMTP Relay      | Relay de e-mail interno → Microsoft 365       | boky/postfix:latest                 |
| Grafana         | Dashboards, OIDC SSO via Keycloak             | grafana/grafana:10.4.0              |
| Loki            | Logs centralizados, retenção 30 dias          | grafana/loki:2.9.4                  |
| Uptime Kuma     | Monitoramento de uptime, alertas              | louislam/uptime-kuma:1              |

## Fluxo de Tráfego

```
Internet → Cloudflare (WAF + DDoS + Zero Trust)
               ↓
          cloudflared (edge-network)
               ↓
            nginx (edge-network + auth-network + monitoring-network)
               ↓
    ┌──────────┴──────────┬──────────────┐
keycloak            infisical         grafana
(auth + db-auth)  (auth + db-auth)  (monitoring + auth)
    ↓                  ↓
postgres-auth      redis-auth
(db-auth + backup)  (auth-network)
```

## Ordem de Dependência

```
postgres-auth → redis-auth → smtp-relay → keycloak → infisical → nginx → cloudflared → monitoring
```

Gerenciada pelo `scripts/up.sh` com healthchecks automáticos.

## Redes Docker

Veja: [redes.md](redes.md)

## Segurança

Veja: [security.md](security.md)

## Backup e Recovery

Veja: [backup.md](backup.md) e [disaster-recovery.md](disaster-recovery.md)

## Roadmap de Produção

Arquitetura atual: single-host Docker Compose (ideal para dev/MVP).

Evolução planejada para multi-VPS:
- VPS 1 — Edge Layer: cloudflared + nginx
- VPS 2 — Identity Tier (TIER 0): keycloak + infisical + redis + smtp-relay
- VPS 3 — PostgreSQL Primary
- VPS 4 — PostgreSQL Replica (streaming replication)
- VPS 5+ — Applications

A estrutura por serviço (`infra/<service>/`) já prepara essa migração: mover um serviço é copiar o diretório e atualizar referências de rede.
