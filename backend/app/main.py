import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.responses import RedirectResponse

from backend.app.api.accounts import router as account_router
from backend.app.api.status import health_router, status_router
from backend.app.api.workspace import router as workspace_router
from backend.app.core.config import SERVICE_NAME, SERVICE_VERSION, Settings
from backend.app.core.errors import error_response, register_error_handlers
from backend.app.core.logging import configure_logging
from backend.app.database.connection import Database
from backend.app.knowledge import document_worker


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else Settings()
    logger = configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        database = Database(settings)
        app.state.database = database
        app.state.settings = settings
        stop = asyncio.Event()
        worker = None
        if database.engine is not None and settings.process_documents:
            worker = asyncio.create_task(document_worker(database.engine, settings, logger, stop))
        logger.info("application_started", extra={"fields": {"environment": settings.environment}})
        try:
            yield
        finally:
            stop.set()
            if worker:
                try:
                    await asyncio.wait_for(worker, timeout=8)
                except TimeoutError:
                    logger.warning("document_worker_shutdown_timeout")
            database.close()
            logger.info("application_stopped")

    app = FastAPI(
        title=SERVICE_NAME,
        version=SERVICE_VERSION,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url="/redoc" if settings.docs_enabled else None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
        lifespan=lifespan,
    )
    register_error_handlers(app)
    app.include_router(health_router)
    app.include_router(status_router)
    app.include_router(account_router)
    app.include_router(workspace_router)

    @app.get("/", include_in_schema=False)
    async def index(request: Request) -> RedirectResponse:
        destination = "swagger_ui_html" if settings.docs_enabled else "service_status"
        return RedirectResponse(request.url_for(destination).path)

    @app.middleware("http")
    async def observe_request(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = uuid4().hex
        request.state.request_id = request_id
        started = perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            logger.error(
                "request_failed",
                extra={"fields": {"request_id": request_id, "exception": type(exc).__name__}},
            )
            response = error_response(
                request, 500, "internal_error", "An unexpected error occurred."
            )

        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request_completed",
            extra={
                "fields": {
                    "request_id": request_id,
                    "method": request.method,
                    "route": getattr(request.scope.get("route"), "path", None),
                    "status_code": response.status_code,
                    "duration_ms": round((perf_counter() - started) * 1000, 2),
                }
            },
        )
        return response

    return app
