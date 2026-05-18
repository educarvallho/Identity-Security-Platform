# Observability & Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the monitoring stack with Promtail, Prometheus, and Node Exporter; improve nginx healthcheck; update all scripts and documentation to reflect the complete observability architecture.

**Architecture:** Each new monitoring service gets its own subdirectory under `infra/monitoring/` following the existing pattern. The `monitoring-network` already exists — new containers join it. Scripts (`dev-up.sh`, `up.sh`) are extended to start the full monitoring stack in dependency order.

**Tech Stack:** Docker Compose v2, Grafana Promtail 2.9.4, Prometheus 2.51.0, Node Exporter 1.8.0, Bash

**Spec:** `docs/superpowers/specs/2026-05-18-observability-resilience-design.md`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `infra/monitoring/promtail/docker-compose.yml` | Promtail service definition |
| Create | `infra/monitoring/promtail/promtail-config.yaml` | Docker log scraping + Loki push config |
| Create | `infra/monitoring/prometheus/docker-compose.yml` | Prometheus service definition |
| Create | `infra/monitoring/prometheus/prometheus.yml` | Scrape targets: node-exporter, self |
| Create | `infra/monitoring/node-exporter/docker-compose.yml` | Node Exporter service definition |
| Create | `infra/monitoring/grafana/provisioning/datasources/prometheus.yaml` | Prometheus as Grafana datasource |
| Modify | `infra/nginx/conf.d/default.conf` | Add `/healthz` location block |
| Modify | `infra/nginx/docker-compose.yml` | Replace `nginx -t` healthcheck with HTTP check |
| Modify | `scripts/dev-up.sh` | Add full monitoring stack startup |
| Modify | `scripts/up.sh` | Expand monitoring block with new services |
| Modify | `scripts/healthcheck.sh` | Add promtail, prometheus, node-exporter |
| Modify | `CLAUDE.md` | Add new stack entries, update monitoring status |
| Modify | `README.md` | Add new components, observability flow diagram |
| Modify | `docs/arquitetura.md` | Add new components, update startup sequence |
| Modify | `docs/security.md` | Add new containers to hardening table |
| Modify | `docs/onboarding.md` | Expand monitoring setup section |

---

## Task 1: Promtail — log collector

**Files:**
- Create: `infra/monitoring/promtail/promtail-config.yaml`
- Create: `infra/monitoring/promtail/docker-compose.yml`

- [ ] **Step 1.1: Create promtail-config.yaml**

```yaml
# infra/monitoring/promtail/promtail-config.yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0
  log_level: warn

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: [__meta_docker_container_name]
        regex: '/(.*)'
        target_label: container
      - source_labels: [__meta_docker_container_label_com_docker_compose_service]
        target_label: compose_service
      - source_labels: [__meta_docker_container_label_com_docker_compose_project]
        target_label: compose_project
      - source_labels: [__meta_docker_container_log_stream]
        target_label: stream
```

- [ ] **Step 1.2: Create docker-compose.yml**

```yaml
# infra/monitoring/promtail/docker-compose.yml
services:
  promtail:
    image: grafana/promtail:2.9.4
    container_name: promtail
    restart: unless-stopped
    command: -config.file=/etc/promtail/promtail-config.yaml
    volumes:
      - ./promtail-config.yaml:/etc/promtail/promtail-config.yaml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    networks:
      - monitoring-network
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:9080/ready || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    security_opt:
      - no-new-privileges:true

networks:
  monitoring-network:
    external: true
```

- [ ] **Step 1.3: Validate compose syntax**

```bash
docker compose -f infra/monitoring/promtail/docker-compose.yml config
```

Expected: YAML output without errors.

- [ ] **Step 1.4: Commit**

```bash
git add infra/monitoring/promtail/
git commit -m "feat: add Promtail log collector for Docker containers"
```

---

## Task 2: Prometheus — metrics storage

**Files:**
- Create: `infra/monitoring/prometheus/prometheus.yml`
- Create: `infra/monitoring/prometheus/docker-compose.yml`

