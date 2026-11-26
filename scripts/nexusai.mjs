import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const frontend = join(root, "frontend");
const instance = createHash("sha256").update(root.toLowerCase()).digest("hex").slice(0, 16);
const pipe = `\\\\.\\pipe\\nexusai-${instance}`;
const children = new Set();
let supervisor;
let stopping = false;
let started = false;

function port(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} must be a port number between 1 and 65535.`);
  }
  return value;
}

function getConfig(args) {
  const frontendPort = port("NEXUSAI_FRONTEND_PORT", 3000);
  const backendPort = port("NEXUSAI_BACKEND_PORT", 8000);
  const remote = args.length === 2 && args[0] === "--remote";
  if (args.length > 0 && !remote) throw new Error("Expected --remote followed by an HTTP origin.");
  if (!remote && frontendPort === backendPort) throw new Error("Frontend and backend ports must differ.");
  let backendUrl;
  try {
    backendUrl = new URL(remote ? args[1] : `http://127.0.0.1:${backendPort}`);
  } catch {
    throw new Error("The remote backend must be an HTTP or HTTPS origin.");
  }
  if (!["http:", "https:"].includes(backendUrl.protocol) || backendUrl.username ||
      backendUrl.password || backendUrl.pathname !== "/" || backendUrl.search || backendUrl.hash) {
    throw new Error("The remote backend must be an HTTP or HTTPS origin without credentials or a path.");
  }
  return { frontendPort, backendPort, backendUrl: backendUrl.origin, remote, frontendUrl: `http://127.0.0.1:${frontendPort}` };
}

async function readJson(url, path) {
  try {
    const response = await fetch(new URL(path, url), {
      redirect: "error", signal: AbortSignal.timeout(5500),
    });
    return { http: response.status, data: await response.json(), requestId: response.headers.get("x-request-id") };
  } catch {
    return null;
  }
}

function isBackend(probe) {
  return probe?.http === 200 && probe.data?.status === "ok" &&
    probe.data?.service === "NexusAI" && probe.data?.api_version === "v1";
}

function isConnected(direct, throughFrontend) {
  return isBackend(direct) && isBackend(throughFrontend) &&
    direct.data.version === throughFrontend.data.version && Boolean(throughFrontend.requestId);
}

async function dashboardAvailable(config) {
  try {
    const response = await fetch(new URL("/dashboard", config.frontendUrl), {
      redirect: "error", signal: AbortSignal.timeout(5500),
    });
    return response.ok && (await response.text()).includes("<title>Overview · NexusAI</title>");
  } catch {
    return false;
  }
}

function isListening(targetPort) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port: targetPort });
    const finish = (listening) => { socket.destroy(); resolve(listening); };
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", (error) => finish(error.code !== "ECONNREFUSED"));
    socket.setTimeout(750);
  });
}

async function status(config) {
  const [backend, frontendProbe, database, dashboard] = await Promise.all([
    readJson(config.backendUrl, "/api/v1/status"),
    readJson(config.frontendUrl, "/api/system/status"),
    config.remote ? null : readJson(config.backendUrl, "/ready"),
    dashboardAvailable(config),
  ]);
  const connected = isConnected(backend, frontendProbe);
  const databaseValue = database?.data?.database;
  const databaseStatus = ["available", "not_configured", "unavailable"].includes(databaseValue)
    ? databaseValue : "unknown";
  console.log(`FastAPI (${config.backendUrl}): ${isBackend(backend) ? "available" : "unavailable"}`);
  console.log(`Frontend API gateway (${config.frontendUrl}): ${connected ? "responding" : "unavailable or using a different API version"}`);
  console.log(`Dashboard HTML: ${dashboard ? "available" : "unavailable"}`);
  console.log(`Database readiness: ${config.remote ? "check configured on remote deployment" : databaseStatus}`);
  return connected && dashboard;
}

function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
    const result = spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    if (result.status !== 0 && child.exitCode === null && child.signalCode === null) {
      child.kill();
    }
  }
  supervisor?.close();
}

function run(name, executable, args, cwd, extraEnv = {}) {
  const child = spawn(executable, args, {
    cwd, env: { ...process.env, ...extraEnv }, stdio: "inherit", windowsHide: true,
  });
  children.add(child);
  child.on("error", (error) => {
    if (stopping) return;
    console.error(`${name} could not start (${error.code ?? "unknown error"}).`);
    shutdown(1);
  });
  child.on("exit", (code) => {
    children.delete(child);
    if (stopping) return;
    console.error(`${name} stopped unexpectedly (exit ${code ?? "unknown"}).`);
    shutdown(1);
  });
}

async function waitFor(label, check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!stopping && Date.now() < deadline) {
    if (await check()) return;
    await delay(450);
  }
  throw new Error(`${label} did not become ready. Review the service output above.`);
}

