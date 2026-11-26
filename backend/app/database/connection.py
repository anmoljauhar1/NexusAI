from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.exc import SQLAlchemyError

from backend.app.core.config import Settings
from backend.app.schemas.status import DatabaseStatus


class Database:
    def __init__(self, settings: Settings) -> None:
        self.engine: Engine | None = None
        if settings.database_url is not None:
            url = make_url(settings.database_url.get_secret_value())
            self.engine = create_engine(
                url.set(drivername="postgresql+psycopg"),
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=0,
                pool_timeout=settings.database_connect_timeout_seconds,
                connect_args={
                    "connect_timeout": settings.database_connect_timeout_seconds,
                    "options": f"-c statement_timeout={settings.database_statement_timeout_ms}",
                },
                hide_parameters=True,
            )

    def check(self) -> DatabaseStatus:
        if self.engine is None:
            return "not_configured"

        try:
            with self.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError:
            return "unavailable"
        return "available"

    def close(self) -> None:
        if self.engine is not None:
            self.engine.dispose()
