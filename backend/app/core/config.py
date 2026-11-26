from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

SERVICE_NAME = "NexusAI"
SERVICE_VERSION = "0.1.0"
API_VERSION = "v1"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="NEXUSAI_",
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
        hide_input_in_errors=True,
    )

    environment: Literal["development", "test", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    docs_enabled: bool = True
    database_url: SecretStr | None = None
    database_connect_timeout_seconds: int = Field(default=3, ge=2, le=30)
    database_statement_timeout_ms: int = Field(default=3000, ge=100, le=30000)
    process_documents: bool = True
    ollama_url: str | None = None
    embedding_model: str = "all-minilm"
    answer_model: str | None = None
    rerank_url: str | None = None
    reset_public_origin: str | None = None
    smtp_host: str | None = None
    smtp_port: int = Field(default=465, ge=1, le=65535)
    smtp_sender: str | None = None
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None

    @field_validator("ollama_url", "rerank_url", "reset_public_origin")
    @classmethod
    def validate_model_origin(cls, value: str | None) -> str | None:
        if value is None:
            return value
        origin = urlsplit(value)
        if (origin.scheme not in {"http", "https"} or not origin.hostname or origin.username
                or origin.password or origin.query or origin.fragment or origin.path not in {"", "/"}):
            raise ValueError("Configure the model provider as an HTTP or HTTPS origin.")
        return value.rstrip("/")

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr | None) -> SecretStr | None:
        if value is None:
            return None

        try:
            url = make_url(value.get_secret_value())
        except (ArgumentError, ValueError):
            raise ValueError("Expected a valid PostgreSQL connection URL.") from None

        if url.drivername not in {"postgresql", "postgresql+psycopg"} or not url.database:
            raise ValueError("Use a postgresql or postgresql+psycopg URL with a database name.")
        return value