- [ ] **Step 2.1: Create prometheus.yml**

```yaml
# infra/monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ['localhost:9090']

  - job_name: node-exporter
    static_configs:
      - targets: ['node-exporter:9100']
```

- [ ] **Step 2.2: Create docker-compose.yml**

```yaml
# infra/monitoring/prometheus/docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:v2.51.0
    container_name: prometheus
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    networks:
      - monitoring-network
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:9090/-/healthy || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    security_opt:
      - no-new-privileges:true

volumes:
  prometheus-data:
    name: prometheus-data

networks:
  monitoring-network:
    external: true
```

- [ ] **Step 2.3: Validate compose syntax**

```bash
docker compose -f infra/monitoring/prometheus/docker-compose.yml config
```

Expected: YAML output without errors.

- [ ] **Step 2.4: Commit**

```bash
git add infra/monitoring/prometheus/
git commit -m "feat: add Prometheus metrics storage with 30d retention"
```

---

## Task 3: Node Exporter — host metrics

**Files:**
- Create: `infra/monitoring/node-exporter/docker-compose.yml`

- [ ] **Step 3.1: Create docker-compose.yml**

```yaml
# infra/monitoring/node-exporter/docker-compose.yml
services:
  node-exporter:
    image: prom/node-exporter:v1.8.0
    container_name: node-exporter
    restart: unless-stopped
    command:
      - '--path.rootfs=/host'
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/host:ro,rslave
    networks:
      - monitoring-network
    pid: host
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:9100/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    security_opt:
      - no-new-privileges:true

networks:
  monitoring-network:
    external: true
```

- [ ] **Step 3.2: Validate compose syntax**

```bash
docker compose -f infra/monitoring/node-exporter/docker-compose.yml config
```

Expected: YAML output without errors.

- [ ] **Step 3.3: Commit**

```bash
git add infra/monitoring/node-exporter/
git commit -m "feat: add Node Exporter for host CPU/memory/disk/network metrics"
```

---

## Task 4: Grafana — Prometheus datasource

**Files:**
- Create: `infra/monitoring/grafana/provisioning/datasources/prometheus.yaml`

- [ ] **Step 4.1: Create prometheus.yaml datasource**

```yaml
# infra/monitoring/grafana/provisioning/datasources/prometheus.yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: false
    version: 1
    editable: false
    jsonData:
      timeInterval: "15s"
```

- [ ] **Step 4.2: Validate the datasource file is valid YAML**

```bash
docker run --rm -i mikefarah/yq eval '.' - < infra/monitoring/grafana/provisioning/datasources/prometheus.yaml
```

Expected: YAML echoed back without errors. (If yq not available, skip — syntax is straightforward.)

- [ ] **Step 4.3: Commit**

```bash
git add infra/monitoring/grafana/provisioning/datasources/prometheus.yaml
git commit -m "feat: provision Prometheus as Grafana datasource"
```

---

## Task 5: Nginx — real HTTP healthcheck

The current healthcheck (`nginx -t`) only validates config syntax — it does not verify nginx is serving requests. This task adds a real `/healthz` endpoint.

**Files:**
- Modify: `infra/nginx/conf.d/default.conf`
- Modify: `infra/nginx/docker-compose.yml`

- [ ] **Step 5.1: Update default.conf to add /healthz**

Replace the entire content of `infra/nginx/conf.d/default.conf` with:

```nginx
# Drop requests with no matching server_name — prevents host-header injection.
# /healthz is served before the catch-all drop for Docker healthchecks.
server {
    listen 80 default_server;
    server_name _;

    location /healthz {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }

    location / {
        return 444;
    }
}
```

- [ ] **Step 5.2: Update healthcheck in infra/nginx/docker-compose.yml**

Change the `healthcheck` block from:

```yaml
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

To:

```yaml
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost/healthz || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

- [ ] **Step 5.3: Validate compose syntax**

```bash
docker compose -f infra/nginx/docker-compose.yml config
```

