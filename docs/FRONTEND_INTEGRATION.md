# NexusAI frontend integration

The workspace was inspected before implementation. It contained the FastAPI foundation and no frontend, database migrations, authentication, LangGraph, retrieval, model, report, or deployment services. This frontend implements all navigable surfaces, then connects only the operations the backend supports.

## Integration matrix

| Page | API or service dependency | Actual integration |
| --- | --- | --- |
| Landing `/` | None, optional approved GitHub URL | Product information, navigation, FAQ and interactive workflow blueprint |
| Login `/login` | Authentication and session creation | Unavailable state. No credentials collected. |
| Registration `/register` | Account creation, authorized workspace provisioning | Unavailable state. No credentials collected. |
| Logout `/logout` | Session revocation | No session to revoke. |
| Overview `/dashboard` | `GET /health`, `GET /api/v1/status`; future workspace metrics | Displays live API status, version, and measured liveness probe duration. Workspace counts, retrieval metrics and activity are unavailable. |
| AI Assistant `/chat` | Authorized conversations, RAG, streaming, documents and citation lookup | Three-panel layout. Service unavailable, so no prompts or files are collected. |
| Agent Studio `/agents` | LangGraph tasks, plan and progress events, approve, retry and cancel | Interactive six-agent dependency blueprint and role inspector. No execution data or actions. |
| Knowledge Base `/knowledge` | Authorized document operations, indexing jobs, chunks and embeddings | Documents, indexing and retrieval surfaces show unavailable states. |
| Research Center `/research` | Research tasks, authorization, evidence, optional search provider | Research, evidence and findings surfaces show unavailable states. |
| SQL Studio `/sql` | Schema catalog, verified read-only SQL generation and execution | Schema, query and results surfaces show unavailable states. |
| Analytics Studio `/analytics` | Dataset storage, profiling, forecasting and anomaly inference | Data and model-dependent surfaces show unavailable states. |
| Machine Learning `/machine-learning` | Training, evaluations and model registry | Training and metrics unavailable. |
| Deep Learning `/deep-learning` | PyTorch jobs, logs, checkpoints and hardware telemetry | Training and metrics unavailable. |
| LLM Studio `/llm-studio` | Providers, approved adapters, fine-tuning jobs and inference | Training and inference unavailable. |
| Verification Center `/verification` | Claims, verdicts, citations and original evidence | Verification unavailable. |
| Reports `/reports` | Report generation, search, previews and authorized downloads | Reporting unavailable. |
| Experiments `/experiments` | MLflow or equivalent runs, metrics, artifacts and registry | Experiment tracking unavailable. |
| System Monitor `/monitoring` | `GET /health`, `GET /api/v1/status`, optional `GET /ready` | Live API probes and internal database readiness. Worker, model, queue and hardware telemetry are unavailable. |
| Settings `/settings` | Theme preference in browser. Account and workspace APIs for server-side preferences. | Theme selection works in the browser. Server-managed settings are unavailable. |

The paths for missing backend operations remain to be defined in the corresponding backend stages. The frontend sends no requests to speculative endpoints. Document detail and evidence deep links, private workspace access and session expiration require the corresponding database and authorization services before they can be verified.

## Architecture and security

- The App Router handles the landing, account surfaces, and statically generated workspace modules. The workspace shell provides active routes, desktop collapse, a mobile drawer, breadcrumbs, keyboard search and persistent theme controls. Notifications describe their missing event service.
- `/api/system/[probe]` is a same-origin route handler with three allowed operations. Each maps to a route confirmed in FastAPI source. It validates the response, limits each request's duration, rejects upstream redirects, and returns a sanitized gateway error. It forwards no authentication headers or browser cookies. The upstream origin is set by the operator and remains off the client bundle.
- The database probe is disabled by default. Enable it only on a private authorized deployment. The health and version checks remain public within the frontend surface. The FastAPI project's direct endpoint exposure is unchanged.
- The client validates API shapes with Zod and uses TanStack Query for caching, cancellation, bounded retry and refresh. The latency shown is the latest same-origin server-to-backend liveness check duration. It is not a historical trend or request percentile.
- Next.js separates route code. Shared chrome is client-side for navigation and theme interaction. Geist is bundled locally, and the charts and training dependencies were omitted because no real data supports those views.
- Only the theme preference is persisted in browser storage. Credentials, unpublished reports and unverified agent output are absent from the client. Account and workspace-dependent operations require backend design and authorization before they can accept private inputs.

## Verification

- Follow the [server verification commands](../frontend/README.md#verify-on-the-designated-server) for linting, type checking, API parser tests, Playwright responsive and keyboard tests, and the real health, release and readiness checks.
- Frontend dependency installation and production compilation succeeded. The build's TypeScript check passed. Exact build attempts and exit codes are in the [test report](TEST_REPORT.md#frontend-integration).
- Browser tests use a deliberate error fixture only in the isolated failure-state case. The separate live project calls the actual backend through Next.js and captures browser screenshots.
- The previously requested server-only testing constraint still applies. No test server was identified. Unit, browser, live integration and backend regression runs have no results. The end-to-end account, document, RAG, agent, model and report scenario also requires the missing APIs. No screenshots were captured.

## Proposed pull request

**Title:** Add the NexusAI frontend workspace and FastAPI service monitoring

**Description:** Adds a Next.js workspace, public landing page, light and dark themes, responsive navigation, command palette, module surfaces and interactive six-agent blueprint. Integrates live FastAPI health, release and opt-in database readiness using a typed same-origin gateway. Adds unit and Playwright coverage, setup instructions, and the backend capability matrix. The graph is a design preview, and backend-dependent forms and actions remain unavailable. The gateway allowlists three read-only probes and protects the database probe behind an internal-deployment flag. Server test results and desktop and mobile browser screenshots are pending a designated test server.
