# Bug fix report

| Original problem | Root cause | Fix and affected files | Verification |
| --- | --- | --- | --- |
| Starting Next.js twice hit `EADDRINUSE` | Separate terminal commands launched a duplicate listener | Added `START_ALL.cmd`, `CHECK_STATUS.cmd` and `scripts/nexusai.mjs` with service checks before launch and explicit conflict messages | Existing stack reuse returned success without starting a duplicate |
| `npm ci` hit `EBUSY` and removed parts of Next.js | npm replaces the dependency tree and Windows locked one of its folders | `setup.ps1` uses incremental install for an existing tree. Routine startup skips setup. Documented the repair in `TROUBLESHOOTING.md`. | Earlier offline install restored Next.js and it started. The new setup script was reviewed and was not used to reinstall the already repaired environment. |
| Changing a backend port could break frontend requests | A manually started Next.js process retained the default backend URL | Launcher passes the selected origin to Next.js. Docker uses the backend service address. | Live status through the default gateway passed. Remote and container execution are pending. |
| A closed client could leave a probe running until the upstream timeout | Gateway fetch used a timeout and ignored the incoming cancellation signal | Updated `frontend/app/api/system/[probe]/route.ts` to combine both signals | Production build and live probe verification recorded in the [end-to-end report](END_TO_END_TEST_REPORT.md). Cancellation fault injection remains pending. |
| Stop instructions depended on individual terminals | No process group owned both services | Added `STOP_ALL.cmd` and launcher-owned shutdown | Ownership and shutdown results are recorded in the [end-to-end report](END_TO_END_TEST_REPORT.md). |

**Proposed PR title** — Unify NexusAI startup and verify frontend–FastAPI connectivity

**Description** — Adds Windows setup, start, status, and stop commands, an optional Docker Compose path, live service validation, and cancellation propagation for the same-origin gateway. Documents missing backend capabilities and leaves independently started processes running. Runtime evidence and pending suites are in the end-to-end report.
