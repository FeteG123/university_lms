# Observability R12

#r12 #observability

**Guide:** `docs/R12_OBSERVABILITY.md` (step-by-step screenshots checklist)  
**Code:** `services/api/app/telemetry.py`  
**Infra:** `infra/otel/`, `infra/tempo/`, `infra/loki/`, `infra/promtail/`, `infra/prometheus/`, `infra/grafana/`

---

## Three pillars → one UI (Grafana)

| Pillar | Backend | How data arrives |
|--------|---------|------------------|
| **Metrics** | Prometheus | Scrapes `http://api-1:8000/metrics` and `api-2:8000/metrics` every 15s |
| **Traces** | Grafana Tempo | FastAPI + SQLAlchemy + Celery → OTLP gRPC → OTel Collector → Tempo |
| **Logs** | Grafana Loki | Promtail reads Docker container logs → Loki |

---

## Enable locally

```bash
# .env
OTEL_EXPORTER_OTLP_ENDPOINT=otel-collector:4317
OTEL_SERVICE_NAME=lms-api

docker compose --profile observability up -d --build
```

Grafana: http://localhost:3000 (admin/admin default)

---

## Code hooks

`telemetry.py`:

- `configure_prometheus_metrics(app)` — `/metrics` endpoint
- `configure_observability(app)` — OTLP exporter if endpoint set
- `configure_celery_observability(celery_app)` — worker traces

---

## What to screenshot for PDF

1. Grafana Explore → Prometheus → `http_requests_total` (or duration histogram)
2. Grafana Explore → Tempo → trace for `POST /api/auth/login` or submit flow
3. Grafana Explore → Loki → logs from `lms-api-1` with trace id correlation (if configured)
4. Diagram: app → collector → backends → Grafana

---

## Production VM

Observability profile is **optional** on VM — may run only locally for report screenshots unless you open port 3000 (not recommended publicly).

---

## Rubric

- **R12** — code done; **PDF needs screenshots + narrative**

See [[Docker Compose and Traefik]], [[Rubric R1-R13 Evidence]].
