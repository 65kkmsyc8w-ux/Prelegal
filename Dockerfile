FROM node:24-slim AS frontend

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM python:3.13-slim AS base

COPY --from=ghcr.io/astral-sh/uv:0.9.9 /uv /usr/local/bin/uv

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

COPY backend/pyproject.toml backend/uv.lock ./


FROM base AS test

RUN uv sync --frozen

COPY backend/app ./app
COPY backend/tests ./tests
COPY --from=frontend /frontend/out ./static

CMD ["pytest"]


FROM base AS runtime

RUN uv sync --frozen --no-dev

COPY backend/app ./app
COPY --from=frontend /frontend/out ./static

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