Expected: YAML output without errors.

- [ ] **Step 5.4: Commit**

```bash
git add infra/nginx/conf.d/default.conf infra/nginx/docker-compose.yml
git commit -m "fix: replace nginx config-test healthcheck with real HTTP /healthz probe"
```

---

## Task 6: Scripts — dev-up.sh, up.sh, healthcheck.sh

**Files:**
- Modify: `scripts/healthcheck.sh`
- Modify: `scripts/up.sh`
- Modify: `scripts/dev-up.sh`

### 6a — healthcheck.sh

- [ ] **Step 6.1: Add 3 new containers to healthcheck.sh**

In the `--- Monitoring ---` block, replace:

```bash
echo ""
echo "--- Monitoring ---"
check_container loki
check_container grafana
check_container uptime-kuma
```

With:

```bash
echo ""
echo "--- Monitoring ---"
check_container loki
check_container promtail
check_container prometheus
check_container node-exporter
check_container grafana
check_container uptime-kuma
```

- [ ] **Step 6.2: Validate healthcheck.sh syntax**

```bash
bash -n scripts/healthcheck.sh
```

Expected: No output (no syntax errors).

### 6b — up.sh

- [ ] **Step 6.3: Expand monitoring block in up.sh**

Replace the monitoring section and renumber from 8 to 10 steps. Replace everything from the `[8/8]` step to the end of the file with:

```bash
echo "[8/10] Starting Nginx + Cloudflare Tunnel..."
docker compose -f "$INFRA_DIR/nginx/docker-compose.yml" up -d
wait_healthy nginx 60
docker compose -f "$INFRA_DIR/cloudflared/docker-compose.yml" up -d

echo "[9/10] Starting log and metrics collectors..."
docker compose -f "$INFRA_DIR/monitoring/loki/docker-compose.yml" up -d
wait_healthy loki 60
docker compose -f "$INFRA_DIR/monitoring/promtail/docker-compose.yml" up -d
docker compose -f "$INFRA_DIR/monitoring/prometheus/docker-compose.yml" up -d
wait_healthy prometheus 60
docker compose -f "$INFRA_DIR/monitoring/node-exporter/docker-compose.yml" up -d

echo "[10/10] Starting dashboards and uptime monitoring..."
docker compose -f "$INFRA_DIR/monitoring/grafana/docker-compose.yml" up -d
wait_healthy grafana 60
docker compose -f "$INFRA_DIR/monitoring/uptime-kuma/docker-compose.yml" up -d

echo ""
echo "=== Platform UP — running healthcheck ==="
bash "$SCRIPT_DIR/healthcheck.sh"
```

Also update the step counter on the previous Keycloak/Infisical blocks — they were 5/8, 6/8, 7/8:

```bash
echo "[5/10] Starting Keycloak..."
...
echo "[6/10] Starting Infisical..."
...
echo "[7/10] Starting SMTP Relay..."   # (reorder: smtp before nginx is cleaner)
```

Wait — looking at the current up.sh:
- `[2/8]` postgres
- `[3/8]` redis
- `[4/8]` smtp
- `[5/8]` keycloak
- `[6/8]` infisical
- `[7/8]` nginx + cloudflared
- `[8/8]` monitoring

Replace the counter suffix in all echo lines from `/8` to `/10`:

```bash
# In scripts/up.sh, replace all echo "[N/8]" with "[N/10]" for steps 1-7,
# then add new steps 8-10 as shown above.
```

Exact sed command:

```bash
sed -i 's|/8\]|/10]|g' scripts/up.sh
```

Then replace just the monitoring block (from `echo "[8/10]` to end):

Full final monitoring + end section of up.sh:

