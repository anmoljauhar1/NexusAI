# API integration report

The gateway was compared with FastAPI source and the running OpenAPI routes. Each wired operation is read-only and uses an operator-configured backend origin. This companion report extends the [page-by-page matrix](FRONTEND_INTEGRATION.md#integration-matrix).

| Page and action | Frontend endpoint | FastAPI endpoint | Request | Response | Access and status |
| --- | --- | --- | --- | --- | --- |
| Dashboard or monitor liveness | `GET /api/system/health` | `GET /health` | No body | JSON with `status: ok`, correlation ID and measured probe duration headers | Available without an application session |
| Dashboard or monitor service version | `GET /api/system/status` | `GET /api/v1/status` | No body | Service name, release version, API version, status, and nullable database field | Available without an application session |
| System Monitor database detail | `GET /api/system/readiness` | `GET /ready` | No body | Ready and database available with HTTP 200, or not ready and database unavailable or unconfigured with HTTP 503 | Gateway returns HTTP 403 by default. Enable only on an authorized private deployment. |
| Login, registration, logout | Missing | Missing | No submissions | Account availability messages | Identity and workspace services required |
| AI Assistant and Knowledge Base | Missing | Missing | No prompts or uploads | Service availability messages | Authorized retrieval, evidence and job services required |
| Agent Studio, Research and SQL | Missing | Missing | No workflow or query submissions | Blueprint and service availability messages | Workflow, read-only analytical access and evidence services required |
| Model, analytics, verification, experiments and reports | Missing | Missing | No jobs or downloads | Service availability messages | Dataset, inference, verification, artifact and report services required |

The gateway propagates browser request cancellation to the upstream call, applies a separate timeout, and validates JSON contracts before forwarding. The connection remains same-origin, so the browser needs no separate CORS configuration. The gateway forwards neither cookies nor authorization headers. Identity, pagination, streaming, and workspace isolation remain dependent on backend APIs.
