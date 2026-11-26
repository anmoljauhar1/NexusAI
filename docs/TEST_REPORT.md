# Test report

## Stage 2

| Check | Execution status |
| --- | --- |
| Pytest application and configuration suite | Pending a designated test server |
| Ruff | Pending a designated test server |
| Uvicorn startup and live HTTP smoke checks | Pending a designated test server |
| PostgreSQL connectivity integration test | Pending a designated test server and a test database URL |

The suite covers liveness, versioned status, readiness with absent or unreachable PostgreSQL, validated configuration and query inputs, sanitized error responses, request correlation, structured logs, and Swagger/OpenAPI. The integration test additionally checks readiness against real PostgreSQL.

The user requested server-only test execution. No tests, lint checks, or runtime checks were executed locally. See the [server setup and verification commands](../README.md#server-setup-and-verification).

## Part 2 Stage 1 audit

The audit identified 12 application test definitions and one PostgreSQL integration test definition. There were zero test runs and no recorded passes, failures or skips. Server-only verification remains blocked because no test server was identified. PostgreSQL verification also requires an authorized test database. [Audit findings](PART_2_STAGE_1_AUDIT.md)

## Part 3 Stage 1 audit

The test definitions are unchanged. Static source review was completed, with zero automated test runs. Server startup, live endpoints, dependency scans, database integration, image builds and end-to-end tests have no recorded results. No designated server or test database was found, and Docker's engine was unreachable from the workspace. [Production readiness audit](PART_3_STAGE_1_AUDIT.md)

## Startup follow-up

The workspace now contains `uv.lock`. Added two regression tests for the base URL with Swagger enabled and disabled. The suite now defines 14 application tests and one PostgreSQL integration test. The user reconfirmed server-only testing. No server target was available and no tests were executed in this follow-up.

## Frontend integration

| Command or check | Result |
| --- | --- |
| `npm.cmd install --package-lock-only --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=9000 --cache .npm-cache` | Exit 1. The restricted session could not reach the npm registry. |
| `npm.cmd install --package-lock-only --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=12000 --cache .npm-cache` with approved registry access | Exit 0. Created the frontend lockfile. |
| `npm.cmd ci --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000 --cache .npm-cache` with approved registry access | Exit 0. npm installed 466 packages and reported an ESLint version support warning. |
| First `npm.cmd run build`, with Next.js telemetry disabled | Exit 1. Fontsource CSS imports had the wrong subpath suffix. |
| Second `npm.cmd run build`, with Next.js telemetry disabled | Exit 0 after fixing those imports. Next.js 16.4.6 compiled, completed TypeScript checking and generated 19 product pages and two framework fallback pages. The system-check route was included as a dynamic endpoint. |
| ESLint and standalone type check | No runs on the designated server. The build's TypeScript phase passed. |
| Node unit tests, Playwright and Python regressions | Zero runs, with no observed passes, failures or skips. A designated test server has not been identified. |
| Live FastAPI calls, browser QA and screenshots | Pending server access. No screenshots captured. |
| Full user journey | Blocked by missing authentication, workspace, document, RAG, agent, model, verification and report services. |

See the [frontend verification commands](../frontend/README.md#verify-on-the-designated-server) and [integration matrix](FRONTEND_INTEGRATION.md).

## Unified startup and repair

The rebuilt frontend and FastAPI launched on temporary local ports. Live HTTP checks confirmed the dashboard, versioned status and health through the frontend gateway, expected error responses, and the absence of database configuration. The stop command released the temporary listeners and left the original backend listening. See the [end-to-end report](END_TO_END_TEST_REPORT.md) for individual results and blocked acceptance steps.

## Workspace implementation

| Check | Actual result |
| --- | --- |
| `uv lock` and `uv sync --locked --group agents` | Passed. Installed Alembic, pypdf and the optional agent group. |
| `npm.cmd run build` | Passed after the gateway origin fix. Next.js compiled, type-checked, and built 19 product pages. |
| Database profile and Alembic | Docker Desktop started, the PostgreSQL 17 container became ready, and migration `0001_workspace` applied. Queried pgvector version 0.8.7. |
| Live account and document flow | Two synthetic accounts registered. Verified PDF upload, durable indexing, duplicate detection, streamed reply, page 1 citation, saved chat history, denial of cross-workspace reads, cross-origin rejection, logout and sign-in. |
| Live analytics and SQL | A 24-row synthetic CSV selected the linear trend and returned the expected next value of 58. Verified an approved SQL template and rejection of an unsupported write request. |
| Live research report | The first client check timed out after 12 seconds during LangGraph's cold import. With a timeout within the application's configured request budget, the rerun streamed three completed steps and returned a persisted Markdown report. |
| Default browser URL | Dashboard HTML and FastAPI gateway responded on port 3000, with the upgraded FastAPI on port 8001 and PostgreSQL on port 5432. The original backend on port 8000 was left running. |
| Fixture cleanup | Deleted only the four synthetic test accounts created for the two runs, and their cascading workspace data. |
| Provider tests and reviewed benchmark | Pending configured semantic, reranking and LLM services and reviewed labels. No model weights downloaded. |
| Automated suites and browser screenshots | Pending a designated test server. The live verification above used HTTP requests against the running local application and database. |

## Account and profile follow-up

The production frontend build and its TypeScript check passed. The running profile route returned HTTP 200. A live check through the gateway verified anonymous session rejection, registration, a stable Account ID, two workspaces for the same account, incorrect password rejection, logout cookie expiration, server-side revocation, and a new login session. The one synthetic account was removed afterward. FastAPI, the frontend gateway, and PostgreSQL readiness were available after restart. The added Playwright profile regression and cross-tab UI behavior have not been run on a designated test server.

## Document, account and agent upgrades

The production Next.js build passed. The Windows launcher restarted the frontend and FastAPI and reported PostgreSQL ready. PostgreSQL reported Alembic revision `0002_account_runs`. Browser and backend regressions were added for the document catalog, citation links, session management and checkpoint recovery. These suites are pending a designated test server. Email delivery and retrieval benchmark results require SMTP, model endpoints and reviewed benchmark labels.
