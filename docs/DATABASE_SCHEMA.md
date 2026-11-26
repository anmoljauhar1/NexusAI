# Database schema

Stage 2 adds PostgreSQL connection configuration, a SQLAlchemy engine scoped to the application lifespan, and a `SELECT 1` readiness probe. The engine opens connections on demand and disposes of its pool on shutdown.

The proposed Stage 3 entities, workspace isolation rules, and indexes are listed in the [architecture's PostgreSQL design](ARCHITECTURE.md#postgresql-design). Tables, migrations, and the pgvector extension are pending Stage 3 approval.
