import { z } from "zod";

const database = z.enum(["available", "not_configured", "unavailable"]);
export const probes = {
  health: {
    path: "/health",
    schema: z.object({ status: z.literal("ok") }),
  },
  status: {
    path: "/api/v1/status",
    schema: z.object({
      service: z.string(),
      version: z.string(),
      api_version: z.string(),
      status: z.literal("ok"),
      database: database.nullable(),
    }),
  },
  readiness: {
    path: "/ready",
    schema: z.union([
      z.object({ status: z.literal("ready"), database: z.literal("available") }),
      z.object({ status: z.literal("not_ready"), database: z.enum(["not_configured", "unavailable"]) }),
    ]),
  },
} as const;
export type Probe = keyof typeof probes;

export function isProbe(value: string): value is Probe {
  return Object.hasOwn(probes, value);
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function fetchProbe<K extends Probe>(probe: K, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(7000);
  const response = await fetch(`/api/system/${probe}`, {
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    cache: "no-store",
    credentials: "omit",
  });
  const readinessFailure = probe === "readiness" && response.status === 503;
  if (!response.ok && !readinessFailure) {
    const message = response.status === 403
      ? "This check is restricted to an internal deployment."
      : "The backend check did not complete.";
    throw new ApiError(response.status, message);
  }
  const parsed = probes[probe].schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ApiError(response.status, "The server returned an unexpected response.");
  }
  const header = response.headers.get("x-nexusai-probe-ms");
  const duration = header === null ? NaN : Number(header);
  return {
    data: parsed.data as z.output<(typeof probes)[K]["schema"]>,
    durationMs: Number.isFinite(duration) && duration >= 0 ? duration : null,
    requestId: response.headers.get("x-request-id"),
  };
}
