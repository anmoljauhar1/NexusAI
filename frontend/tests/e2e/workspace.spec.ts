import { expect, test } from "@playwright/test";

test("opens the workspace and finds the Agent Studio from the command palette", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("One Platform. Multiple AI Agents. Intelligent Decisions.");
  await page.getByRole("link", { name: "Get Started" }).click();
  await page.getByRole("button", { name: "Search workspace modules" }).click();
  const dialog = page.getByRole("dialog", { name: "Search workspace modules" });
  await dialog.getByRole("textbox", { name: "Filter modules" }).fill("agent studio");
  await dialog.getByRole("link", { name: /Agent Studio/ }).click();
  await expect(page).toHaveURL(/\/agents$/);
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await expect(page.getByRole("region", { name: "Selected agent" })).toContainText("Collects relevant passages");
  await expect(page.getByText("This diagram shows the proposed six-agent design.", { exact: false })).toBeVisible();
});

test("persists the light theme across navigation and reload", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Light", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("opens and dismisses the mobile menu with the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/dashboard");
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  await expect(page.getByRole("dialog", { name: "Workspace navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
});

test("explains API failure without showing a fake metric", async ({ page }) => {
  await page.route("**/api/system/*", (route) => route.fulfill({
    status: 502,
    contentType: "application/json",
    body: JSON.stringify({ error: "Test fixture for an unreachable backend" }),
  }));
  await page.goto("/dashboard");
  await expect(page.getByText("The frontend could not reach the backend.")).toBeVisible();
  await expect(page.getByText("Unreachable", { exact: true })).toBeVisible();
});

test("account form displays a real-shaped unavailable-state error", async ({ page }) => {
  await page.route("**/api/workspace/auth/login", (route) => route.fulfill({
    status: 503, json: { error: { message: "The database is unavailable." } },
  }));
  await page.goto("/login");
  await page.getByLabel("Email").fill("tester@example.test");
  await page.getByLabel("Password").fill("temporary-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The database is unavailable.");
});

test("profile follows sign-in and hides the account after sign-out", async ({ page }) => {
  const account = { id: "6de1288b-2bf0-448a-90fa-5bc212c32adb", email: "tester@example.test" };
  let signedIn = false;
  await page.route("**/api/workspace/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/session")) {
      return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? account : { error: { message: "Sign in." } } });
    }
    if (path.endsWith("/auth/login")) {
      signedIn = true;
      return route.fulfill({ json: account });
    }
    if (path.endsWith("/auth/logout")) {
      signedIn = false;
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/auth/sessions")) return route.fulfill({ json: [] });
    if (path.endsWith("/workspaces")) return route.fulfill({ json: [] });
    return route.abort();
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill("temporary-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.locator("summary[aria-label='Account menu']").click();
  await page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: "My profile" }).click();
  await expect(page.getByText(account.id)).toBeVisible();
  await page.reload();
  await expect(page.getByText(account.id)).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/profile");
  await expect(page.getByText("Sign in to view your profile.")).toBeVisible();
  await expect(page.getByText(account.id)).toHaveCount(0);
});

test("filters documents, requests a re-index, and confirms deletion", async ({ page }) => {
  const account = { id: "6de1288b-2bf0-448a-90fa-5bc212c32adb", email: "tester@example.test" };
  const workspace = { id: "13c7014f-ee54-4ebe-a9aa-be637c063a81", name: "Review workspace" };
  const document = { id: "650117c8-5138-4dbd-91b2-5ff33676e7de", name: "review.pdf", state: "ready", error: null };
  const url = `/api/workspace/workspaces/${workspace.id}/documents/${document.id}`;
  let removed = false;
  await page.route("**/api/workspace/**", async (route) => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    if (pathname.endsWith("/auth/session")) return route.fulfill({ json: account });
    if (pathname.endsWith("/workspaces")) return route.fulfill({ json: [workspace] });
    if (pathname.endsWith("/documents/catalog")) {
      const matches = document.name.includes(searchParams.get("q") ?? "") &&
        ["", document.state].includes(searchParams.get("state") ?? "");
      return route.fulfill({ json: { items: !removed && matches ? [document] : [], has_more: false } });
    }
    if (pathname === `${url}/reindex`) return route.fulfill({ status: 202, json: { state: "queued" } });
    if (pathname === url && request.method() === "DELETE") {
      removed = true;
      return route.fulfill({ status: 204 });
    }
    return route.abort();
  });
  await page.goto("/knowledge");
  await page.getByRole("textbox", { name: "Search filename" }).fill("unrelated");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("No documents match this page and filter.")).toBeVisible();
  await page.getByRole("textbox", { name: "Search filename" }).fill("review");
  await page.getByLabel("Status", { exact: true }).selectOption("ready");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("link", { name: "Preview original" })).toHaveAttribute("href", `${url}/file`);
  const reindex = page.waitForRequest((request) => request.url().endsWith(`${url}/reindex`) && request.method() === "POST");
  await page.getByRole("button", { name: "Re-index" }).click();
  await reindex;
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText(document.name)).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("No documents match this page and filter.")).toBeVisible();
});

test("opens the original PDF at the page cited in a saved answer", async ({ page }) => {
  const account = { id: "6de1288b-2bf0-448a-90fa-5bc212c32adb", email: "tester@example.test" };
  const workspace = { id: "13c7014f-ee54-4ebe-a9aa-be637c063a81", name: "Review workspace" };
  const source = { id: "811d6150-3450-449f-9458-2dff9a1e740d", document_id: "650117c8-5138-4dbd-91b2-5ff33676e7de",
    name: "review.pdf", page: 7, passage: "The budget was approved." };
  const question = "Was the budget approved?";
  await page.route("**/api/workspace/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/session")) return route.fulfill({ json: account });
    if (path.endsWith("/workspaces")) return route.fulfill({ json: [workspace] });
    if (path.endsWith(`/sources/${source.id}`)) return route.fulfill({ json: source });
    if (path.endsWith("/chat")) return route.fulfill({ json: [{ id: source.id, question, result: {
      answer: source.passage, sources: [source], retrieval: "keyword", answer_mode: "extractive", indexed_chunks: 1,
    } }] });
    return route.abort();
  });
  await page.goto("/chat");
  await page.getByRole("button", { name: question }).click();
  await page.getByRole("button", { name: /review\.pdf.*page 7/ }).click();
  await expect(page.getByRole("link", { name: "Open PDF at page 7" })).toHaveAttribute("href",
    `/api/workspace/workspaces/${workspace.id}/documents/${source.document_id}/file#page=7`);
});

for (const width of [360, 768, 1024, 1440, 1920]) {
  test(`avoids page-level horizontal overflow at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/dashboard", "/chat", "/agents", "/knowledge", "/research", "/sql", "/analytics", "/machine-learning", "/deep-learning", "/llm-studio", "/verification", "/reports", "/experiments", "/monitoring", "/settings", "/login", "/register", "/logout"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, route).toBe(false);
    }
  });
}
