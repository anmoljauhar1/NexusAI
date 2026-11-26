"""Create NexusAI accounts, workspaces, knowledge and report records."""

from alembic import op

revision = "0001_workspace"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("""
        CREATE TABLE nexus_users (
            id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL
        )
    """)
    op.execute("""
        CREATE TABLE nexus_sessions (
            token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES nexus_users
                ON DELETE CASCADE, expires_at timestamptz NOT NULL
        )
    """)
    op.execute("CREATE INDEX nexus_sessions_expiry ON nexus_sessions (expires_at)")
    op.execute("""
        CREATE TABLE nexus_workspaces (
            id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES nexus_users ON DELETE CASCADE,
            name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX nexus_workspace_owner ON nexus_workspaces (owner_id)")
    op.execute("""
        CREATE TABLE nexus_documents (
            id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES nexus_workspaces
                ON DELETE CASCADE, name text NOT NULL, digest text NOT NULL, content bytea NOT NULL,
            state text NOT NULL DEFAULT 'queued'
                CHECK (state IN ('queued','processing','ready','failed')),
            error text, attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, lease_token uuid,
            created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (workspace_id, digest),
            UNIQUE (workspace_id, id)
        )
    """)
    op.execute("CREATE INDEX nexus_document_jobs ON nexus_documents (state, created_at)")
    op.execute("""
        CREATE TABLE nexus_chunks (
            id uuid PRIMARY KEY, workspace_id uuid NOT NULL, document_id uuid NOT NULL,
            source_page integer NOT NULL, ordinal integer NOT NULL, passage text NOT NULL,
            terms tsvector GENERATED ALWAYS AS (to_tsvector('english', passage)) STORED,
            embedding vector(384), embedding_model text, UNIQUE(document_id, ordinal),
            FOREIGN KEY (workspace_id, document_id)
                REFERENCES nexus_documents (workspace_id, id) ON DELETE CASCADE
        )
    """)
    op.execute("CREATE INDEX nexus_chunk_workspace ON nexus_chunks (workspace_id)")
    op.execute("CREATE INDEX nexus_chunk_terms ON nexus_chunks USING gin (terms)")
    op.execute("""
        CREATE TABLE nexus_exchanges (
            id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES nexus_workspaces
                ON DELETE CASCADE, question text NOT NULL, result jsonb NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE nexus_reports (
            id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES nexus_workspaces
                ON DELETE CASCADE, title text NOT NULL, body text NOT NULL, evidence jsonb NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        )
    """)
    for table in ("exchanges", "reports"):
        op.execute(f"CREATE INDEX nexus_{table}_history ON nexus_{table} (workspace_id, created_at DESC)")


def downgrade():
    for table in ("reports", "exchanges", "chunks", "documents", "workspaces", "sessions", "users"):
        op.execute(f"DROP TABLE nexus_{table}")
