# Segregação de Redes Docker

## Visão Geral

A plataforma utiliza 5 redes Docker separadas seguindo o princípio de menor privilégio. Cada container está conectado apenas às redes estritamente necessárias. Comunicação entre redes não conectadas é bloqueada pelo Docker daemon (deny-by-default).

## Redes e Participantes

| Rede               | Containers                                                    | Acesso externo |
|--------------------|---------------------------------------------------------------|----------------|
| `edge-network`     | cloudflared, nginx                                            | Sim (cloudflared → Cloudflare) |
| `auth-network`     | nginx, keycloak, smtp-relay, redis-auth, infisical            | Não |
| `db-auth-network`  | keycloak, infisical, postgres-auth                            | Não |
| `monitoring-network`| grafana, loki, uptime-kuma, nginx                            | Não |
| `backup-network`   | postgres-auth, infisical                                      | Não |

## Criação das Redes

```bash
bash scripts/create-networks.sh
```

O script é idempotente — pode ser executado múltiplas vezes sem efeitos colaterais.

## Matriz de Comunicação

| De            | Para           | Via                  | Permitido |
|---------------|----------------|----------------------|-----------|
| cloudflared   | nginx          | edge-network         | ✅ |
| nginx         | keycloak       | auth-network         | ✅ |
| nginx         | infisical      | auth-network         | ✅ |
| nginx         | grafana        | monitoring-network   | ✅ |
| nginx         | uptime-kuma    | monitoring-network   | ✅ |
| keycloak      | postgres-auth  | db-auth-network      | ✅ |
| keycloak      | redis-auth     | auth-network         | ✅ |
| keycloak      | smtp-relay     | auth-network         | ✅ |
| infisical     | postgres-auth  | db-auth-network      | ✅ |
| infisical     | redis-auth     | auth-network         | ✅ |
| grafana       | loki           | monitoring-network   | ✅ |
| grafana       | keycloak       | auth-network         | ✅ (OIDC) |
| cloudflared   | postgres-auth  | —                    | ❌ |
| nginx         | postgres-auth  | —                    | ❌ |
| nginx         | redis-auth     | —                    | ❌ |
| redis-auth    | internet       | —                    | ❌ |
| postgres-auth | internet       | —                    | ❌ |

## Por Que Esse Design

**`postgres-auth` e `redis-auth` nunca estão na `edge-network`:** Um comprometimento do Nginx ou cloudflared não abre caminho direto ao banco ou ao cache.

**`smtp-relay` apenas em `auth-network`:** O relay aceita SMTP apenas de serviços na mesma rede interna (Keycloak e Infisical). Impossível enviar e-mails a partir da internet ou de outros containers.

**`backup-network` isolada:** Apenas os serviços que precisam de backup (`postgres-auth`, `infisical`) têm acesso. Um serviço de backup futuro (ex: Restic, rclone) será conectado apenas nessa rede.

## Troubleshooting

```bash
# Verificar redes existentes
docker network ls | grep -E "(edge|auth|db-auth|monitoring|backup)"

# Inspecionar containers de uma rede
docker network inspect auth-network --format '{{range .Containers}}{{.Name}} {{end}}'

# Testar conectividade entre containers
docker exec nginx ping -c 2 keycloak
docker exec keycloak curl -sf http://postgres-auth:5432 2>/dev/null && echo "reachable" || echo "unreachable"
```
