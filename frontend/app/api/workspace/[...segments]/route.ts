import type { NextRequest } from "next/server";
import { backendOrigin } from "@/lib/server-backend";

const id = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const rules = {
  GET: new RegExp(`^(auth/(?:session|sessions)|workspaces(?:/${id}/(?:documents(?:/catalog|/${id}/file)?|chat|reports|runs|overview|sources/${id}))?)$`, "i"),
  POST: new RegExp(`^(auth/(?:register|login|logout|profile|password|reset-request|reset-password|sessions/${id}/revoke)|workspaces(?:/${id}/(?:documents(?:/${id}/(?:retry|reindex))?|chat|reports|runs/${id}/resume|analytics|sql))?)$`, "i"),
  DELETE: new RegExp(`^workspaces/${id}/documents/${id}$`, "i"),
};
const maxUpload = 5 * 1024 * 1024;
type Context = { params: Promise<{ segments: string[] }> };

function fail(status: number, message: string) {
  return Response.json({ error: { message } }, { status, headers: { "Cache-Control": "no-store" } });
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const configured = process.env.NEXUSAI_PUBLIC_ORIGIN;
  if (!origin) return false;
  if (configured) return origin === configured;
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin && ["http:", "https:"].includes(parsed.protocol) &&
      parsed.host === request.headers.get("host") && parsed.protocol === request.nextUrl.protocol;
  } catch {
    return false;
  }
}

async function readBody(request: NextRequest, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) return undefined;
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new RangeError();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  } finally {
    reader.releaseLock();
  }
}

async function forward(request: NextRequest, { params }: Context, method: keyof typeof rules) {
  const path = (await params).segments.join("/");
  if (!rules[method].test(path)) return fail(404, "Unknown workspace operation.");
  const upload = method === "POST" && path.endsWith("/documents");
  if (method !== "GET" && !isSameOrigin(request)) return fail(403, "Request origin does not match this app.");

  const headers = new Headers();
  const accept = request.headers.get("accept");
  if (accept === "text/event-stream" && (path.endsWith("/chat") || path.endsWith("/reports") || path.endsWith("/resume"))) {
    headers.set("Accept", accept);
  }
  const token = request.cookies.get("nexus_session")?.value;
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) headers.set("Cookie", `nexus_session=${token}`);
  if (method !== "GET") {
    headers.set("X-NexusAI-Request", "workspace");
    headers.set("Content-Type", upload ? "application/octet-stream" : "application/json");
  }

  try {
    const url = new URL(`/api/v1/${path}`, backendOrigin());
    if (upload) url.searchParams.set("name", request.nextUrl.searchParams.get("name") ?? "");
    if (method === "GET" && path.endsWith("/catalog")) {
      for (const key of ["q", "state", "page"]) {
        const value = request.nextUrl.searchParams.get(key);
        if (value !== null) url.searchParams.set(key, value);
      }
    }
    const body = method === "POST" ? await readBody(request, upload ? maxUpload : 16_384) : undefined;
    const response = await fetch(url, {
      method, cache: "no-store", redirect: "error", headers, body,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(65_000)]),
    });
    const output = new Headers({ "Cache-Control": "no-store" });
    for (const header of ["content-type", "x-request-id", "x-accel-buffering", "content-disposition", "content-security-policy", "x-content-type-options"]) {
      const value = response.headers.get(header);
      if (value) output.set(header, value);
    }
    if (path.startsWith("auth/")) {
      for (const cookie of response.headers.getSetCookie()) {
        if (cookie.startsWith("nexus_session=")) output.append("Set-Cookie", cookie);
      }
    }
    return new Response(response.body, { status: response.status, headers: output });
  } catch (error) {
    if (error instanceof RangeError) return fail(413, "Request is too large.");
    if (error instanceof Error && error.name === "TimeoutError") return fail(504, "The backend timed out.");
    return fail(502, "Could not connect to the workspace backend.");
  }
}

export function GET(request: NextRequest, context: Context) { return forward(request, context, "GET"); }
export function POST(request: NextRequest, context: Context) { return forward(request, context, "POST"); }
export function DELETE(request: NextRequest, context: Context) { return forward(request, context, "DELETE"); }
