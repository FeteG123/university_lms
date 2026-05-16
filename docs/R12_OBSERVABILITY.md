# R12 — Observability (Grafana LGTM + OpenTelemetry)

This stack satisfies **R12** (traces + logs + metrics in **one** UI: **Grafana**) using:

| Signal   | Backend    | How data gets in |
|----------|------------|------------------|
| Traces   | Grafana Tempo | FastAPI / Celery → **OTLP gRPC** → OpenTelemetry Collector → Tempo |
| Metrics  | Prometheus | Scrapes **`http://api-1:8000/metrics`** and **`api-2:8000/metrics`** (`prometheus-fastapi-instrumentator`) |
| Logs     | Grafana Loki | **Promtail** reads Docker container logs → Loki |

---

## Step-by-step: what you do

### 1. Enable OTLP in the API (`.env`)

Append to your project `.env` (or copy from `.env.example` comments):

```env
OTEL_EXPORTER_OTLP_ENDPOINT=otel-collector:4317
OTEL_SERVICE_NAME=lms-api
```

**Important:** use `host:port` only (**no** `http://` prefix). The app uses **gRPC** to the collector on port **4317**.

### 2. Start the full stack with the observability profile

**If you skip this step, Grafana is not running** — `http://localhost:3000` will show **connection refused** (nothing is bound to port 3000).

From the repo root:

```bash
docker compose --profile observability up -d --build
```

**Alternative:** add `COMPOSE_PROFILES=observability` to your `.env` file. Then a normal `docker compose up -d` will also start Grafana, Prometheus, Loki, Tempo, and the collector.

- **`--profile observability`** starts: `otel-collector`, `tempo`, `loki`, `promtail`, `prometheus`, `grafana` in addition to Traefik, Postgres, Redis, API replicas, worker, migrate.
- **`--build`** picks up new Python deps (`requirements.txt`) and telemetry code.

### 3. Open Grafana

- URL: **http://localhost:3000**
- Default login (unless you set env): **`admin` / `admin`** (override with `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` in `.env`).

Datasources (**Prometheus**, **Tempo**, **Loki**) are provisioned automatically under **Connections → Data sources**.

### 4. Generate traffic

Use the LMS UI or curl:

- `http://localhost/api/auth/login`
- `http://localhost/api/courses`
- Enroll, submit assignment, etc.

### 5. Verify each pillar (for viva / PDF screenshots)

1. **Metrics — Prometheus**  
   - Grafana → **Explore** → datasource **Prometheus**.  
   - Try metrics such as `http_requests_total` or `http_request_duration_seconds_*` (names depend on instrumentator defaults).

2. **Traces — Tempo**  
   - **Explore** → **Tempo** → **Search** (or TraceQL) and find spans for `lms-api` / `service.name`.

3. **Logs — Loki**  
   - **Explore** → **Loki** → query e.g. `{container=~".+"}` or filter by container label from Promtail.  
   - With **OpenTelemetry LoggingInstrumentor**, log lines include trace context when OTLP is enabled; you can correlate mentally or extend dashboards (advanced).

### 6. Optional: run core LMS without observability

Unset `OTEL_EXPORTER_OTLP_ENDPOINT` in `.env` (or comment it out), then:

```bash
docker compose up -d
```

API still exposes **`/metrics`** for local Prometheus scraping if you add it later; traces stay off.

---

## Ports (when profile is on)

| Port  | Service            |
|-------|--------------------|
| 3000  | Grafana            |
| 9090  | Prometheus UI      |
| 3100  | Loki               |
| 4317  | OTLP gRPC (collector, also on host for debugging) |
| 4318  | OTLP HTTP (collector) |
| 13133 | Collector health   |

---

## Troubleshooting

- **No traces in Tempo**  
  - Confirm `.env` has `OTEL_EXPORTER_OTLP_ENDPOINT=otel-collector:4317` and you used **`--profile observability`**.  
  - `docker compose logs otel-collector` and `docker compose logs api-1` for export errors.

- **Loki / Promtail errors on Windows**  
  - Requires Docker Desktop with Linux containers and access to **`/var/run/docker.sock`** inside the Promtail container (standard bind mount).

- **Loki fails to start**  
  - Check `docker compose logs loki`. Adjust `infra/loki/loki-config.yaml` for your Loki image version if the schema block is rejected.

---

## Report checklist (R12)

- [ ] One paragraph: why Grafana bundles traces + logs + metrics for this project.  
- [ ] Screenshot: Prometheus Explore with at least one HTTP metric.  
- [ ] Screenshot: Tempo with a trace from a real LMS request.  
- [ ] Screenshot: Loki with API/worker logs around the same time.  
- [ ] Optional: short note on correlating trace id in logs (OTel logging format).
