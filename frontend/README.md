# NexusAI frontend

The Next.js workspace runs independently of model runtimes. Its working API integrations cover the backend's health, release details, and optional database readiness. Account and AI modules explain the missing backend services and accept no sensitive input.

## Start the frontend

Use Node.js 22 or later and npm. Start FastAPI as described in the [repository README](../README.md#start-the-current-backend) or use an authorized remote backend. Run `npm ci` once for a fresh checkout or after dependency changes. For routine starts, use `npm run dev` with the installed dependencies.

```bash
cd frontend
npm ci
npm run dev -- --hostname 127.0.0.1
```

Open `http://127.0.0.1:3000`. The frontend connects to FastAPI on `http://127.0.0.1:8000` by default. Set `NEXUSAI_BACKEND_URL` in the frontend server environment or copy `.env.example` to `.env.local` to use a different HTTP(S) origin. This setting remains server-side. Restart Next.js after changing it.

On Windows PowerShell, use `npm.cmd` and enter each command on its own line. If PowerShell displays a `>>` prompt, press **Ctrl+C** to clear the unfinished command. If `npm ci` stops with `EBUSY` while removing a directory in `node_modules`, it may have removed some dependencies before it stopped. Stop your frontend server, close any tools using the dependency folder, and run `npm.cmd install --prefer-offline` from `frontend` to repair the install before starting Next.js again.

Database readiness is restricted by default. Set `NEXUSAI_ENABLE_READINESS_PROXY=true` only on an authorized private test deployment. The flag enables the probe for all users with access to that deployment, so enforce private network or reverse-proxy access before enabling it. It does not add user-level authorization.

Set `NEXT_PUBLIC_NEXUSAI_REPOSITORY_URL` to an approved HTTPS GitHub repository to display the footer link.

## Verify on the designated server

```bash
cd frontend
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run build
npx playwright install chromium
npm run test:e2e -- --project=workspace
```

Run FastAPI and enable the readiness proxy for the real integration check. Example command for a POSIX test server using a locally built frontend:

```bash
NEXUSAI_E2E_LIVE=1 NEXUSAI_BACKEND_URL=http://127.0.0.1:8000 NEXUSAI_ENABLE_READINESS_PROXY=true npm run test:integration
```

On Windows PowerShell set the same variables with `$env:NEXUSAI_E2E_LIVE = '1'`, `$env:NEXUSAI_BACKEND_URL = 'http://127.0.0.1:8000'`, and `$env:NEXUSAI_ENABLE_READINESS_PROXY = 'true'`, then run `npm.cmd run test:integration`. Optionally point `NEXUSAI_TEST_FRONTEND_URL` to an already-running authorized frontend. Configure backend access and readiness on that deployment separately.

Playwright writes browser evidence under `test-results/` and its HTML report under `playwright-report/`. The integration project captures the landing page, dashboard and Agent Studio in two viewport widths. For manual QA, inspect the responsive routes, light theme, focus order, and browser console using the actual server build.

See the [integration matrix and implementation report](../docs/FRONTEND_INTEGRATION.md).
