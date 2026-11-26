# NexusAI workspace features

## Enable accounts and document search

NexusAI uses PostgreSQL with pgvector for private workspaces. Use an authorized PostgreSQL 17 instance with pgvector available. Set `NEXUSAI_DATABASE_URL` in a private project-root `.env` or in the backend environment. Start with the [environment example](../.env.example). Keep database credentials outside source control. The migration role needs permission to install the extension if the operator has not already created it.

If Docker Desktop or another Docker engine is available, the Compose file also includes a loopback-only database profile. Set `NEXUSAI_POSTGRES_PASSWORD` privately, then run `docker compose --profile database up -d database`. The database runs on `127.0.0.1:5432` by default. Point a native backend at that origin. For a container backend use `database:5432` on the Compose network. Percent-encode special characters in the password within the database URL. Mark development or private loopback deployments as `development`. Use `production` and HTTPS for any remote user-facing deployment so the session cookie is Secure.

For the automated Windows development path, use `.\START_ALL.cmd` or its workspace alias `.\START_WORKSPACE.cmd`. Install Docker Desktop and prepare the frontend build once. The wrapper starts Docker Desktop if needed, starts a database scoped to this checkout, retains its named volume, reuses its container credentials in process memory, and applies migrations before starting the app. If the default backend port 8000 is occupied, the launcher tries 8001. You can also select it with `-BackendPort 8001`. `.\STOP_ALL.cmd` stops the frontend and API it owns. Docker Desktop and PostgreSQL stay running with your data.

From the project root:

```powershell
uv sync --locked --group agents
uv run --locked alembic upgrade head
```

Build the frontend when dependencies and source are ready, then start the services:

```powershell
cd frontend
npm.cmd ci
npm.cmd run build
cd ..
.\START_ALL.cmd
```

Use `npm.cmd ci` once on a clean checkout. If already installed, skip it. The launcher can reuse running services. Restart any existing backend process with the new configuration so the new routes are loaded.

For an existing backend that already owns port 8000, start a separate upgraded instance without stopping it:

```powershell
$env:NEXUSAI_BACKEND_PORT = '8001'
.\START_ALL.cmd
```

Keep the same backend port in the shell when running `.\CHECK_STATUS.cmd`. The general setup script accepts `-WithAgents` to retain the optional workflow dependencies.

## Available workflows

- **Accounts and workspace isolation.** Registration creates a private default workspace. The API checks ownership before serving workspace data. Identity uses opaque, revocable 12-hour sessions with HTTP-only cookies and salted scrypt password hashes. The gateway checks write origins, allows only known routes and forwards only the session cookie. Set `NEXUSAI_PUBLIC_ORIGIN` for reverse-proxy deployments.
- **Profile and workspace switching.** Open My profile to edit your display name, copy your Account ID, change your password, or revoke another session. A password change refreshes this browser's session and revokes the others. The selected workspace is remembered per account on this browser and must still appear in your authorized workspace list.
- **Document indexing.** Knowledge Base searches filenames and filters by indexing status. Choose Preview original to open a file, Re-index to refresh its searchable passages, or Delete and confirm to remove the file and its index. Saved answers or reports may still contain quotations. PDF, UTF-8 TXT, Markdown and CSV files are limited to 5 MiB. Chat citations open original PDFs at the cited page in browsers with a PDF viewer. Encrypted and scanned PDFs fail indexing with an explanation. Unchanged passages retain their source IDs after a re-index.
- **Cited chat.** Keyword retrieval works without a model server. Optional Ollama embeddings add cosine-based semantic retrieval and reciprocal-rank fusion. An optional TEI-compatible cross-encoder can rerank the candidates. Answers are extracted from matching passages, with source IDs and a linkable page number. An optional LLM may choose a verbatim quote. Non-verbatim output is rejected. The browser streams the resulting text after retrieval and saves the exchange. Long-running model requests have timeouts. Cancel stops the browser stream, and work already committed can remain in history.
- **Analysis and SQL.** Upload CSV files through Knowledge Base. Analytics profiles a numeric column, flags anomalies with a median-absolute-deviation rule, and compares a linear trend to a last-observed baseline on a chronological holdout. Results appear only when the actual data meets the method's input requirements. SQL Studio exposes three workspace-scoped parameterized templates in a read-only transaction.
- **Research and reporting.** With the optional `agents` group installed, Agent Studio and Research Center run a three-step LangGraph workflow after explicit approval. PostgreSQL keeps each completed step. Open Saved runs and choose Resume run after a failure or interruption. If the process stops abruptly, the run becomes resumable when its two-minute lease expires. Use Reports to download Markdown or JSON.

## Password reset email

Set `NEXUSAI_RESET_PUBLIC_ORIGIN` to the frontend origin, then set `NEXUSAI_SMTP_HOST` and `NEXUSAI_SMTP_SENDER`. The transport uses implicit TLS on port 465 by default. Configure `NEXUSAI_SMTP_USERNAME` and `NEXUSAI_SMTP_PASSWORD` if the relay requires credentials. Production reset links require an HTTPS origin. The emailed link expires after 30 minutes. A successful reset revokes every session for the account.

## Optional AI services and evaluation

Set `NEXUSAI_OLLAMA_URL` to a trusted Ollama origin and `NEXUSAI_EMBEDDING_MODEL` to an installed 384-dimensional model. The default identifier is `all-minilm`. Set `NEXUSAI_ANSWER_MODEL` to enable optional quote selection and `NEXUSAI_RERANK_URL` to enable a trusted TEI reranker. Configured providers receive relevant text. After configuring or changing the embedding model, use Re-index on existing documents to populate vectors for that model.

Once source IDs have been reviewed, run:

```powershell
uv run --locked python -m scripts.evaluate_retrieval WORKSPACE_UUID path\to\reviewed-labels.json
```

Provide a JSON array with `question` and `expected_source_ids` per case. Use an empty expected array for insufficient-evidence cases. The evaluator prints per-strategy precision and recall at 4, reciprocal rank, abstention rates and mean latency. Measured results are pending a benchmark database, approved fixtures and optional model services.

## Server verification

Run the browser regressions on the test server. Set `NEXUSAI_TEST_FRONTEND_URL` to its NexusAI frontend URL and `NEXUSAI_E2E_LIVE=1` to enable checks against its FastAPI backend. From `frontend`, run `npm.cmd run test:e2e` on Windows or `npm run test:e2e` on Linux. Run backend integration tests with an isolated migrated database via `NEXUSAI_TEST_DATABASE_URL`. See [verification results](TEST_REPORT.md#workspace-implementation).
