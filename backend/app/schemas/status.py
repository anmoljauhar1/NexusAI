from typing import Literal

from pydantic import BaseModel

type DatabaseStatus = Literal["not_configured", "available", "unavailable"]


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    database: DatabaseStatus


class StatusResponse(BaseModel):
    service: str
    version: str
    api_version: str
    status: Literal["ok"] = "ok"
    database: DatabaseStatus | None = None
