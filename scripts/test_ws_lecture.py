"""Quick check: lecture WS receives own messages (Redis pub/sub)."""
from __future__ import annotations

import asyncio
import json
import urllib.request

import websockets


async def main() -> None:
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/auth/login",
        data=json.dumps({"email": "student@example.edu", "password": "demo1234"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        token = json.load(r)["access_token"]
    url = f"ws://127.0.0.1:8000/ws/lectures/1?token={token}"
    async with websockets.connect(url) as ws:
        await ws.send("hello test")
        try:
            msg = await asyncio.wait_for(ws.recv(), timeout=3)
            print("RECV:", msg)
        except asyncio.TimeoutError:
            print("RECV: TIMEOUT (no message back)")


if __name__ == "__main__":
    asyncio.run(main())
