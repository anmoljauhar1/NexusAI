import { z } from "zod";
import { ApiError } from "@/lib/api";

export const workspace = z.object({ id: z.uuid(), name: z.string() });
export const account = z.object({ id: z.uuid(), email: z.string(), display_name: z.string().optional() });
export type Account = z.infer<typeof account>;
export const sessionRecheck = "nexusai-session-recheck";
export const documentRow = z.object({
  id: z.uuid(), name: z.string(), state: z.enum(["queued", "processing", "ready", "failed"]),
  error: z.string().nullable(),
});
export const sourceRow = z.object({ id: z.uuid(), document_id: z.uuid(), name: z.string(), page: z.number(), passage: z.string() });
export const exchange = z.object({
  id: z.uuid(), question: z.string(), result: z.object({
    answer: z.string(), sources: z.array(sourceRow), retrieval: z.string(),
    answer_mode: z.string(), indexed_chunks: z.number(),
  }),
});
export const report = z.object({ id: z.uuid(), title: z.string(), body: z.string(), steps: z.array(z.string()).nullish() });

export async function workspaceRequest(path: string, init?: RequestInit) {
  const timeout = AbortSignal.timeout(70_000);
  const response = await fetch(`/api/workspace/${path}`, {
    ...init, cache: "no-store", credentials: "same-origin",
    signal: init?.signal ? AbortSignal.any([timeout, init.signal]) : timeout,
  });
  if (!response.ok) {
    if (response.status === 401 && (path.startsWith("workspaces") || path === "auth/sessions") && typeof window !== "undefined") {
      window.dispatchEvent(new Event(sessionRecheck));
    }
    const payload = await response.json().catch(() => null);
    throw new ApiError(response.status, typeof payload?.error?.message === "string"
      ? payload.error.message : "The workspace request failed.");
  }
  return response;
}

export async function get<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  return schema.parse(await (await workspaceRequest(path, { signal })).json());
}

export async function post<T>(path: string, payload: unknown, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(await (await workspaceRequest(path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  })).json());
}

export async function stream<T>(
  path: string, payload: unknown, schema: z.ZodType<T>, signal: AbortSignal,
  progress: (value: string) => void,
): Promise<T> {
  const response = await workspaceRequest(path, {
    method: "POST", headers: { Accept: "text/event-stream" }, body: JSON.stringify(payload), signal,
  });
  const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader();
  if (!reader) throw new Error("No response stream received.");
  try {
    let pending = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error("The response stream ended before the result arrived.");
      pending += value;
      let end = pending.indexOf("\n\n");
      while (end >= 0) {
        const [event, data] = pending.slice(0, end).split("\n");
        const payload = JSON.parse(data.slice(6));
        if (event === "event: error") throw new Error(z.string().parse(payload));
        if (event === "event: result") return schema.parse(payload);
        if (event === "event: passage" || event === "event: step") progress(z.string().parse(payload));
        pending = pending.slice(end + 2);
        end = pending.indexOf("\n\n");
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}
