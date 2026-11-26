from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response

from backend.app.core.config import API_VERSION, SERVICE_NAME, SERVICE_VERSION
from backend.app.core.errors import ErrorResponse
from backend.app.database.connection import Database
from backend.app.schemas.status import HealthResponse, ReadinessResponse, StatusResponse

health_router = APIRouter(tags=["health"])
status_router = APIRouter(prefix=f"/api/{API_VERSION}", tags=["status"])


def get_database(request: Request) -> Database:
    return request.app.state.database


DatabaseDependency = Annotated[Database, Depends(get_database)]


@health_router.get("/health")
def health() -> HealthResponse:
    return HealthResponse()


@health_router.get(
    "/ready",
    responses={503: {"model": ReadinessResponse, "description": "Database is not ready"}},
)
def readiness(response: Response, database: DatabaseDependency) -> ReadinessResponse:
    status = database.check()
    if status == "available":
        return ReadinessResponse(status="ready", database=status)

    response.status_code = 503
    return ReadinessResponse(status="not_ready", database=status)


@status_router.get(
    "/status",
    responses={422: {"model": ErrorResponse, "description": "Invalid status query"}},
)
def service_status(
    database: DatabaseDependency,
    include_database: Annotated[
        bool, Query(description="Run a database connection check and include its result.")
    ] = False,
) -> StatusResponse:
    return StatusResponse(
        service=SERVICE_NAME,
        version=SERVICE_VERSION,
        api_version=API_VERSION,
        database=database.check() if include_database else None,
    )