```bash
echo "[8/10] Starting Nginx + Cloudflare Tunnel..."
docker compose -f "$INFRA_DIR/nginx/docker-compose.yml" up -d
wait_healthy nginx 60
docker compose -f "$INFRA_DIR/cloudflared/docker-compose.yml" up -d

echo "[9/10] Starting log and metrics collectors..."
docker compose -f "$INFRA_DIR/monitoring/loki/docker-compose.yml" up -d
wait_healthy loki 60
docker compose -f "$INFRA_DIR/monitoring/promtail/docker-compose.yml" up -d
docker compose -f "$INFRA_DIR/monitoring/prometheus/docker-compose.yml" up -d
wait_healthy prometheus 60
docker compose -f "$INFRA_DIR/monitoring/node-exporter/docker-compose.yml" up -d

echo "[10/10] Starting dashboards and uptime monitoring..."
docker compose -f "$INFRA_DIR/monitoring/grafana/docker-compose.yml" up -d
wait_healthy grafana 60
docker compose -f "$INFRA_DIR/monitoring/uptime-kuma/docker-compose.yml" up -d

echo ""
echo "=== Platform UP — running healthcheck ==="
bash "$SCRIPT_DIR/healthcheck.sh"
```

- [ ] **Step 6.4: Validate up.sh syntax**

```bash
bash -n scripts/up.sh
```

Expected: No output.

### 6c — dev-up.sh

- [ ] **Step 6.5: Add monitoring stack to dev-up.sh**

Replace the entire file content with the following (builds on the existing logic, adds steps 6-7):

```bash
#!/usr/bin/env bash
# Local development startup — exposes Keycloak, Infisical, and Grafana directly.
# Use this for initial configuration and testing WITHOUT a domain or Cloudflare Tunnel.
#
# Keycloak  → http://localhost:8180
# Infisical → http://localhost:8181
# Grafana   → http://localhost:3001
#
# Requirements: Docker running, .env file populated (cp .env.template .env && edit)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")/infra"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$ROOT_DIR/.env" ]; then
    echo "ERROR: .env not found. Run: cp .env.template .env && nano .env"
    exit 1
fi

set -a; source "$ROOT_DIR/.env"; set +a

wait_healthy() {
    local name=$1 timeout=${2:-120}
    echo "  Waiting for $name (max ${timeout}s)..."
    local elapsed=0
    until docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null | grep -q "healthy"; do
        sleep 5; elapsed=$((elapsed+5))
        if [ $elapsed -ge $timeout ]; then
            echo "  TIMEOUT: $name not healthy after ${timeout}s"
            echo "  Check logs: docker logs $name --tail 50"
            exit 1
        fi
        [ $((elapsed % 30)) -eq 0 ] && echo "  ... ${elapsed}s elapsed, still waiting for $name"
    done
    echo "  [OK] $name (${elapsed}s)"
}

# Keycloak-specific check: polls the exposed host port directly (avoids
# depending on tools inside the minimal ubi9-micro container image).
wait_keycloak() {
    local timeout=360
    echo "  Waiting for Keycloak on http://localhost:8180 (max ${timeout}s)..."
    local elapsed=0
    until curl -sf http://localhost:8180/realms/master > /dev/null 2>&1; do
        sleep 5; elapsed=$((elapsed+5))
        if [ $elapsed -ge $timeout ]; then
            echo "  TIMEOUT: Keycloak not responding after ${timeout}s"
            echo "  Check logs: docker logs keycloak --tail 50"
            exit 1
        fi
        [ $((elapsed % 30)) -eq 0 ] && echo "  ... ${elapsed}s elapsed, still waiting for Keycloak"
    done
    echo "  [OK] Keycloak (${elapsed}s)"
}

echo "=== IAM Platform — Local Dev Startup ==="
echo ""

echo "[1/7] Creating Docker networks..."
bash "$SCRIPT_DIR/create-networks.sh"

echo "[2/7] Starting PostgreSQL Auth..."
docker compose -f "$INFRA_DIR/postgres-auth/docker-compose.yml" up -d
wait_healthy postgres-auth 120

echo "[3/7] Starting Redis Auth..."
docker compose -f "$INFRA_DIR/redis-auth/docker-compose.yml" up -d

echo "[4/7] Starting Keycloak (dev mode — port 8180)..."
docker compose \
    -f "$INFRA_DIR/keycloak/docker-compose.yml" \
    -f "$INFRA_DIR/keycloak/docker-compose.dev.yml" \
    up -d
wait_keycloak

echo "[5/7] Starting Infisical (dev mode — port 8181)..."
docker compose \
    -f "$INFRA_DIR/infisical/docker-compose.yml" \
    -f "$INFRA_DIR/infisical/docker-compose.dev.yml" \
    up -d

echo "[6/7] Starting log and metrics collectors..."
docker compose -f "$INFRA_DIR/monitoring/loki/docker-compose.yml" up -d
wait_healthy loki 60
docker compose -f "$INFRA_DIR/monitoring/promtail/docker-compose.yml" up -d
docker compose -f "$INFRA_DIR/monitoring/prometheus/docker-compose.yml" up -d
wait_healthy prometheus 60
docker compose -f "$INFRA_DIR/monitoring/node-exporter/docker-compose.yml" up -d

echo "[7/7] Starting dashboards and uptime monitoring..."
docker compose \
    -f "$INFRA_DIR/monitoring/grafana/docker-compose.yml" \
    -f "$INFRA_DIR/monitoring/grafana/docker-compose.dev.yml" \
    up -d
wait_healthy grafana 60
docker compose -f "$INFRA_DIR/monitoring/uptime-kuma/docker-compose.yml" up -d

echo ""
echo "=== Services ready. Access at: ==="
echo "  Keycloak Admin:  http://localhost:8180/admin"
echo "  Keycloak Health: http://localhost:8180/health/ready"
echo "  Infisical:       http://localhost:8181"
echo "  Grafana:         http://localhost:3001"
echo ""
echo "Credentials: check your .env (KC_ADMIN_USER / KC_ADMIN_PASSWORD, GRAFANA_ADMIN_USER / GRAFANA_ADMIN_PASSWORD)"
```

