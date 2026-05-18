# Spec: Observabilidade Completa + Resiliência Enterprise-Grade

**Data:** 2026-05-18
**Escopo:** Identity Security Platform — `infra/monitoring/`, todos os `docker-compose.yml`, scripts e documentação
**Status:** Aprovado — pronto para implementação

---

## Contexto

A stack atual de monitoring possui apenas Grafana + Loki + Uptime Kuma, sem Promtail (coleta de logs), Prometheus (métricas) ou Node Exporter (métricas do host). Os compose files existentes carecem de `depends_on` com `condition: service_healthy` e alguns serviços não possuem healthcheck real. Esta spec cobre a expansão completa da stack de observabilidade e o endurecimento de resiliência de toda a plataforma.

---

## 1. Novos Componentes de Monitoring

### 1.1 Estrutura de diretórios

```
infra/monitoring/
├── grafana/
│   ├── docker-compose.yml        (atualizado — novo datasource Prometheus)
│   ├── docker-compose.dev.yml    (existente)
│   └── provisioning/
│       ├── datasources/
│       │   ├── loki.yaml         (existente)
│       │   └── prometheus.yaml   (novo)
│       └── dashboards/
│           └── dashboard.yaml    (existente)
├── loki/
│   ├── docker-compose.yml        (existente)
│   └── loki-config.yaml          (existente)
├── uptime-kuma/
│   └── docker-compose.yml        (existente)
├── promtail/                      (novo)
│   ├── docker-compose.yml
│   └── promtail-config.yaml
├── prometheus/                    (novo)
│   ├── docker-compose.yml
│   └── prometheus.yml
└── node-exporter/                 (novo)
    └── docker-compose.yml
```

### 1.2 Promtail

**Imagem:** `grafana/promtail:2.9.4`
**Função:** Coleta logs de todos os containers Docker via `docker.sock` e envia ao Loki.
**Config:** `promtail-config.yaml` — scrape via Docker service discovery, labels: `container`, `compose_service`, `compose_project`.
**Mounts:** `/var/run/docker.sock` (read-only), `/var/lib/docker/containers` (read-only).
**Rede:** `monitoring-network`.
**Healthcheck:** `wget -q --spider http://localhost:9080/ready`.
**Restart:** `unless-stopped`.

### 1.3 Prometheus

**Imagem:** `prom/prometheus:v2.51.0`
**Função:** Scraping e armazenamento de métricas TSDB. Integrado ao Grafana como datasource.
**Config:** `prometheus.yml` — scrape targets: `node-exporter:9100`, `prometheus:9090` (self).
**Retenção:** `--storage.tsdb.retention.time=30d`.
**Rede:** `monitoring-network`.
**Healthcheck:** `wget -q --spider http://localhost:9090/-/healthy`.
**Restart:** `unless-stopped`.
**Segurança:** Não exposto ao host em produção — acesso via Grafana/monitoring-network apenas.

### 1.4 Node Exporter

**Imagem:** `prom/node-exporter:v1.8.0`
**Função:** Exporta métricas do host (CPU, memória, disco, rede, filesystem) para o Prometheus.
**Mounts:** `/proc`, `/sys`, `/` (root) — todos read-only.
**PID:** `host` (necessário para métricas corretas de CPU/proc).
**Rede:** `monitoring-network`.
**Healthcheck:** `wget -q --spider http://localhost:9100/`.
**Restart:** `unless-stopped`.

### 1.5 Grafana — novo datasource Prometheus

Arquivo `infra/monitoring/grafana/provisioning/datasources/prometheus.yaml`:
- name: Prometheus
- type: prometheus
- url: `http://prometheus:9090`
- isDefault: false (Loki continua como padrão)

---

## 2. Resiliência — Healthchecks e Dependências

### 2.1 Estado atual (auditado)

Todos os serviços existentes já possuem `restart: unless-stopped` e `security_opt: no-new-privileges:true`. A maioria já tem healthcheck. O único ponto de melhoria real é o nginx.

| Serviço | restart | healthcheck | Ação |
|---|---|---|---|
| postgres-auth | ✅ | ✅ `pg_isready` | Nenhuma |
| redis-auth | ✅ | ✅ `redis-cli ping` | Nenhuma |
| keycloak | ✅ | ✅ TCP bash (sem curl no ubi9-micro) | Nenhuma |
| infisical | ✅ | ✅ `curl /api/status` | Nenhuma |
| nginx | ✅ | ⚠️ `nginx -t` (config test, não readiness) | **Melhorar** |
| smtp-relay | ✅ | ❌ ausente | Aceitável — relay simples |
| cloudflared | ✅ | ❌ ausente | Aceitável — tunnel externo |
| grafana | ✅ | ✅ `curl /api/health` | Nenhuma |
| loki | ✅ | ✅ `wget /ready` | Nenhuma |
| uptime-kuma | ✅ | ✅ `curl :3001` | Nenhuma |

### 2.2 Melhoria necessária: nginx healthcheck

O `nginx -t` apenas valida a sintaxe do config — não prova que o nginx está servindo requests.

**Mudança:** Substituir por `curl -sf http://localhost/healthz`.

Requer adicionar em `infra/nginx/conf.d/default.conf` (no server block do catch-all):
```nginx
location /healthz {
    access_log off;
    return 200 "OK";
    add_header Content-Type text/plain;
}
```

### 2.3 Healthchecks dos novos serviços

| Serviço | Método | Intervalo | Timeout | Retries | Start period |
|---|---|---|---|---|---|
| promtail | `wget -q --spider http://localhost:9080/ready` | 30s | 10s | 3 | 20s |
| prometheus | `wget -q --spider http://localhost:9090/-/healthy` | 30s | 10s | 3 | 20s |
| node-exporter | `wget -q --spider http://localhost:9100/` | 30s | 10s | 3 | 10s |

