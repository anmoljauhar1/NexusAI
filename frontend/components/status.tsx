"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Database, RefreshCw, Server, Timer } from "lucide-react";
import { ApiError, fetchProbe, type Probe } from "@/lib/api";

function useProbe<K extends Probe>(probe: K, enabled = true) {
  return useQuery({
    queryKey: ["probe", probe],
    queryFn: ({ signal }) => fetchProbe(probe, signal),
    refetchInterval: 30_000,
    enabled,
  });
}

export function ConnectionBadge() {
  const health = useProbe("health");
  const label = health.isError ? "API unreachable" : health.isPending ? "Checking API" : "API connected";
  const tone = health.isError ? "bad" : health.isPending ? "neutral" : "good";
  return <span className={`status-tag ${tone}`} title="FastAPI liveness" role="status"><span className="status-dot" />{label}</span>;
}

function ReadinessCard({ readiness }: { readiness: ReturnType<typeof useProbe<"readiness">> }) {
  const database = readiness.isError ? undefined : readiness.data?.data.database;
  const restricted = readiness.error instanceof ApiError && readiness.error.status === 403;
  const value = database === "available" ? "Available"
    : database === "not_configured" ? "Not configured"
    : database === "unavailable" ? "Unavailable"
    : restricted ? "Restricted"
    : readiness.isError ? "Check failed" : "Checking…";
  return <article className="metric-card">
    <Database size={19} />
    <h3>Database readiness</h3>
    <strong>{value}</strong>
    <p>{restricted ? "Only enabled on authorized internal deployments." : "Result from the PostgreSQL connection probe."}</p>
  </article>;
}

export function SystemStatus({ monitor = false }: { monitor?: boolean }) {
  const health = useProbe("health");
  const status = useProbe("status");
  const readiness = useProbe("readiness", monitor);
  const lastCheck = health.dataUpdatedAt > 0 ? new Date(health.dataUpdatedAt) : null;
  const refreshing = health.isFetching || status.isFetching || (monitor && readiness.isFetching);
  function refresh() {
    void health.refetch();
    void status.refetch();
    if (monitor) void readiness.refetch();
  }
  return <section className="panel status-panel" aria-labelledby="status-title">
    <header className="panel-header">
      <div><h2 id="status-title">Live service checks</h2><p>Refreshes every 30 seconds while this view is open.</p></div>
      <button className="button" type="button" disabled={refreshing} onClick={refresh}><RefreshCw size={16} className={refreshing ? "spinning" : undefined} /> {refreshing ? "Checking…" : "Refresh checks"}</button>
    </header>
    {health.isError && <p className="notice" role="status">The frontend could not reach the backend. Check the server address and try again.</p>}
    {!health.isError && status.isError && <p className="notice" role="status">API liveness passed. Version details are unavailable.</p>}
    <div className="metric-grid" aria-busy={health.isPending || status.isPending}>
      <article className="metric-card"><Activity size={19} /><h3>API connection</h3><strong>{health.isError ? "Unreachable" : health.isPending ? "Checking…" : "Connected"}</strong><p>FastAPI liveness at /health</p></article>
      <article className="metric-card"><Server size={19} /><h3>Service release</h3><strong>{status.isError ? "Unavailable" : status.data ? status.data.data.version : "Checking…"}</strong><p>{status.data && !status.isError ? `${status.data.data.service} API ${status.data.data.api_version}` : "Version reported by the backend"}</p></article>
      <article className="metric-card"><Timer size={19} /><h3>Probe latency</h3><strong>{!health.isError && health.data?.durationMs != null ? `${health.data.durationMs} ms` : "—"}</strong><p>Latest successful frontend proxy check</p></article>
      {monitor && <ReadinessCard readiness={readiness} />}
    </div>
    {lastCheck && <p className="metadata">Last successful liveness check <time dateTime={lastCheck.toISOString()}>{lastCheck.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>{monitor && health.data?.requestId && <> · Request <code>{health.data.requestId}</code></>}</p>}
  </section>;
}
