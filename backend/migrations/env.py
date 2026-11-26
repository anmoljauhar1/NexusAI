from alembic import context
from sqlalchemy.engine import make_url

from backend.app.core.config import Settings
from backend.app.database.connection import Database

settings = Settings()
if settings.database_url is None:
    raise RuntimeError("Set NEXUSAI_DATABASE_URL before running database migrations.")

if context.is_offline_mode():
    url = make_url(settings.database_url.get_secret_value()).set(drivername="postgresql+psycopg")
    context.configure(url=url, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    database = Database(settings)
    assert database.engine is not None
    try:
        with database.engine.connect() as connection:
            context.configure(connection=connection)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        database.close()
