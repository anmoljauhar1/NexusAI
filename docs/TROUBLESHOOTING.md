# Troubleshooting

| Symptom | Cause and recovery |
| --- | --- |
| Docker Desktop is manually paused | Click **Resume** in the Docker Desktop dashboard or tray menu, then run `START_ALL.cmd` again. The launcher automatically handles a closed Docker Desktop. |
| The terminal cannot access the Docker engine | Start the launcher in your normal Windows terminal with Docker access. |
| `EADDRINUSE` on 3000 | Run `CHECK_STATUS.cmd`. If the dashboard and gateway are available, open the dashboard in a browser. If another app owns the port, set `$env:NEXUSAI_FRONTEND_PORT = '3001'` and start the launcher from the same shell. |
| `EADDRINUSE` on 8000 | If another app uses the port, set `$env:NEXUSAI_BACKEND_PORT = '8001'` before launching. The launcher passes the matching backend URL to Next.js. |
| `npm ci` fails with `EBUSY` and Next.js disappears | npm stopped during dependency removal. Stop the frontend, close programs using that folder, and run `npm.cmd install --prefer-offline` from `frontend`. Run setup again if the build is missing. Routine startup does not need npm installation. |
| PowerShell shows `>>` or reports a pasted command is unrecognized | Press Ctrl+C, then enter one command per line without copying the prompt. |
| `/ready` returns 503 | See the database value. `not_configured` means the optional database URL is absent. `unavailable` means a configured database could not be reached. A liveness response alone does not verify the database. |
| The frontend cannot reach a remote backend | Check `NEXUSAI_BACKEND_URL` on the Next.js host and use the backend's HTTP(S) origin. The gateway requires the existing health and versioned status contracts. |
| Login, chat, agent execution or upload are unavailable | Their backend services are absent. See the [integration report](API_INTEGRATION_REPORT.md). |
