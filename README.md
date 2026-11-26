# NexusAI

NexusAI is a portfolio project for document search, grounded answers, and research workflows. Stage 2 introduces the FastAPI foundation. The architecture and later implementation gates are described in [Architecture](docs/ARCHITECTURE.md) and the [Development log](docs/DEVELOPMENT_LOG.md).

The [Next.js frontend](frontend/README.md) provides a workspace, agent blueprint, settings and live service checks. See the [integration matrix](docs/FRONTEND_INTEGRATION.md) for which modules require further backend work.

The new [workspace setup](docs/WORKSPACE_FEATURES.md) covers PostgreSQL, account registration, document upload, cited answers, analytics, and optional report and model services.

For local PostgreSQL, install Docker Desktop once. The Windows launcher starts it when needed.

## Start NexusAI on Windows

From the project folder, run:

```powershell
.\START_ALL.cmd
```

Open [the dashboard](http://127.0.0.1:3000/dashboard) when the launcher prints its URL. It waits for Docker, starts PostgreSQL, applies migrations, and starts FastAPI and Next.js. If the workspace is already running, it prints the existing dashboard URL. If another process owns the default API port 8000, the launcher tries port 8001. Keep the launcher window open for any services it starts.

Run `.\CHECK_STATUS.cmd` to check the dashboard, FastAPI, the frontend API gateway, and PostgreSQL readiness. If the launcher used port 8001, set `$env:NEXUSAI_BACKEND_PORT = '8001'` in the status terminal first. Run `.\STOP_ALL.cmd` to stop the launcher-owned frontend and API. Docker Desktop and PostgreSQL stay running with your data. For a fresh checkout or broken dependencies, follow [Installation](docs/INSTALLATION.md). See [Troubleshooting](docs/TROUBLESHOOTING.md) for port conflicts and Windows npm errors.

## Move NexusAI to another Windows PC

Clone the repository for the code and Docker configuration, then restore a PostgreSQL backup for your existing workspace data. Follow the [PC migration guide](docs/PC_MIGRATION.md).

## Start the current backend

Run these commands from the directory containing `pyproject.toml` and `uv.lock`, with Python 3.13 and uv available. The lockfile installs the same dependency versions on each supported environment.

```bash
uv sync --locked --python 3.13
uv run --locked uvicorn backend.app.main:create_app --factory --host 127.0.0.1 --port 8000 --no-access-log
```

Keep the server shell open. On the server, the base address `http://127.0.0.1:8000/` opens Swagger. If docs are disabled it opens the API status response. For a remote server, use an SSH tunnel from your own shell and open the same URL on your PC. Replace `your-server` with your authorized SSH target.

```bash
ssh -N -L 8000:127.0.0.1:8000 your-server
```

## Server setup and verification

Run the following on the designated test server with the backend source and lockfile present.

```bash
uv sync --locked --python 3.13
uv run --locked ruff check .
uv run --locked pytest -q -m 'not integration'
```

Start Uvicorn as shown above. In a second server shell, check the running process. In PowerShell, use `curl.exe` in place of `curl` and omit the `--output /dev/null` option.

```bash
curl --fail --silent --show-error --location http://127.0.0.1:8000/
curl --fail --silent --show-error http://127.0.0.1:8000/health
curl --fail --silent --show-error http://127.0.0.1:8000/api/v1/status
curl --fail --silent --show-error http://127.0.0.1:8000/openapi.json
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:8000/docs
curl --include --silent --show-error http://127.0.0.1:8000/ready
```

Readiness returns HTTP 503 when the database URL is absent or its database is unreachable. For real database verification, set `NEXUSAI_TEST_DATABASE_URL` through the server's environment or secret store and run `uv run --locked pytest -q -m integration`. To verify readiness through Uvicorn with the database, set `NEXUSAI_DATABASE_URL` in the Uvicorn process environment and check for HTTP 200 from `/ready`.

The application reads process environment variables and optionally a project-root `.env`. Process variables take precedence. See [.env.example](.env.example) for the configuration keys. The database accepts `postgresql://` and `postgresql+psycopg://` URLs.

## Common startup problems

| Symptom | Check |
| --- | --- |
| Uvicorn reports that it cannot import `backend` | Run the command from the project root and include `--factory`. |
| Port 8000 is already in use | Start Uvicorn with `--port 8001` and use 8001 in the URL and tunnel destination. |
| Swagger opens as a blank page | Check `/health` and `/api/v1/status` directly. Swagger's default browser assets require access to its CDN. |
| `/ready` returns 503, while `/health` returns 200 | The API is up. Check `NEXUSAI_DATABASE_URL` and database connectivity if this environment needs PostgreSQL. |

See the [API documentation](docs/API_DOCUMENTATION.md), [test report](docs/TEST_REPORT.md), and [known issues](docs/KNOWN_ISSUES.md) for endpoint behavior and verification status.
