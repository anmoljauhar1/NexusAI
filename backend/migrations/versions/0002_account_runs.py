"""Add profile settings, reset tokens and recoverable research runs."""

from alembic import op

revision = "0002_account_runs"
down_revision = "0001_workspace"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE nexus_users ADD COLUMN display_name text NOT NULL DEFAULT ''")
    op.execute("ALTER TABLE nexus_sessions ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE")
    op.execute("ALTER TABLE nexus_sessions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now()")
    op.execute("CREATE INDEX nexus_session_user ON nexus_sessions (user_id, created_at)")
    op.execute("""
        CREATE TABLE nexus_resets (
            user_id uuid PRIMARY KEY REFERENCES nexus_users ON DELETE CASCADE,
            token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
            expires_at timestamptz NOT NULL
        )
    """)
    op.execute("""
        CREATE TABLE nexus_runs (
            id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES nexus_workspaces ON DELETE CASCADE,
            question text NOT NULL, status text NOT NULL CHECK (status IN ('running','failed','completed')),
            checkpoint jsonb NOT NULL DEFAULT '{"steps":[]}', lease_token uuid, lease_until timestamptz,
            report_id uuid REFERENCES nexus_reports ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX nexus_run_history ON nexus_runs (workspace_id, created_at DESC)")


def downgrade():
    op.execute("DROP TABLE nexus_runs")
    op.execute("DROP TABLE nexus_resets")
    op.execute("DROP INDEX nexus_session_user")
    op.execute("ALTER TABLE nexus_sessions DROP COLUMN created_at, DROP COLUMN id")
    op.execute("ALTER TABLE nexus_users DROP COLUMN display_name")
