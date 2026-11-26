import { defineConfig, devices } from "@playwright/test";

const existingUrl = process.env.NEXUSAI_TEST_FRONTEND_URL;
const baseURL = existingUrl ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "workspace", testMatch: "workspace.spec.ts", use: { ...devices["Desktop Chrome"] } },
    { name: "backend", testMatch: "live.spec.ts", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: existingUrl ? undefined : {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: baseURL,
    reuseExistingServer: false,
  },
});
