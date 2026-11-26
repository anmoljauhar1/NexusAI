# Installation

## Windows

Install Node.js 22 or later, npm, Python 3.13, uv, and Docker Desktop. From the repository root, run setup once for a fresh checkout. Stop the frontend before repairing dependencies or rebuilding it.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
.\START_ALL.cmd
```

Open [NexusAI](http://127.0.0.1:3000/dashboard). Run `.\CHECK_STATUS.cmd` for live service status or `.\STOP_ALL.cmd` to stop only the launcher-owned processes. On subsequent starts, run the launcher by itself.

The launcher starts Docker Desktop if needed and waits for its engine. It then starts the workspace's PostgreSQL container, applies migrations, starts FastAPI and serves the existing production frontend build. It leaves PostgreSQL and Docker running when you stop the app. Use `.\START_ALL.cmd --app-only` if you want to start the two application services with your own database configuration and without managing Docker. For frontend source development, use the [frontend development commands](../frontend/README.md#start-the-frontend).

## Remote FastAPI

Prepare the frontend dependencies and production build using the [frontend README](../frontend/README.md). Then run:

```powershell
.\START_ALL.cmd --remote https://your-authorized-backend.example
```

Supply the origin of a FastAPI deployment that exposes the NexusAI versioned status route. The launcher starts Next.js only and passes the origin to its server process. Use `.\CHECK_STATUS.cmd --remote https://your-authorized-backend.example` with the same origin.

## Docker

From the repository root, run `docker compose up --build`. It starts the currently implemented frontend and backend on a private Docker network and publishes the frontend to loopback. Run `docker compose down` to stop the containers. On a trusted Docker host, set `NEXUSAI_FRONTEND_PORT` if port 3000 is occupied and provide `NEXUSAI_DATABASE_URL` only for an authorized database reachable from the backend container.

The default Compose services are the frontend and API. The optional `database` profile provides PostgreSQL with pgvector. See [workspace setup](WORKSPACE_FEATURES.md) for local database configuration and migrations.