- [ ] **Step 6.6: Validate dev-up.sh syntax**

```bash
bash -n scripts/dev-up.sh
```

Expected: No output.

- [ ] **Step 6.7: Commit scripts**

```bash
git add scripts/healthcheck.sh scripts/up.sh scripts/dev-up.sh
git commit -m "feat: expand scripts to include full monitoring stack (Promtail, Prometheus, Node Exporter)"
```

---

## Task 7: Documentation — CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 7.1: Update the Stack table in CLAUDE.md**

In the `## Visão Geral do Projeto` section, update the **Stack:** list. Replace:

```
- Monitoring: Grafana 10.4 + Loki 2.9.4 + Uptime Kuma 1
```

With:

```
- Monitoring: Grafana 10.4 + Loki 2.9.4 + Promtail 2.9.4 + Prometheus 2.51.0 + Node Exporter 1.8.0 + Uptime Kuma 1
```

- [ ] **Step 7.2: Update the repo structure section in CLAUDE.md**

In the `## Estrutura do Repositório` code block, replace the monitoring section:

```
│   └── monitoring/
│       ├── grafana/
│       │   ├── docker-compose.yml
│       │   └── provisioning/ + docker-compose.dev.yml (porta 3001)
│       ├── loki/             # + loki-config.yaml
│       └── uptime-kuma/
```

With:

```
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
```

- [ ] **Step 7.3: Update Status Atual section in CLAUDE.md**

Replace:

```
- **Monitoramento**: deixado para depois (Grafana + Loki + Uptime Kuma)
```

With:

```
- **Monitoramento**: implementado — Grafana + Loki + Promtail + Prometheus + Node Exporter + Uptime Kuma ✓
```

- [ ] **Step 7.4: Update dev-up.sh echo in CLAUDE.md**

In `## Comandos Essenciais`, find the block under `### Dev local`:

```bash
# Keycloak: http://localhost:8180/admin
# Infisical: http://localhost:8181
```

Add after:

```bash
# Grafana:   http://localhost:3001  (incluído por padrão no dev-up.sh)
```

