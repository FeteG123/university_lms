from __future__ import annotations
import time
from collections import defaultdict
from threading import Lock
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

BUCKET_CAPACITY = 100   # max tokens per client (matches NFR: 100 req/min)
REFILL_RATE = 100 / 60  # tokens per second (~1.67/sec)

class TokenBucket:
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = float(capacity)
        self.last_refill = time.monotonic()

    def _refill(self):
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

    def consume(self) -> bool:
        self._refill()
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False

class RateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, capacity: int = BUCKET_CAPACITY, refill_rate: float = REFILL_RATE):
        super().__init__(app)
        self.capacity = capacity
        self.refill_rate = refill_rate
        self._buckets: dict[str, TokenBucket] = defaultdict(self._make_bucket)
        self._lock = Lock()

    def _make_bucket(self) -> TokenBucket:
        return TokenBucket(self.capacity, self.refill_rate)

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        with self._lock:
            bucket = self._buckets[client_ip]
            allowed = bucket.consume()
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"error": "Too Many Requests", "message": f"Max {self.capacity} requests/min per IP."},
                headers={"Retry-After": "60"},
            )
        return await call_next(request)
