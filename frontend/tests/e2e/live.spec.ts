import { expect, test } from "@playwright/test";

test.skip(process.env.NEXUSAI_E2E_LIVE !== "1", "Requires an authorized frontend and real FastAPI backend.");

test("reads actual FastAPI status and readiness through the frontend", async ({ page, request }) => {
  const health = await request.get("/api/system/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
  expect(health.headers()["x-request-id"]).toBeTruthy();

  const status = await request.get("/api/system/status");
  expect(status.status()).toBe(200);
  const version = (await status.json()).version;
  expect(typeof version).toBe("string");

  const readiness = await request.get("/api/system/readiness");
  const ready = await readiness.json();
  expect(["available", "not_configured", "unavailable"]).toContain(ready.database);
  expect(readiness.status()).toBe(ready.database === "available" ? 200 : 503);

  const unsupportedProbe = await request.get("/api/system/unknown");
  expect(unsupportedProbe.status()).toBe(404);

  await page.goto("/monitoring");
  await expect(page.getByText(version, { exact: true })).toBeVisible();
  const databaseText = { available: "Available", not_configured: "Not configured", unavailable: "Unavailable" } as const;
  await expect(page.locator("article").filter({ hasText: "Database readiness" }).locator("strong")).toHaveText(databaseText[ready.database as keyof typeof databaseText]);
});

test("captures screenshots of the actual frontend and service status", async ({ page }, info) => {
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [route, filename] of [["/", "landing"], ["/dashboard", "dashboard"], ["/agents", "agent-studio"]] as const) {
      await page.goto(route);
      if (route === "/dashboard") {
        await expect(page.getByText("Connected", { exact: true })).toBeVisible();
      }
      await page.screenshot({ path: info.outputPath(`${filename}-${width}.png`), fullPage: true, animations: "disabled" });
    }
  }
});
