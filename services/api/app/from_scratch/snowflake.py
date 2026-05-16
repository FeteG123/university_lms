"""Snowflake-style 64-bit unique IDs (time-ordered, process-safe).

Layout: 41-bit millis since custom epoch | 10-bit worker | 12-bit sequence.
Integrated for public submission identifiers (R11).
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

# 2024-01-01T00:00:00Z — keeps IDs smaller than Twitter epoch while staying monotonic in project lifetime.
_EPOCH_MS = 1_704_067_200_000


@dataclass
class SnowflakeGenerator:
    """Generate up to 4096 IDs per worker per millisecond."""

    worker_id: int
    _seq: int = field(default=0, repr=False)
    _last_ms: int = field(default=-1, repr=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def __post_init__(self) -> None:
        wid = int(self.worker_id)
        if wid < 0 or wid > 0x3FF:
            raise ValueError("worker_id must be 0..1023")

    def next_id(self) -> int:
        with self._lock:
            ms = int(time.time() * 1000)
            if ms < self._last_ms:
                raise RuntimeError("clock moved backwards; refuse to generate id")
            if ms == self._last_ms:
                self._seq = (self._seq + 1) & 0xFFF
                if self._seq == 0:
                    while int(time.time() * 1000) <= self._last_ms:
                        time.sleep(0.001)
                    ms = int(time.time() * 1000)
            else:
                self._seq = 0
            self._last_ms = ms
            ts_part = (ms - _EPOCH_MS) & ((1 << 41) - 1)
            wid = int(self.worker_id) & 0x3FF
            return (ts_part << 22) | (wid << 12) | self._seq
