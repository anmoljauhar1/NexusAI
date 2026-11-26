import assert from "node:assert/strict";
import test from "node:test";
import { fetchProbe, isProbe, probes } from "../../lib/api.ts";

test("only forwards known probe names", () => {
  assert.equal(isProbe("health"), true);
  assert.equal(isProbe("readiness"), true);
  assert.equal(isProbe("constructor"), false);
  assert.equal(isProbe("../docs"), false);
});

test("accepts the database state that corresponds to readiness", () => {
  assert.equal(probes.readiness.schema.safeParse({ status: "ready", database: "available" }).success, true);
  assert.equal(probes.readiness.schema.safeParse({ status: "not_ready", database: "not_configured" }).success, true);
  assert.equal(probes.readiness.schema.safeParse({ status: "ready", database: "unavailable" }).success, false);
});

test("parses a real-shaped readiness failure and ignores invalid timing", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json(
    { status: "not_ready", database: "not_configured" },
    { status: 503, headers: { "x-nexusai-probe-ms": "invalid" } },
  ));
  assert.deepEqual(await fetchProbe("readiness"), {
    data: { status: "not_ready", database: "not_configured" },
    durationMs: null,
    requestId: null,
  });
});
