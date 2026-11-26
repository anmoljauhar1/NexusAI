# Move NexusAI to another Windows PC

The GitHub repository contains the application, dependency lockfiles, database migrations, and Docker Compose configuration. Docker Desktop creates a new PostgreSQL volume on the destination PC. A separate PostgreSQL backup transfers your accounts, workspaces, uploaded files, indexes, chat history, agent runs, and reports into that volume. Sign in again after restore because active sessions and password-reset tokens are excluded. Your NexusAI account password stays the same.

## Old PC

With the workspace database running, open PowerShell in the project folder and run:

```powershell
.\BACKUP_DATA.cmd
```

The command prints the path to a timestamped `.dump` under `%LOCALAPPDATA%\NexusAI\backups`. Copy that file to the new PC using a private transfer. It contains uploaded documents and account password hashes. Keep it out of GitHub and store it on an encrypted drive. If you use a private `.env` for SMTP, model services, or other configuration, configure those values privately on the new PC as well.

## New PC

Install Git, Docker Desktop, Node.js, and `uv`. Clone the project:

```powershell
git clone https://github.com/anmoljauhar1/NexusAI.git
cd NexusAI
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -WithAgents
.\START_ALL.cmd
```

Wait until the dashboard is ready. Use a second PowerShell window in the same project folder to stop the app and restore the copied backup. Run the restore before creating any accounts in the new checkout.

```powershell
.\STOP_ALL.cmd
.\RESTORE_DATA.cmd "D:\Transfer\nexusai-backup.dump"
.\START_ALL.cmd
```

Replace the example path with the copied file's actual path. The restore refuses a database with existing accounts or workspaces or active connections. The stop command leaves the PostgreSQL container available for the restore. Open `http://127.0.0.1:3000` and sign in with your existing NexusAI account.
