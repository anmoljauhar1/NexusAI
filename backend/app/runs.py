import json
from uuid import uuid4

from sqlalchemy import text


class RunLeaseLost(RuntimeError):
    pass


def report_events(engine, workspace_id, run_id, lease, question, checkpoint, settings):
    from backend.app.research import stream_research

    state = checkpoint
    try:
        completed_steps = len(checkpoint["steps"])
        for state in stream_research(engine, workspace_id, question, settings, checkpoint):
            if len(state["steps"]) <= completed_steps:
                continue
            with engine.begin() as connection:
                saved = connection.execute(text("""
                    UPDATE nexus_runs SET checkpoint = CAST(:checkpoint AS jsonb),
                        lease_until = now() + interval '2 minutes', updated_at = now()
                    WHERE id = :id AND lease_token = :lease
                """), {"id": run_id, "lease": lease, "checkpoint": json.dumps(state)})
                if saved.rowcount != 1:
                    raise RunLeaseLost()
            completed_steps = len(state["steps"])
            yield "step", state["steps"][-1]
        report_id, title = uuid4(), question[:120]
        with engine.begin() as connection:
            owned = connection.execute(text("""
                SELECT 1 FROM nexus_runs WHERE id = :id AND lease_token = :lease FOR UPDATE
            """), {"id": run_id, "lease": lease}).scalar()
            if not owned:
                raise RunLeaseLost()
            connection.execute(text("""
                INSERT INTO nexus_reports (id, workspace_id, title, body, evidence)
                VALUES (:id, :workspace, :title, :body, CAST(:evidence AS jsonb))
            """), {"id": report_id, "workspace": workspace_id, "title": title, "body": state["body"],
                   "evidence": json.dumps({"sources": state["verified"], "steps": state["steps"]})})
            connection.execute(text("""
                UPDATE nexus_runs SET status = 'completed', report_id = :report,
                    lease_token = NULL, lease_until = NULL, updated_at = now()
                WHERE id = :id
            """), {"id": run_id, "report": report_id})
        yield "result", {"id": str(report_id), "title": title, "body": state["body"], "steps": state["steps"]}
    finally:
        with engine.begin() as connection:
            connection.execute(text("""
                UPDATE nexus_runs SET status = 'failed', lease_until = NULL, lease_token = NULL, updated_at = now()
                WHERE id = :id AND lease_token = :lease AND status = 'running'
            """), {"id": run_id, "lease": lease})
