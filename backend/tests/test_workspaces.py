import importlib.util
import json
import logging
import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.core.config import Settings
from backend.app.database.connection import Database
from backend.app.knowledge import process_next
from backend.app.main import create_app

INTENT = {"X-NexusAI-Request": "workspace"}
PASSWORD = "temporary-test-password"


@pytest.mark.integration
def test_document_to_private_citation():
    url = os.getenv("NEXUSAI_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set NEXUSAI_TEST_DATABASE_URL to an isolated, migrated PostgreSQL database.")
    settings = Settings(_env_file=None, database_url=url, environment="test",
                        process_documents=False, ollama_url=None, rerank_url=None)
    database = Database(settings)
    assert database.engine is not None
    app = create_app(settings)
    emails = [f"test-{uuid4()}@example.test" for _ in range(2)]
    try:
        with TestClient(app) as first:
            signup = first.post("/api/v1/auth/register", headers=INTENT,
                                json={"email": emails[0], "password": PASSWORD})
            assert signup.status_code == 201
            workspace = first.get("/api/v1/workspaces").json()[0]["id"]
            root = f"/api/v1/workspaces/{workspace}"
            content = b"The hedgehog allocation is exactly 127 units."
            upload = first.post(f"{root}/documents?name=sample.txt", headers=INTENT, content=content)
            assert upload.status_code == 202
            document = f"{root}/documents/{upload.json()['id']}"

            assert process_next(database.engine, settings, logging.getLogger("test"))
            response = first.post(f"{root}/chat", headers=INTENT, json={"question": "hedgehog"})
            assert response.status_code == 200
            result = response.json()["result"]
            assert "127 units" in result["answer"]
            citation = result["sources"][0]["id"]
            assert first.get(f"{root}/sources/{citation}").status_code == 200
            catalog = first.get(f"{root}/documents/catalog", params={"q": "SAMPLE", "state": "ready"})
            assert [item["id"] for item in catalog.json()["items"]] == [upload.json()["id"]]
            preview = first.get(f"{document}/file")
            assert preview.content == content
            assert preview.headers["content-type"].startswith("text/plain")
            assert first.post(f"{document}/reindex", headers=INTENT).status_code == 202
            assert process_next(database.engine, settings, logging.getLogger("test"))
            assert first.get(f"{root}/sources/{citation}").status_code == 200
            if importlib.util.find_spec("langgraph") is not None:
                run = uuid4()
                checkpoint = {"steps": ["Retrieved workspace evidence"], "sources": result["sources"]}
                with database.engine.begin() as connection:
                    connection.execute(text("""
                        INSERT INTO nexus_runs (id, workspace_id, question, status, checkpoint, lease_until)
                        VALUES (:id, :workspace, 'hedgehog', 'running', CAST(:checkpoint AS jsonb), now())
                    """), {"id": run, "workspace": workspace, "checkpoint": json.dumps(checkpoint)})
                assert first.get(f"{root}/runs").json()[0]["status"] == "interrupted"
                resumed = first.post(f"{root}/runs/{run}/resume", headers=INTENT)
                assert resumed.status_code == 201
                assert resumed.json()["steps"] == [*checkpoint["steps"], "Verified 1 stored passages", "Assembled Markdown report"]
                saved = first.get(f"{root}/runs").json()[0]
                assert saved["status"] == "completed"
                assert first.get(f"{root}/reports").json()[0]["id"] == saved["report_id"]
                assert first.post(f"{root}/runs/{run}/resume", headers=INTENT).status_code == 409
            with TestClient(create_app(settings)) as second:
                assert second.post("/api/v1/auth/register", headers=INTENT,
                                   json={"email": emails[1], "password": PASSWORD}).status_code == 201
                assert second.get(f"{root}/sources/{citation}").status_code == 404
                assert second.get(f"{document}/file").status_code == 404
                assert second.delete(document, headers=INTENT).status_code == 404
            assert first.delete(document, headers=INTENT).status_code == 204
            assert first.get(f"{root}/sources/{citation}").status_code == 404

            profile = first.post("/api/v1/auth/profile", headers=INTENT, json={"display_name": "Reviewer"})
            assert profile.json()["display_name"] == "Reviewer"
            login = {"email": emails[0], "password": PASSWORD}
            with TestClient(create_app(settings)) as other_browser:
                assert other_browser.post("/api/v1/auth/login", headers=INTENT, json=login).status_code == 200
                sessions = first.get("/api/v1/auth/sessions").json()
                session = next(session for session in sessions if not session["current"])
                assert first.post(f"/api/v1/auth/sessions/{session['id']}/revoke", headers=INTENT).status_code == 204
                assert other_browser.get("/api/v1/auth/session").status_code == 401
                assert other_browser.post("/api/v1/auth/login", headers=INTENT, json=login).status_code == 200
                change = first.post("/api/v1/auth/password", headers=INTENT, json={
                    "current_password": PASSWORD, "new_password": "replacement-test-password",
                })
                assert change.status_code == 200
                assert first.get("/api/v1/auth/session").json()["display_name"] == "Reviewer"
                assert other_browser.get("/api/v1/auth/session").status_code == 401
                assert other_browser.post("/api/v1/auth/login", headers=INTENT, json=login).status_code == 401
            assert first.post("/api/v1/auth/logout", headers=INTENT).status_code == 204
            assert first.get(f"{root}/documents").status_code == 401
    finally:
        with database.engine.begin() as connection:
            connection.execute(text("DELETE FROM nexus_users WHERE email = ANY(:emails)"),
                               {"emails": emails})
        database.close()