- [ ] **Step 7.5: Commit CLAUDE.md**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with full monitoring stack and new structure"
```

---

## Task 8: Documentation — README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 8.1: Add 3 new components to the Stack table**

In the `## Stack de Componentes` table, after the Uptime Kuma row, add:

```markdown
| **Promtail**      | grafana/promtail:2.9.4              | Coleta logs Docker → Loki            | monitoring-network               |
| **Prometheus**    | prom/prometheus:v2.51.0             | Métricas TSDB, scraping, 30d retenção| monitoring-network               |
| **Node Exporter** | prom/node-exporter:v1.8.0           | Métricas do host: CPU, RAM, disco    | monitoring-network               |
```

- [ ] **Step 8.2: Add observability flow section to README.md**

After the `## Arquitetura de Redes Docker` section and before `## Estrutura do Repositório`, add a new section:

```markdown
## Stack de Observabilidade

```
Containers e VPS
      ↓
Promtail          Node Exporter
(logs Docker)     (métricas host)
      ↓                 ↓
    Loki           Prometheus
(log store)      (metrics TSDB)
      └──────┬────────┘
           Grafana
    (dashboards + alertas)

Paralelamente:
Uptime Kuma → health checks ativos → alertas push
```

| Componente    | Função                          | Porta interna |
|---------------|---------------------------------|---------------|
| Promtail      | Coleta logs via docker.sock     | 9080          |
| Loki          | Armazena logs, query LogQL      | 3100          |
| Prometheus    | Scraping e armazenamento TSDB   | 9090          |
| Node Exporter | Métricas do host                | 9100          |
| Grafana       | Dashboards operacionais         | 3000          |
| Uptime Kuma   | Uptime checks + alertas         | 3001          |
```

- [ ] **Step 8.3: Update repo structure in README.md**

In the `## Estrutura do Repositório` code block, expand the monitoring section:

```
│   └── monitoring/
│       ├── grafana/
│       │   ├── docker-compose.yml
│       │   └── provisioning/
│       │       ├── datasources/loki.yaml
│       │       ├── datasources/prometheus.yaml
│       │       └── dashboards/dashboard.yaml
│       ├── loki/
│       │   ├── docker-compose.yml
│       │   └── loki-config.yaml
│       ├── promtail/
│       │   ├── docker-compose.yml
│       │   └── promtail-config.yaml
│       ├── prometheus/
│       │   ├── docker-compose.yml
│       │   └── prometheus.yml
│       └── node-exporter/
│           └── docker-compose.yml
```

- [ ] **Step 8.4: Update monitoring step in deployment flow table (step 16)**

In `## Fluxo de Implantação (19 Etapas)`, replace etapa 16:

```markdown
| 16 | Subir monitoramento | `infra/monitoring/` — ordem: loki → promtail → prometheus → node-exporter → grafana → uptime-kuma |
```

- [ ] **Step 8.5: Commit README.md**

```bash
git add README.md
git commit -m "docs: update README with Promtail, Prometheus, Node Exporter and observability flow"
```

---

## Task 9: Documentation — docs/

**Files:**
- Modify: `docs/arquitetura.md`
- Modify: `docs/security.md`
- Modify: `docs/onboarding.md`

### arquitetura.md

- [ ] **Step 9.1: Update components table in docs/arquitetura.md**

In the components table, after the Uptime Kuma row, add:

```markdown
| Promtail        | Coleta logs Docker → Loki                     | grafana/promtail:2.9.4              |
| Prometheus      | Scraping métricas TSDB, 30d retenção          | prom/prometheus:v2.51.0             |
| Node Exporter   | Métricas host: CPU, RAM, disco, rede          | prom/node-exporter:v1.8.0           |
```

- [ ] **Step 9.2: Update startup order in docs/arquitetura.md**

Replace the `## Ordem de Dependência` section with:

```markdown
## Ordem de Dependência

```
postgres-auth → redis-auth → smtp-relay → keycloak → infisical → nginx → cloudflared
                                                                            ↓
                                              loki → promtail
                                              prometheus → node-exporter
                                              grafana → uptime-kuma
