"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { useWorkspaceSelection } from "@/lib/workspace-selection";
import { documentRow, exchange, get, post, report, sourceRow, stream, workspace, workspaceRequest } from "@/lib/workspace";

type Feature = "dashboard" | "knowledge" | "chat" | "analytics" | "agents" | "research" | "reports" | "verification" | "sql";
type Exchange = z.infer<typeof exchange>;
type Source = z.infer<typeof sourceRow>;
type Report = z.infer<typeof report>;

function FormNotice({ error }: { error: Error | null }) {
  return error && <p role="alert" className="notice">{error.message}</p>;
}

export function WorkspaceFeature({ feature }: { feature: Feature }) {
  const { session, user, memberships, active, choose } = useWorkspaceSelection();
  const create = useMutation({
    mutationFn: (name: string) => post("workspaces", { name }, workspace),
    onSuccess: async (created) => { await memberships.refetch(); choose(created.id); },
  });
  if (session.isError) return <section className="panel feature-panel"><FormNotice error={session.error} />
    <button className="button" onClick={() => void session.refetch()}>Retry connection</button>
  </section>;
  if (session.isPending || (user && memberships.isPending)) return <section className="panel feature-panel" role="status">Checking your session…</section>;
  if (!user || (memberships.error instanceof ApiError && memberships.error.status === 401)) {
    return <section className="panel feature-panel"><p>Sign in to access your private workspaces.</p><div className="button-row">
      <Link className="button primary" href="/login">Sign in</Link><Link className="button" href="/register">Create account</Link>
    </div></section>;
  }
  if (memberships.isError) return <section className="panel feature-panel"><FormNotice error={memberships.error} />
    <button className="button" onClick={() => void memberships.refetch()}>Retry connection</button>
  </section>;
  return <section className="panel feature-panel">
    <div className="feature-toolbar">
      <label>Private workspace<select value={active?.id ?? ""} onChange={(event) => choose(event.target.value)}>
        {memberships.data?.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      {feature === "dashboard" && <form className="feature-toolbar" onSubmit={(event) => {
        event.preventDefault();
        create.mutate(String(new FormData(event.currentTarget).get("name")).trim());
      }}>
        <label>Workspace name<input name="name" required maxLength={100} placeholder="New workspace" /></label>
        <button className="button" disabled={create.isPending}>Create workspace</button>
      </form>}
      <Link className="button" href="/logout">Sign out</Link>
    </div>
    <FormNotice error={create.error} />
    {active ? <WorkspaceAction key={`${feature}:${active.id}`} feature={feature} base={`workspaces/${active.id}`} />
      : <p>Create your first workspace on the <Link href="/dashboard">dashboard</Link>.</p>}
  </section>;
}

function WorkspaceAction({ feature, base }: { feature: Feature; base: string }) {
  if (feature === "dashboard") return <WorkspaceCounts base={base} />;
  if (feature === "knowledge") return <Documents base={base} />;
  if (feature === "chat") return <Chat base={base} />;
  if (feature === "analytics") return <Analytics base={base} />;
  if (feature === "sql") return <SqlStudio base={base} />;
  return <ReportStudio base={base} mode={feature} />;
}

function WorkspaceCounts({ base }: { base: string }) {
  const counts = useQuery({
    queryKey: [base, "overview"],
    queryFn: ({ signal }) => get(`${base}/overview`, z.object({
      documents: z.number(), chunks: z.number(), questions: z.number(), reports: z.number(),
    }), signal),
  });
  return <><h2>Workspace activity</h2><FormNotice error={counts.error} />
    {counts.isPending && <p role="status">Loading workspace activity…</p>}
    {counts.data && <div className="metric-grid">{Object.entries(counts.data).map(([name, value]) =>
      <article key={name} className="metric-card"><h3>{name}</h3><strong>{value}</strong></article>)}</div>}
  </>;
}

const documentsSchema = z.array(documentRow);

function useDocuments(base: string, poll = false) {
  return useQuery({
    queryKey: [base, "documents"],
    queryFn: ({ signal }) => get(`${base}/documents`, documentsSchema, signal),
    refetchInterval: poll ? 3000 : false,
  });
}

function Documents({ base }: { base: string }) {
  const [filter, setFilter] = useState({ q: "", state: "", page: 1 });
  const [deleteTarget, setDeleteTarget] = useState<z.infer<typeof documentRow> | null>(null);
  const docs = useQuery({
    queryKey: [base, "document-catalog", filter],
    queryFn: ({ signal }) => get(`${base}/documents/catalog?${new URLSearchParams({
      q: filter.q, state: filter.state, page: String(filter.page),
    })}`, z.object({ items: documentsSchema, has_more: z.boolean() }), signal),
    refetchInterval: 3000,
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error("Choose a file up to 5 MiB.");
      const result = await workspaceRequest(`${base}/documents?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
      return z.object({ duplicate: z.boolean() }).parse(await result.json());
    },
    onSuccess: () => {
      if (fileInput.current) fileInput.current.value = "";
      void docs.refetch();
    },
  });
  const action = useMutation({
    mutationFn: ({ id, operation }: { id: string; operation: "retry" | "reindex" | "delete" }) =>
      workspaceRequest(`${base}/documents/${id}${operation === "delete" ? "" : "/" + operation}`,
        { method: operation === "delete" ? "DELETE" : "POST" }),
    onSuccess: (_, { operation }) => {
      if (operation === "delete") setDeleteTarget(null);
      void docs.refetch();
    },
  });
  return <><h2>Documents</h2>
    <form className="nexus-form" onSubmit={(event) => {
      event.preventDefault();
      const file = fileInput.current?.files?.[0];
      if (file) upload.mutate(file);
    }}>
      <label>Choose a PDF, TXT, Markdown or CSV file<input ref={fileInput} type="file" accept=".pdf,.txt,.md,.csv" required /></label>
      <button className="button primary" disabled={upload.isPending}>{upload.isPending ? "Uploading…" : "Upload document"}</button>
    </form>
    {upload.data && <p role="status">{upload.data.duplicate ? "This file is already in the workspace." : "File queued for indexing."}</p>}
    <form className="feature-toolbar" onSubmit={(event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      setFilter({ q: String(values.get("q")), state: String(values.get("state")), page: 1 });
    }}>
      <label>Search filename<input name="q" maxLength={150} placeholder="Search documents" /></label>
      <label>Status<select name="state"><option value="">All statuses</option>
        {["queued", "processing", "ready", "failed"].map((state) => <option key={state}>{state}</option>)}
      </select></label>
      <button className="button">Search</button>
    </form>
    <FormNotice error={upload.error ?? action.error ?? docs.error} />
    {docs.isPending && <p role="status">Loading documents…</p>}
    {docs.data?.items.length === 0 && <p>No documents match this page and filter.</p>}
    <ul className="feature-list">{docs.data?.items.map((item) => <li key={item.id}>
      <strong>{item.name}</strong><span>{item.state}</span>{item.error && <p>{item.error}</p>}
      <div className="button-row">
        <a className="button" href={`/api/workspace/${base}/documents/${item.id}/file`} target="_blank" rel="noreferrer">Preview original</a>
        {item.state === "failed" && <button className="button" disabled={action.isPending} onClick={() => action.mutate({ id: item.id, operation: "retry" })}>Retry</button>}
        {item.state === "ready" && <button className="button" disabled={action.isPending} onClick={() => action.mutate({ id: item.id, operation: "reindex" })}>Re-index</button>}
        <button className="button" disabled={action.isPending} onClick={() => setDeleteTarget(item)}>Delete</button>
      </div>
      {deleteTarget?.id === item.id && <section className="feature-result" aria-label="Confirm document deletion">
        <p>Delete <strong>{item.name}</strong> and its search index? Quotes in saved answers or reports may remain.</p>
        <div className="button-row">
          <button className="button" disabled={action.isPending} onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="button primary" disabled={action.isPending} onClick={() => action.mutate({ id: item.id, operation: "delete" })}>Confirm delete</button>
        </div>
      </section>}
    </li>)}</ul>
    <div className="button-row">
      <button className="button" disabled={filter.page === 1} onClick={() => setFilter({ ...filter, page: filter.page - 1 })}>Previous</button>
      <span>Page {filter.page}</span>
      <button className="button" disabled={!docs.data?.has_more} onClick={() => setFilter({ ...filter, page: filter.page + 1 })}>Next</button>
    </div>
  </>;
}

function Citations({ sources, base }: { sources: Source[]; base: string }) {
  const [selected, select] = useState("");
  const source = useQuery({
    queryKey: [base, "source", selected], enabled: Boolean(selected),
    queryFn: ({ signal }) => get(`${base}/sources/${selected}`, sourceRow, signal),
  });
  if (!sources.length) return null;
  return <div className="citation-box"><h3>Sources</h3>
    <div className="button-row">{sources.map((item) => <button key={item.id} className="button" onClick={() => select(item.id)}>
      {item.name} · page {item.page}
    </button>)}</div>
    {selected && source.isPending && <p role="status">Loading source passage…</p>}
    <FormNotice error={source.error} />
    {source.data && <><blockquote>{source.data.passage}</blockquote>
      <a className="button" href={`/api/workspace/${base}/documents/${source.data.document_id}/file${source.data.name.toLowerCase().endsWith(".pdf") ? "#page=" + source.data.page : ""}`}
        target="_blank" rel="noreferrer">
        {source.data.name.toLowerCase().endsWith(".pdf") ? `Open PDF at page ${source.data.page}` : "Open original"}
      </a>
    </>}
  </div>;
}

function Chat({ base }: { base: string }) {
  const history = useQuery({
    queryKey: [base, "chat"], queryFn: ({ signal }) => get(`${base}/chat`, z.array(exchange), signal),
  });
  const controller = useRef<AbortController | null>(null);
  const [draft, setDraft] = useState("");
  const [answer, setAnswer] = useState<Exchange | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const ask = useMutation({
    mutationFn: async (question: string) => {
      const active = new AbortController();
      controller.current = active;
      setDraft("");
      try {
        return await stream(`${base}/chat`, { question }, exchange, active.signal,
          (value) => setDraft((current) => current + value));
      } finally {
        controller.current = null;
      }
    },
    onSuccess: (result) => { setAnswer(result); setDraft(""); void history.refetch(); },
  });
  return <><h2>Ask your documents</h2>
    <form className="nexus-form" onSubmit={(event) => {
      event.preventDefault();
      setAnswer(null);
      ask.mutate(String(new FormData(event.currentTarget).get("question")).trim());
    }}>
      <label>Question<textarea name="question" minLength={3} maxLength={1000} required rows={3} /></label>
      <div className="button-row"><button className="button primary" disabled={ask.isPending}>Ask workspace</button>
        {ask.isPending && <button type="button" className="button" onClick={() => controller.current?.abort()}>Cancel</button>}
      </div>
    </form>
    {ask.isPending && <p role="status">{draft || "Searching indexed documents…"}</p>}
    {ask.error?.name !== "AbortError" && <FormNotice error={ask.error} />}
    {answer && <article className="feature-result"><h3>{answer.question}</h3><p>{answer.result.answer}</p>
      <p className="metadata">{answer.result.retrieval} retrieval · {answer.result.answer_mode.replaceAll("_", " ")}</p>
      <Citations base={base} sources={answer.result.sources} />
    </article>}
    <h3>Recent questions</h3><FormNotice error={history.error} />
    <ul className="feature-list">{history.data?.map((entry) => <li key={entry.id}>
      <button className="button" onClick={() => setAnswer(entry)}>{entry.question}</button>
    </li>)}</ul>
  </>;
}

const analysis = z.object({
  column: z.string(), count: z.number(), skipped: z.number(), min: z.number(), max: z.number(),
  mean: z.number(), median: z.number(), anomalies: z.array(z.object({ row: z.number(), value: z.number() })),
  anomaly_count: z.number(), mad: z.number(), forecast: z.object({
    method: z.enum(["last_observed", "linear_trend"]), next_value: z.number(), validation_rows: z.number(),
    linear_mae: z.number(), baseline_mae: z.number(),
  }).nullable(),
});

function Analytics({ base }: { base: string }) {
  const docs = useDocuments(base);
  const run = useMutation({
    mutationFn: (data: { document_id: string; column: string; chronological: boolean }) =>
      post(`${base}/analytics`, data, analysis),
  });
  const csv = docs.data?.filter((item) => item.name.toLowerCase().endsWith(".csv")) ?? [];
  return <><h2>CSV analysis</h2>
    <FormNotice error={docs.error ?? run.error} />
    {!csv.length ? <p>Upload a CSV in the <Link href="/knowledge">Knowledge Base</Link>.</p> : <form className="nexus-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        run.mutate({ document_id: String(form.get("document")), column: String(form.get("column")).trim(),
          chronological: form.get("chronological") === "on" });
      }}>
      <label>CSV document<select name="document">{csv.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Numeric column<input name="column" required maxLength={150} placeholder="Exact column header" /></label>
      <label className="approval"><input type="checkbox" name="chronological" /> Rows are in chronological order</label>
      <button className="button primary" disabled={run.isPending}>Analyze</button>
    </form>}
    {run.data && <div className="feature-result"><h3>{run.data.column}</h3>
      <p>Count {run.data.count} · Skipped {run.data.skipped} · Mean {run.data.mean} · Median {run.data.median}</p>
      <p>Range {run.data.min} to {run.data.max} · Flagged anomalies {run.data.anomaly_count}</p>
      {run.data.forecast ? <p>Next estimate: {run.data.forecast.next_value.toPrecision(5)} using {run.data.forecast.method.replaceAll("_", " ")}.
        Validation MAE over {run.data.forecast.validation_rows} rows: linear {run.data.forecast.linear_mae.toPrecision(4)}, baseline {run.data.forecast.baseline_mae.toPrecision(4)}.</p>
        : <p>Forecasting needs at least 20 complete, chronological rows.</p>}
      {!run.data.mad && <p>Median absolute deviation is zero. Anomaly scoring is unavailable.</p>}
      {!!run.data.anomalies.length && <ul className="feature-list">{run.data.anomalies.map((item) => <li key={item.row}>Row {item.row}: {item.value}</li>)}</ul>}
    </div>}
  </>;
}

function SqlStudio({ base }: { base: string }) {
  const query = useMutation({
    mutationFn: (question: string) => post(`${base}/sql`, { question }, z.object({
      query: z.string(), rows: z.array(z.record(z.string(), z.unknown())),
    })),
  });
  return <><h2>Read-only workspace queries</h2>
    <form className="nexus-form" onSubmit={(event) => {
      event.preventDefault();
      query.mutate(String(new FormData(event.currentTarget).get("question")));
    }}>
      <label>Approved operation<select name="question"><option>count documents</option><option>count chunks</option><option>list recent reports</option></select></label>
      <button className="button primary" disabled={query.isPending}>Run read-only query</button>
    </form>
    <FormNotice error={query.error} />
    {query.data && <div className="feature-result"><pre>{query.data.query}</pre>
      {query.data.rows.length ? <table className="result-table">
        <thead><tr>{Object.keys(query.data.rows[0]).map((name) => <th key={name}>{name}</th>)}</tr></thead>
        <tbody>{query.data.rows.map((row, index) => <tr key={index}>{Object.entries(row).map(([name, value]) => <td key={name}>{String(value)}</td>)}</tr>)}</tbody>
      </table> : <p>No rows matched.</p>}
    </div>}
  </>;
}

function ReportStudio({ base, mode }: { base: string; mode: "agents" | "research" | "reports" | "verification" }) {
  const [selected, select] = useState<Report | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const items = useQuery({
    queryKey: [base, "reports"], queryFn: ({ signal }) => get(`${base}/reports`, z.array(report), signal),
  });
  const showRuns = mode === "agents" || mode === "research";
  const runs = useQuery({
    queryKey: [base, "runs"], enabled: showRuns, refetchInterval: showRuns ? 4000 : false,
    queryFn: ({ signal }) => get(`${base}/runs`, z.array(z.object({
      id: z.uuid(), status: z.enum(["running", "failed", "interrupted", "completed"]),
      question: z.string(), steps: z.array(z.string()), report_id: z.uuid().nullable(),
    })), signal),
  });
  const run = useMutation({
    mutationFn: async (data: { question: string; approved: boolean } | { runId: string }) => {
      const active = new AbortController();
      controller.current = active;
      setSteps([]);
      try {
        return await stream("runId" in data ? `${base}/runs/${data.runId}/resume` : `${base}/reports`,
          "runId" in data ? {} : data, report, active.signal,
          (step) => setSteps((current) => [...current, step]));
      } finally { controller.current = null; }
    },
    onSuccess: (item) => { select(item); void items.refetch(); },
    onSettled: () => { void runs.refetch(); },
  });
  function requestReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run.mutate({ question: String(form.get("question")).trim(), approved: form.get("approve") === "on" });
  }
  function download(item: Report, format: "md" | "json" = "md") {
    const text = format === "json" ? JSON.stringify(item, null, 2) : item.body;
    const url = URL.createObjectURL(new Blob([text], { type: format === "json" ? "application/json" : "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `nexusai-${item.id}.${format}`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  let output: ReactNode = null;
  if (selected) output = <article className="feature-result"><h3>{selected.title}</h3>
    {selected.steps && <ul className="feature-list">{selected.steps.map((step) => <li key={step}>{step}</li>)}</ul>}
    <pre>{selected.body}</pre><div className="button-row"><button className="button" onClick={() => download(selected)}>Download Markdown</button>
      <button className="button" onClick={() => download(selected, "json")}>Download JSON</button></div>
  </article>;
  return <><h2>{mode === "verification" ? "Verified passage reports" : "Research and reports"}</h2>
    {(mode === "agents" || mode === "research") && <form className="nexus-form" onSubmit={requestReport}>
      <p>Retrieve evidence, verify stored passages, and save a Markdown research report.</p>
      <label>Research question<textarea name="question" required minLength={3} maxLength={1000} rows={3} /></label>
      <label className="approval"><input type="checkbox" name="approve" required /> Approve this workflow run</label>
      <div className="button-row"><button className="button primary" disabled={run.isPending}>{run.isPending ? "Running workflow…" : "Run research workflow"}</button>
        {run.isPending && <button className="button" type="button" onClick={() => controller.current?.abort()}>Cancel stream</button>}
      </div>
    </form>}
    {run.isPending && <ul className="feature-list" aria-live="polite">{steps.map((step) => <li key={step}>{step}</li>)}</ul>}
    <FormNotice error={run.error?.name === "AbortError" ? items.error : run.error ?? items.error} />
    {showRuns && <section><h3>Saved runs</h3><FormNotice error={runs.error} />
      <ul className="feature-list">{runs.data?.map((saved) => <li key={saved.id}>
        <strong>{saved.question}</strong><span>{saved.status} · {saved.steps.length} steps</span>
        {(saved.status === "failed" || saved.status === "interrupted") && <button className="button"
          disabled={run.isPending} onClick={() => run.mutate({ runId: saved.id })}>Resume run</button>}
      </li>)}</ul>
    </section>}
    <ul className="feature-list">{items.data?.map((item) => <li key={item.id}>
      <button className="button" onClick={() => select(item)}>{item.title}</button>
    </li>)}</ul>
    {items.data?.length === 0 && <p>No saved research reports yet.</p>}
    {output}
  </>;
}
