import { isProbe, probes } from "@/lib/api";
import { backendOrigin } from "@/lib/server-backend";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ probe: string }> }) {
  const { probe } = await params;
  if (!isProbe(probe)) {
    return Response.json({ error: "Unknown system check." }, { status: 404, headers: noStore });
  }
  if (probe === "readiness" && process.env.NEXUSAI_ENABLE_READINESS_PROXY !== "true") {
    return Response.json({ error: "Database readiness is restricted." }, { status: 403, headers: noStore });
  }

  const started = performance.now();
  try {
    const response = await fetch(new URL(probes[probe].path, backendOrigin()), {
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(4500)]),
      redirect: "error",
      headers: { Accept: "application/json" },
    });
    const result = probes[probe].schema.safeParse(await response.json());
    const validStatus = probe === "readiness" && result.success && result.data.status === "not_ready"
      ? response.status === 503
      : response.status === 200;
    if (!validStatus || !result.success) throw new Error("Unexpected backend response.");

    const headers = new Headers(noStore);
    headers.set("x-nexusai-probe-ms", String(Math.round(performance.now() - started)));
    const requestId = response.headers.get("x-request-id");
    if (requestId) headers.set("x-request-id", requestId);
    return Response.json(result.data, { status: response.status, headers });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      { error: timedOut ? "Backend check timed out." : "Backend check unavailable." },
      { status: timedOut ? 504 : 502, headers: noStore },
    );
  }
}
