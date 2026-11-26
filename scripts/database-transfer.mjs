import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const projectHash = createHash("sha256").update(root.toLowerCase()).digest("hex").slice(0, 12);
const compose = ["compose", "-p", `nexusai-dev-${projectHash}`, "--profile", "database"];
const connection = ["--username=nexusai", "--dbname=nexusai", "--no-password"];

function database(args, stdio) {
  const result = spawnSync("docker", [...compose, "exec", "-T", "database", ...args], { cwd: root, stdio });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("PostgreSQL command failed. Check Docker Desktop and run START_ALL.cmd first.");
  return result.stdout?.toString().trim();
}

function inspectArchive(path) {
  const descriptor = openSync(path, "r");
  try {
    const signature = Buffer.alloc(5);
    if (readSync(descriptor, signature, 0, signature.length, 0) !== signature.length || signature.toString() !== "PGDMP") {
      throw new Error("Choose a PostgreSQL custom-format backup created by BACKUP_DATA.cmd.");
    }
    const contents = database(["pg_restore", "--list"], [descriptor, "pipe", "inherit"]);
    if (!contents.includes("TABLE DATA public nexus_users ") || !contents.includes("TABLE DATA public alembic_version ")) {
      throw new Error("The selected archive is missing the NexusAI database tables.");
    }
  } finally {
    closeSync(descriptor);
  }
}

function backup(path) {
  mkdirSync(dirname(path), { recursive: true });
  const descriptor = openSync(path, "wx", 0o600);
  try {
    try {
      database(["pg_dump", ...connection, "--format=custom", "--no-owner", "--no-acl",
        "--exclude-table-data=public.nexus_sessions", "--exclude-table-data=public.nexus_resets"],
      ["ignore", descriptor, "inherit"]);
    } finally {
      closeSync(descriptor);
    }
    inspectArchive(path);
  } catch (error) {
    unlinkSync(path);
    throw error;
  }
  console.log(`Backup created at ${path}`);
}

function restore(path) {
  inspectArchive(path);
  const active = database(["psql", ...connection, "-XAt", "-v", "ON_ERROR_STOP=1", "-c",
    "SELECT EXISTS (SELECT FROM public.nexus_users) OR EXISTS (SELECT FROM public.nexus_workspaces)"],
  ["ignore", "pipe", "inherit"]);
  if (active !== "f") throw new Error("This checkout already has users or workspaces. Restore into a fresh checkout.");
  const peers = database(["psql", ...connection, "-XAt", "-v", "ON_ERROR_STOP=1", "-c",
    "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()"],
  ["ignore", "pipe", "inherit"]);
  if (peers !== "0") throw new Error("Run STOP_ALL.cmd and close other connections before restoring this checkout.");
  const descriptor = openSync(path, "r");
  try {
    database(["pg_restore", ...connection, "--clean", "--if-exists", "--single-transaction", "--no-owner", "--no-acl"],
      [descriptor, "inherit", "inherit"]);
  } finally {
    closeSync(descriptor);
  }
  console.log("Database restored. Run START_ALL.cmd and sign in with your existing account.");
}

try {
  const [action, path, ...extra] = process.argv.slice(2);
  if (extra.length || !["backup", "restore"].includes(action) || (action === "restore" && !path)) {
    throw new Error("Use BACKUP_DATA.cmd [backup-path] or RESTORE_DATA.cmd backup-path.");
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultPath = join(process.env.LOCALAPPDATA || homedir(), "NexusAI", "backups", `nexusai-${timestamp}.dump`);
  if (action === "backup") backup(path ? resolve(path) : defaultPath);
  else restore(resolve(path));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
