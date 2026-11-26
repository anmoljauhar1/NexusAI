from http import HTTPStatus

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import DBAPIError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException


class FieldError(BaseModel):
    location: list[str | int]
    code: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str
    details: list[FieldError]


class ErrorResponse(BaseModel):
    error: ErrorDetail


def error_response(
    request: Request,
    status_code: int,
    code: str,
    message: str,
    *,
    details: list[FieldError] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    payload = ErrorResponse(
        error=ErrorDetail(
            code=code, message=message, request_id=request.state.request_id, details=details or []
        )
    )
    return JSONResponse(payload.model_dump(), status_code=status_code, headers=headers)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DBAPIError)
    async def handle_database_error(request: Request, exc: DBAPIError) -> JSONResponse:
        code = getattr(exc.orig, "sqlstate", None)
        if code == "42P01":
            return error_response(request, 503, "migration_required", "Run the database migrations.")
        if isinstance(exc, OperationalError):
            return error_response(request, 503, "database_unavailable", "The database is unavailable.")
        return error_response(request, 500, "database_error", "The database operation failed.")

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        try:
            status = HTTPStatus(exc.status_code)
            code, message = status.name.lower(), status.phrase
        except ValueError:
            code, message = "http_error", "The request could not be completed."
        if isinstance(exc, HTTPException) and isinstance(exc.detail, str):
            message = exc.detail
        return error_response(request, exc.status_code, code, message, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [
            FieldError(location=list(issue["loc"]), code=issue["type"]) for issue in exc.errors()
        ]
        return error_response(
            request,
            422,
            "validation_error",
            "The request contains invalid data.",
            details=details,
        )
