import json
import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import Settings
from backend.app.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    settings = Settings(
        _env_file=None, environment="test", docs_enabled=True, database_url=None, log_level="INFO"
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client


def test_liveness(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["X-Request-ID"]


def test_base_url_redirects_to_swagger(client: TestClient) -> None:
    response = client.get("/", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["Location"] == "/docs"


def test_base_url_redirects_to_status_when_docs_are_disabled() -> None:
    settings = Settings(_env_file=None, environment="test", docs_enabled=False, database_url=None)
    with TestClient(create_app(settings)) as client:
        response = client.get("/", follow_redirects=False)

        assert response.status_code == 307
        assert response.headers["Location"] == "/api/v1/status"
        assert client.get("/").status_code == 200
        assert client.get("/docs").status_code == 404


def test_versioned_status(client: TestClient) -> None:
    response = client.get("/api/v1/status")

    assert response.status_code == 200
    assert response.json() == {
        "service": "NexusAI",
        "version": "0.1.0",
        "api_version": "v1",
        "status": "ok",
        "database": None,
    }


def test_database_status_is_optional(client: TestClient) -> None:
    response = client.get("/api/v1/status", params={"include_database": "true"})

    assert response.status_code == 200
    assert response.json()["database"] == "not_configured"


def test_readiness_without_database(client: TestClient) -> None:
    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "not_ready", "database": "not_configured"}
    assert client.get("/health").status_code == 200


def test_unavailable_database_does_not_break_liveness() -> None:
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url="postgresql+psycopg://127.0.0.1:1/nexusai",
    )
    with TestClient(create_app(settings)) as client:
        response = client.get("/ready")

        assert response.status_code == 503
        assert response.json() == {"status": "not_ready", "database": "unavailable"}
        assert client.get("/health").status_code == 200


def test_request_validation_omits_submitted_value(client: TestClient) -> None:
    response = client.get("/api/v1/status", params={"include_database": "invalid-value"})

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]
    assert error["details"][0]["location"] == ["query", "include_database"]
    assert "invalid-value" not in response.text


def test_http_errors_use_the_same_envelope(client: TestClient) -> None:
    response = client.get("/missing")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]

    response = client.post("/health")
    assert response.status_code == 405
    assert "GET" in response.headers["Allow"]


def test_unexpected_error_keeps_details_private() -> None:
    settings = Settings(_env_file=None, environment="test", database_url=None)
    app = create_app(settings)

    @app.get("/test-failure")
    def fail() -> None:
        raise RuntimeError("private diagnostic")

    with TestClient(app) as client:
        response = client.get("/test-failure")

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]
    assert "private diagnostic" not in response.text


def test_request_log_is_structured_and_excludes_query_values(
    capsys: pytest.CaptureFixture[str],
) -> None:
    settings = Settings(
        _env_file=None, environment="test", database_url=None, log_level="INFO"
    )
    with TestClient(create_app(settings)) as client:
        response = client.get("/health", params={"value": "private-query"})

    events = [json.loads(line) for line in capsys.readouterr().err.splitlines()]
    event = next(event for event in events if event["event"] == "request_completed")
    assert event["request_id"] == response.headers["X-Request-ID"]
    assert event["route"] == "/health"
    assert event["status_code"] == 200
    assert "private-query" not in json.dumps(events)


def test_swagger_and_openapi(client: TestClient) -> None:
    assert client.get("/docs").status_code == 200
    response = client.get("/openapi.json")

    assert response.status_code == 200
    routes = response.json()["paths"]
    assert {"/health", "/ready", "/api/v1/status"} <= routes.keys()
    assert "422" in routes["/api/v1/status"]["get"]["responses"]
    assert "503" in routes["/ready"]["get"]["responses"]


@pytest.mark.integration
def test_readiness_against_postgresql() -> None:
    database_url = os.getenv("NEXUSAI_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Set NEXUSAI_TEST_DATABASE_URL to run against PostgreSQL.")

    settings = Settings(_env_file=None, environment="test", database_url=database_url)
    with TestClient(create_app(settings)) as client:
        response = client.get("/ready")

        assert response.status_code == 200
        assert response.json() == {"status": "ready", "database": "available"}
