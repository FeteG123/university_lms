"""Process-local Snowflake generator (R11)."""

from functools import lru_cache

from app.config import get_settings
from app.from_scratch.snowflake import SnowflakeGenerator


@lru_cache
def get_snowflake() -> SnowflakeGenerator:
    return SnowflakeGenerator(worker_id=get_settings().worker_id)
