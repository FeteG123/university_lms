from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://lms:lms@localhost:5432/lms"
    redis_url: str = "redis://localhost:6379/0"
    api_instance: str = "local"
    worker_id: int = Field(default=1, ge=0, le=1023)
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_expire_hours: int = Field(default=24, ge=1, le=168)
    # R12: OTLP gRPC host:port only, e.g. otel-collector:4317 (set in .env with observability profile)
    otel_exporter_otlp_endpoint: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OTEL_EXPORTER_OTLP_ENDPOINT", "otel_exporter_otlp_endpoint"),
    )
    otel_service_name: str = Field(
        default="lms-api",
        validation_alias=AliasChoices("OTEL_SERVICE_NAME", "otel_service_name"),
    )
    submission_storage_path: str = Field(
        default="/data/submissions",
        validation_alias=AliasChoices("SUBMISSION_STORAGE_PATH", "submission_storage_path"),
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