### 2.4 `restart: unless-stopped`

Todos os serviços existentes já possuem. Adicionar nos 3 novos: `promtail`, `prometheus`, `node-exporter`.

### 2.5 Sequência de inicialização (via scripts)

Os `docker-compose.yml` separados não suportam `depends_on` cross-compose. A ordem é garantida pelos scripts `up.sh` e `dev-up.sh` via `wait_healthy`:

```
1. postgres-auth  → wait_healthy 120s
2. redis-auth     → wait_healthy 30s
3. smtp-relay     → start (sem healthcheck crítico)
4. keycloak       → wait_healthy 360s
5. infisical      → wait_healthy 120s
6. nginx          → wait_healthy 60s
7. cloudflared    → start
8. loki           → wait_healthy 60s
9. promtail       → start (depende de loki estar healthy)
10. prometheus    → wait_healthy 60s
11. node-exporter → start
12. grafana       → wait_healthy 60s
13. uptime-kuma   → start
```

---

## 3. Atualizações de Scripts

### 3.1 `scripts/dev-up.sh`

- Renumerar etapas de 5 para 7 (ou mais) para incluir monitoring
- Bloco 6: Subir loki + promtail + prometheus + node-exporter
- Bloco 7: Subir grafana (dev override) + uptime-kuma
- Adicionar `wait_healthy loki` antes de subir Promtail
- Adicionar `wait_healthy grafana` antes de imprimir URLs finais
- Atualizar bloco de URLs para incluir Grafana como padrão (não mais opcional)
- Remover comentário "To also start monitoring..."

### 3.2 `scripts/up.sh`

- Renumerar de 8 para 10 etapas
- Expandir bloco de monitoring para subir na ordem: loki → promtail → prometheus → node-exporter → grafana → uptime-kuma
- Adicionar `wait_healthy` para loki, prometheus e grafana

### 3.3 `scripts/healthcheck.sh`

Adicionar ao bloco `--- Monitoring ---`:
- `check_container promtail`
- `check_container prometheus`
- `check_container node-exporter`

---

## 4. Atualizações de Documentação

### 4.1 `CLAUDE.md`

- **Stack**: Adicionar Promtail, Prometheus, Node Exporter à tabela
- **Estrutura do repositório**: Adicionar novos dirs (promtail/, prometheus/, node-exporter/)
- **Status atual**: Atualizar seção Monitoramento de "deixado para depois" para status atual
- **Comandos essenciais**: Atualizar bloco de Grafana opcional para incluir toda a stack

### 4.2 `README.md`

- **Tabela Stack de Componentes**: Adicionar Promtail, Prometheus, Node Exporter com imagens e redes
- **Estrutura do repositório**: Adicionar novos diretórios
- **Seção Observabilidade** (nova subsection): Diagrama textual do fluxo containers → Promtail/Node Exporter → Loki/Prometheus → Grafana
- **Fluxo de implantação**: Etapa 16 "Subir monitoramento" — detalhar a ordem dos 6 serviços

### 4.3 `docs/arquitetura.md`

- Tabela de componentes: adicionar Promtail, Prometheus, Node Exporter
- Ordem de dependência: atualizar para refletir a sequência de 13 etapas
- Nova seção **"Stack de Observabilidade"** com fluxo completo

### 4.4 `docs/security.md`

- Tabela hardening Docker: adicionar Promtail, Prometheus, Node Exporter
- Nota: Prometheus e Loki não expostos ao host — acesso restrito à monitoring-network

### 4.5 `docs/onboarding.md`

- Seção de setup do monitoring: expandir para incluir todos os 6 serviços com ordem correta

---

## 5. Arquivos a NÃO modificar

- `.env.template` — nenhuma variável nova necessária (configs por YAML)
- `infra/keycloak/realm-export.json` — fora do escopo
- `infra/nginx/conf.d/*.conf` — apenas `default.conf` precisa do bloco `/healthz`
- `apps/weather-dashboard/` — fora do escopo

---

## 6. Ordem de Implementação

1. Criar configs novos: `promtail-config.yaml`, `prometheus.yml`, `prometheus.yaml` (datasource)
2. Criar compose files: `promtail/docker-compose.yml`, `prometheus/docker-compose.yml`, `node-exporter/docker-compose.yml`
3. Revisar compose files existentes: `redis-auth`, `infisical`, `nginx`, `smtp-relay`, `cloudflared` (healthchecks + restart)
4. Revisar compose files de monitoring existentes: `grafana`, `loki`, `uptime-kuma` (ajustar parâmetros se necessário)
5. Atualizar `nginx/conf.d/default.conf` (bloco healthz)
6. Atualizar scripts: `dev-up.sh`, `up.sh`, `healthcheck.sh`
7. Atualizar documentação: `CLAUDE.md`, `README.md`, `docs/arquitetura.md`, `docs/security.md`, `docs/onboarding.md`

---

## 7. Critérios de Aceitação

- [ ] `docker compose up -d` para cada novo serviço de monitoring sobe sem erros
- [ ] `bash scripts/dev-up.sh` sobe toda a stack incluindo monitoring
- [ ] `bash scripts/healthcheck.sh` mostra 13 containers como `[OK]`
- [ ] Grafana mostra Loki e Prometheus como datasources provisionados
- [ ] `docker inspect --format='{{.State.Health.Status}}'` retorna `healthy` para todos os serviços com healthcheck
- [ ] README e docs refletem a stack completa
- [ ] `CLAUDE.md` atualizado com novo status de monitoring
