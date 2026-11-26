FROM ghcr.io/astral-sh/uv:0.7.20 AS uv
FROM python:3.13-slim AS dependencies
WORKDIR /app
COPY --from=uv /uv /bin/uv
COPY pyproject.toml uv.lock ./
ARG NEXUSAI_WITH_AGENTS=false
RUN if [ "$NEXUSAI_WITH_AGENTS" = "true" ]; then \
        uv sync --locked --no-dev --no-install-project --group agents; \
    else uv sync --locked --no-dev --no-install-project; fi

FROM python:3.13-slim AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY --from=dependencies /app/.venv /app/.venv
COPY backend/app /app/backend/app
COPY backend/migrations /app/backend/migrations
COPY alembic.ini /app/alembic.ini
USER 10001:10001
EXPOSE 8000
CMD ["/app/.venv/bin/python", "-m", "uvicorn", "backend.app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
