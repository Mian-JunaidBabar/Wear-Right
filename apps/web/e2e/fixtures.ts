import { expect, test as base, type Page } from "@playwright/test";

export const ADMIN = { email: "admin@wearright.local", password: "admin12345" };
export const PASSWORD = "Str0ng-Passw0rd!x";

export type Problems = string[];

/**
 * Every page gets a list of console errors, uncaught exceptions, failed
 * requests and HTTP >= 400 responses seen during the test.
 */
export const test = base.extend<{ problems: Problems; dialogs: string[]; nativeDialogs: string[] }>({
  problems: async ({ page }, run) => {
    const problems: Problems = [];
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(`console.error: ${message.text()}`);
    });
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
    page.on("requestfailed", (request) => {
      const reason = request.failure()?.errorText ?? "unknown";
      // Navigating or reloading cancels in-flight Next.js link prefetches (?_rsc=...). That is
      // the browser aborting a speculative request, not a failure of the app.
      if (reason === "net::ERR_ABORTED" && request.url().includes("_rsc=")) return;
      problems.push(`request failed: ${request.url()} (${reason})`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    await run(problems);
  },
  /**
   * Toast messages the app showed (the shop used window.alert before; now it uses toasts). Collected
   * by a MutationObserver in the page that reports each new toast through the console.
   */
  dialogs: async ({ page }, run) => {
    const messages: string[] = [];
    await page.addInitScript(() => {
      const seen = new WeakSet<Node>();
      const scan = () =>
        document.querySelectorAll('[data-testid="toast"]').forEach((node) => {
          if (seen.has(node)) return;
          seen.add(node);
          console.debug("__toast__:" + (node.textContent ?? ""));
        });
      new MutationObserver(scan).observe(document, { childList: true, subtree: true, characterData: true });
    });
    page.on("console", (message) => {
      if (message.text().startsWith("__toast__:")) messages.push(message.text().slice("__toast__:".length));
    });
    await run(messages);
  },
  /** Native browser dialogs. The app should not raise any; they are accepted so a test cannot hang. */
  nativeDialogs: async ({ page }, run) => {
    const messages: string[] = [];
    page.on("dialog", async (dialog) => {
      messages.push(dialog.message());
      await dialog.accept();
    });
    await run(messages);
  },
});

export { expect };

/** The page's own alert box (Next.js also renders an empty role="alert" route announcer). */
export function alertBox(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

export async function register(page: Page, email = uniqueEmail(), name = "E2E Shopper") {
  await page.goto("/register");
  await page.getByPlaceholder("Full name").fill(name);
  await page.getByPlaceholder("customer@gmail.com").fill(email);
  await page.getByPlaceholder(/choose a password/i).fill(PASSWORD);
  await page.getByLabel(/confirm password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/");
  return { email, name };
}

export async function login(page: Page, email: string, password: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByPlaceholder("customer@gmail.com").fill(email);
  await page.getByPlaceholder("Enter password").fill(password);
  await page.getByRole("button", { name: /^login$/i }).last().click();
}

export async function logout(page: Page) {
  await page.getByTitle("Account Menu").click();
  await page.getByRole("button", { name: /logout/i }).first().click();
}