```

Gerenciada pelo `scripts/up.sh` com `wait_healthy` para serviços críticos.

## Stack de Observabilidade

```
Containers e VPS
      ↓
Promtail (logs)       Node Exporter (métricas host)
      ↓                       ↓
    Loki                 Prometheus
      └──────────┬──────────┘
               Grafana
          (dashboards + alertas)

Paralelamente:
Uptime Kuma → health checks ativos (HTTP/TCP) → alertas Telegram/push
```
```

### security.md

- [ ] **Step 9.3: Update Docker hardening table in docs/security.md**

In the hardening Docker table, update the `Usuário não-root` row:

Replace:

```markdown
| Usuário não-root                 | Grafana (472), Loki (10001), cloudflared (65532) |
```

With:

```markdown
| Usuário não-root                 | Grafana (472), Loki (10001), cloudflared (65532), Prometheus (65534) |
```

Then add a row after the `Redes segregadas` row:

```markdown
| Prometheus/Loki não expostos     | Acesso restrito à monitoring-network — sem mapeamento de portas ao host |
```

### onboarding.md

- [ ] **Step 9.4: Expand monitoring setup in docs/onboarding.md**

Find the section that covers monitoring setup (search for "Grafana" or "monitoring" in onboarding.md). If there is a step referencing monitoring with a single compose command, replace it with the full ordered startup:

```bash
# Subir stack de observabilidade (na ordem correta)
docker compose -f infra/monitoring/loki/docker-compose.yml up -d
# Aguardar Loki healthy antes de subir Promtail
docker inspect --format='{{.State.Health.Status}}' loki  # deve retornar "healthy"

docker compose -f infra/monitoring/promtail/docker-compose.yml up -d
docker compose -f infra/monitoring/prometheus/docker-compose.yml up -d
docker compose -f infra/monitoring/node-exporter/docker-compose.yml up -d
docker compose -f infra/monitoring/grafana/docker-compose.yml up -d
docker compose -f infra/monitoring/uptime-kuma/docker-compose.yml up -d

# Grafana: https://monitoring.YOUR_DOMAIN.com
# Datasources provisionados automaticamente: Loki e Prometheus
```

- [ ] **Step 9.5: Commit all docs/**

```bash
git add docs/arquitetura.md docs/security.md docs/onboarding.md
git commit -m "docs: update architecture, security, and onboarding for full observability stack"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - §1 Novos componentes → Tasks 1, 2, 3, 4
  - §2.2 nginx healthcheck → Task 5
  - §2.4 restart novos serviços → Tasks 1, 2, 3 (incluído em cada compose)
  - §3 Scripts → Task 6
  - §4.1 CLAUDE.md → Task 7
  - §4.2 README.md → Task 8
  - §4.3 arquitetura.md → Task 9
  - §4.4 security.md → Task 9
  - §4.5 onboarding.md → Task 9

- [x] **Placeholder scan:** Nenhum TBD/TODO encontrado. Todos os steps com código têm conteúdo completo.

- [x] **Consistency:** Imagens usadas são consistentes com a spec (promtail:2.9.4, prometheus:v2.51.0, node-exporter:v1.8.0). Nomes de containers consistentes em scripts e healthcheck.sh.

---

## Critérios de Aceitação

Após completar todas as tasks:

```bash
# Verificar todos os containers healthy
bash scripts/healthcheck.sh
# Esperado: 13 containers [OK], 5 redes [OK]

# Verificar healthchecks individualmente
for c in promtail prometheus node-exporter; do
  echo "$c: $(docker inspect --format='{{.State.Health.Status}}' $c)"
done
# Esperado: healthy para cada um

# Verificar datasources Grafana (após grafana healthy)
curl -s -u admin:$GRAFANA_ADMIN_PASSWORD http://localhost:3001/api/datasources | python3 -m json.tool | grep '"name"'
# Esperado: "Loki" e "Prometheus"
```
