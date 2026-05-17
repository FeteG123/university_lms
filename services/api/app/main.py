from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, FastAPI
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.redis_client import get_redis
from app.routers import assignments, auth, courses, grades, materials, submissions, users
from app.spa_static import SpaStaticFiles
from app.ws.lecture import router as ws_router

app = FastAPI(
    title="LMS Lite API",
    version="0.6.0",
    description=(
        "University LMS-lite: FastAPI + PostgreSQL + Redis behind Traefik. "
        "REST under /api; SPA served at /."
    ),
)
from app.from_scratch.rate_limiter import RateLimiterMiddleware
from app.telemetry import configure_prometheus_metrics

configure_prometheus_metrics(app)
app.add_middleware(RateLimiterMiddleware)


class HealthResponse(BaseModel):
    status: str
    instance: str


class ReadyResponse(BaseModel):
    status: str
    instance: str
    postgres: str
    redis: str


@app.get("/health/live", response_model=HealthResponse, tags=["health"])
def health_live() -> Any:
    settings = get_settings()
    return {"status": "ok", "instance": settings.api_instance}


@app.get("/health/ready", response_model=ReadyResponse, tags=["health"])
def health_ready(db: Session = Depends(get_db)) -> Any:
    settings = get_settings()
    pg_status = "unknown"
    redis_status = "unknown"
    try:
        db.execute(text("SELECT 1"))
        pg_status = "ok"
    except Exception:
        pg_status = "error"
    try:
        get_redis().ping()
        redis_status = "ok"
    except Exception:
        redis_status = "error"

    overall = "ok" if pg_status == "ok" and redis_status == "ok" else "degraded"
    return {
        "status": overall,
        "instance": settings.api_instance,
        "postgres": pg_status,
        "redis": redis_status,
    }


api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(users.router)
api.include_router(courses.router)
api.include_router(materials.router)
api.include_router(assignments.router)
api.include_router(submissions.router)
api.include_router(grades.router)
app.include_router(api)
app.include_router(ws_router)

from app.telemetry import configure_observability

configure_observability(app)

_static_dir = Path(__file__).resolve().parent.parent / "static"
_index_html = _static_dir / "index.html"
if _index_html.is_file():
    app.mount(
        "/",
        SpaStaticFiles(directory=str(_static_dir), html=True),
        name="spa",
    )
