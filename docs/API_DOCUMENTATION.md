# API documentation

## Stage 2

| Endpoint | Behavior |
| --- | --- |
| `GET /` | Returns HTTP 307 to Swagger UI when enabled, otherwise to the versioned API status endpoint. |
| `GET /health` | Returns HTTP 200 with `{"status":"ok"}` while the application serves requests. |
| `GET /ready` | Returns HTTP 200 with `{"status":"ready","database":"available"}` after a successful database probe. Returns HTTP 503 with `status: not_ready` and `database: not_configured` or `unavailable` otherwise. |
| `GET /api/v1/status` | Returns service name, version, API version, and status. Add `?include_database=true` to include a database probe result. The default `database` field is null. Invalid boolean values return HTTP 422. |
| `GET /docs` | Swagger UI. |
| `GET /redoc` | ReDoc UI. |
| `GET /openapi.json` | OpenAPI schema with the health, readiness, and status response models. |

Every HTTP response includes a server-generated `X-Request-ID`. HTTP exceptions, request validation failures, and unexpected server errors use an `error` object with `code`, `message`, `request_id`, and `details`. Validation details contain the failing field location and error code. The operational readiness response has its own schema.

Swagger UI, ReDoc, and their schema route can be disabled with `NEXUSAI_DOCS_ENABLED=false`.