function listenForStop() {
  return new Promise((resolve, reject) => {
    supervisor = createServer((socket) => {
      let message = "";
      socket.setTimeout(2000, () => socket.destroy());
      socket.on("error", () => socket.destroy());
      socket.setEncoding("utf8");
      socket.on("data", (payload) => {
        message += payload;
        if (!"stop\n".startsWith(message)) return socket.destroy();
        if (message === "stop\n") socket.end("stopping\n", () => shutdown());
      });
    });
    supervisor.once("error", reject);
    supervisor.listen({ path: pipe, readableAll: false, writableAll: false }, resolve);
  });
}

function requestStop() {
  return new Promise((resolve, reject) => {
    const socket = createConnection(pipe, () => socket.write("stop\n"));
    socket.setTimeout(2500, () => socket.destroy(new Error("The launcher did not respond.")));
    socket.once("error", (error) => {
      if (error.code === "ENOENT" || error.code === "ECONNREFUSED") resolve(false);
      else reject(error);
    });
    socket.once("data", (payload) => { socket.end(); resolve(payload.toString() === "stopping\n"); });
    socket.once("close", () => resolve(false));
  });
}

async function start(config) {
  const python = join(root, ".venv", "Scripts", "python.exe");
  const next = join(frontend, "node_modules", "next", "dist", "bin", "next");
  let direct = await readJson(config.backendUrl, "/api/v1/status");
  const existingFrontend = await isListening(config.frontendPort);
  if (existingFrontend) {
    if (config.remote) {
      throw new Error("The frontend port is already in use. Choose another NEXUSAI_FRONTEND_PORT for the remote backend.");
    }
    const gateway = await readJson(config.frontendUrl, "/api/system/status");
    if (!isConnected(direct, gateway) || !(await dashboardAvailable(config))) {
      throw new Error(`Port ${config.frontendPort} is occupied by an unverified frontend. Set NEXUSAI_FRONTEND_PORT to an unused port.`);
    }
    console.log("Using the running NexusAI services. This launcher did not start or take ownership of them.");
    await status(config);
    console.log(`Open ${config.frontendUrl}/dashboard`);
    return;
  }

  if (!existsSync(next) || !existsSync(join(frontend, ".next", "BUILD_ID"))) {
    throw new Error("Frontend dependencies or the production build are missing. Run powershell -NoProfile -ExecutionPolicy Bypass -File .\\setup.ps1.");
  }
  if (!isBackend(direct)) {
    if (config.remote) throw new Error("The selected remote backend did not return the NexusAI status contract.");
    if (await isListening(config.backendPort)) {
      throw new Error(`Port ${config.backendPort} is occupied by an unverified backend. Set NEXUSAI_BACKEND_PORT to an unused port.`);
    }
    if (!existsSync(python)) throw new Error("The Python environment is missing. Run powershell -NoProfile -ExecutionPolicy Bypass -File .\\setup.ps1.");
  }

  try {
    await listenForStop();
  } catch (error) {
    if (error.code !== "EADDRINUSE") throw error;
    console.log("A launcher for this checkout is already active. Run CHECK_STATUS.cmd to see its services.");
    return;
  }
  started = true;
  process.on("SIGINT", () => shutdown());
  process.on("SIGTERM", () => shutdown());
  if (!isBackend(direct)) {
    run("FastAPI", python, ["-m", "uvicorn", "backend.app.main:create_app", "--factory", "--host", "127.0.0.1", "--port", String(config.backendPort), "--no-access-log"], root);
    await waitFor("FastAPI", async () => {
      direct = await readJson(config.backendUrl, "/api/v1/status");
      return isBackend(direct);
    }, 20_000);
  } else {
    console.log(`Using the available FastAPI backend at ${config.backendUrl}.`);
  }

  run("Next.js", process.execPath, [next, "start", "--hostname", "127.0.0.1", "--port", String(config.frontendPort)], frontend, {
    NEXUSAI_BACKEND_URL: config.backendUrl,
  });
  await waitFor("Frontend and its API gateway", async () => {
    const [gateway, dashboard] = await Promise.all([
      readJson(config.frontendUrl, "/api/system/status"),
      dashboardAvailable(config),
    ]);
    return isConnected(direct, gateway) && dashboard;
  }, 30_000);
  console.log(`Open ${config.frontendUrl}/dashboard`);
  console.log("Keep this window open. To stop launcher-owned services, press Ctrl+C here or run STOP_ALL.cmd.");
  await status(config);
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (process.platform !== "win32") throw new Error("This launcher is for Windows. See the README for other platforms.");
  if (command === "stop") {
    if (args.length) throw new Error("STOP_ALL.cmd takes no arguments.");
    console.log(await requestStop() ? "Shutdown requested for launcher-owned services." : "No launcher manages this checkout. Manually started services were left running.");
  } else if (command === "start") {
    await start(getConfig(args));
  } else if (command === "status") {
    if (!(await status(getConfig(args)))) process.exitCode = 1;
  } else {
    throw new Error("Use START_ALL.cmd, CHECK_STATUS.cmd, or STOP_ALL.cmd.");
  }
} catch (error) {
  if (!stopping) console.error(error.message);
  if (started) shutdown(1);
  else process.exitCode = 1;
}
