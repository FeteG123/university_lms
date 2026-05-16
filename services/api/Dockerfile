# Frontend build uses the same base as the API image (python:3.12-slim) + Debian's Node
# packages — avoids pulling a separate node:*-alpine image (often fixes "short read … unexpected EOF"
# from flaky Docker Hub / network).

FROM python:3.12-slim AS frontend
WORKDIR /frontend
RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm \
    && rm -rf /var/lib/apt/lists/* \
    && (test -x /usr/bin/node || ln -sf /usr/bin/nodejs /usr/bin/node)
COPY services/web/package.json ./
RUN npm install
COPY services/web/ ./
RUN npm run build

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY services/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/api/alembic.ini .
COPY services/api/alembic ./alembic
COPY services/api/app ./app
COPY --from=frontend /frontend/dist ./static

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
