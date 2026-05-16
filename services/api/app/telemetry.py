"""OpenTelemetry traces + Prometheus metrics (R12). Optional when OTEL_EXPORTER_OTLP_ENDPOINT is unset."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from prometheus_fastapi_instrumentator import Instrumentator

if TYPE_CHECKING:
    from celery import Celery
    from fastapi import FastAPI


def configure_observability(app: "FastAPI") -> None:
    """OTLP traces + log correlation when OTEL_EXPORTER_OTLP_ENDPOINT is set (Prometheus already via configure_prometheus_metrics)."""
    from app.config import get_settings
    from app.db import engine

    settings = get_settings()
    endpoint = (settings.otel_exporter_otlp_endpoint or "").strip()
    if not endpoint:
        logging.getLogger(__name__).info(
            "OTEL_EXPORTER_OTLP_ENDPOINT unset; traces disabled (metrics still on /metrics)"
        )
        return

    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.logging import LoggingInstrumentor
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    resource = Resource.create(
        {
            "service.name": settings.otel_service_name,
            "service.instance.id": settings.api_instance,
        }
    )
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    LoggingInstrumentor().instrument(set_logging_format=True)
    SQLAlchemyInstrumentor().instrument(engine=engine)
    FastAPIInstrumentor.instrument_app(
        app,
        tracer_provider=provider,
        excluded_urls="/health/live,/health/ready,/metrics,/docs,/openapi.json,/redoc",
    )
    logging.getLogger(__name__).info("OpenTelemetry tracing enabled → %s", endpoint)


def configure_prometheus_metrics(app: "FastAPI") -> None:
    """Register early so /metrics reflects all routes."""
    Instrumentator(
        should_ignore_untemplated=True,
        should_round_latency_decimals=True,
    ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


def configure_celery_observability(celery_app: "Celery") -> None:
    from app.config import get_settings

    settings = get_settings()
    endpoint = (settings.otel_exporter_otlp_endpoint or "").strip()
    if not endpoint:
        return

    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.celery import CeleryInstrumentor
    from opentelemetry.instrumentation.logging import LoggingInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    resource = Resource.create(
        {
            "service.name": f"{settings.otel_service_name}-worker",
            "service.instance.id": settings.api_instance,
        }
    )
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, insecure=True)))
    trace.set_tracer_provider(provider)
    LoggingInstrumentor().instrument(set_logging_format=True)
    CeleryInstrumentor().instrument(celery_app)
