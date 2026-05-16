"""Static file handler that falls back to index.html for client-side routes (React Router)."""

from __future__ import annotations

from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles


class SpaStaticFiles(StaticFiles):
    """Serve built Vite assets; unknown paths get index.html so refresh on /courses/1 works."""

    async def get_response(self, path: str, scope):  # type: ignore[override]
        if path in {"", "."}:
            path = "index.html"
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise
