# End-to-end verification

## Actual runtime observations

The temporary Windows stack used frontend port 3001 and backend port 8001. These were live operational checks of the launched services. Automated suites remain server-only.

| Check | Actual result |
| --- | --- |
| `npm.cmd run build` | PASS, exit 0. Next.js 16.4.6 compiled, completed TypeScript checking and generated 19 product pages plus two framework fallback pages. |
| `node --check scripts/nexusai.mjs` | PASS, exit 0. |
| `docker compose config --quiet` | PASS, exit 0 with a Docker client configuration permission warning. The engine was unreachable, so image builds and container startup are BLOCKED. |
| Run the launcher while both services are present | PASS. The launcher reused the responding stack instead of starting duplicate listeners. |
| Launch both services on 3001 and 8001 | PASS with approved local execution. The first restricted attempt encountered a permissions error reading the existing Python environment. |
| Direct API paths | PASS. `/health`, `/api/v1/status`, and `/openapi.json` returned 200. The live OpenAPI document listed the health, readiness and status paths. An invalid status query returned 422. |
| FastAPI database readiness | PASS for the absent configuration. `/ready` returned 503 with `database: not_configured`. Live PostgreSQL connectivity is BLOCKED. |
| Frontend page and gateway | PASS. `/dashboard`, `/api/system/health`, and `/api/system/status` returned 200. The restricted readiness proxy returned 403 and an unknown probe returned 404. |
| Default ports and product page delivery | PASS. The launcher started the rebuilt frontend on 3000 and reused the original API on 8000. All 19 product page URLs returned HTTP 200. |
| `STOP_ALL.cmd` | PASS with approved execution in the same context as the launcher. A restricted shell received `EPERM` when connecting to its pipe. Shutdown released 3001 and 8001 and left the original API on 8000 listening. |
| Remote backend | BLOCKED. An authorized remote origin was unavailable. |
| Backend Pytest, frontend unit tests, ESLint, Playwright | BLOCKED. No designated test server was available. Zero suite runs. The production build included a TypeScript check. |
| Browser visual QA, successful user journeys and screenshots | BLOCKED. No designated test server was available for browser testing. No screenshots were captured. |

## Requested acceptance journey

| Steps | Result and reason |
| --- | --- |
| 1 · Start the application | PASS. The Windows launcher started both supported services. |
| 2 · Open frontend in a browser | BLOCKED by server-only browser verification. The dashboard HTML returned HTTP 200. |
| 3–5 · Register, log in, create a workspace | NOT IMPLEMENTED. Authentication and workspace APIs are missing. |
| 6 · Open the dashboard | PASS for HTTP delivery and live API gateway responses. Browser interaction remains BLOCKED. |
| 7–11 · Upload, index, ask a question, receive grounded output, inspect evidence | NOT IMPLEMENTED. Document, indexing, retrieval and RAG services are missing. |
| 12–13 · Submit an agent task and observe execution | NOT IMPLEMENTED. No executable agent workflow or task API. |
| 14 · Run an authorized SQL query | NOT IMPLEMENTED. No analytical schema or read-only SQL service. |
| 15–17 · Upload a dataset, analyze it, generate a prediction | NOT IMPLEMENTED. Dataset services and approved model artifacts are missing. |
| 18 · Inspect verification | NOT IMPLEMENTED. No verification service or results. |
| 19–20 · Generate and download a report | NOT IMPLEMENTED. No report service or stored artifacts. |
| 21 · Refresh and verify persisted data | NOT IMPLEMENTED for backend data. No workspace persistence is available. |
| 22–23 · Log out and verify protected routes | NOT IMPLEMENTED. No authenticated sessions or protected workspace routes. |

See [installation](INSTALLATION.md), the [API integration report](API_INTEGRATION_REPORT.md), and the [bug fix report](BUG_FIX_REPORT.md).
