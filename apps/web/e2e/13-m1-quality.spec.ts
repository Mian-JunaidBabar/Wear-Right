import { ADMIN, adminLogin, expect, register, test } from "./fixtures";
import type { Page } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/shop",
  "/cart",
  "/scan",
  "/scanner",
  "/recommended?skinTone=medium&undertone=warm",
  "/complete-outfit",
  "/wishlist",
  "/about",
  "/contact",
  "/login",
  "/register",
];

async function expectNoHorizontalOverflow(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    metrics.scrollWidth,
    `${path} overflows horizontally at ${metrics.innerWidth}px (${metrics.scrollWidth}px)`,
  ).toBeLessThanOrEqual(metrics.innerWidth + 1);
}

test("13a. an unknown route has a clear 404 page", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByText(/not found|404|page.*missing/i).first()).toBeVisible();
});

test("13b. public routes do not overflow at 390px and keep a usable page", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of PUBLIC_ROUTES) {
    await expectNoHorizontalOverflow(page, path);
    const shot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`390-${path.replace(/[^a-z0-9]+/gi, "-") || "home"}.png`, {
      body: shot,
      contentType: "image/png",
    });
  }

  const list = await (await page.request.get("/api/products/?page_size=200")).json();
  const product = list.products[0];
  await expectNoHorizontalOverflow(page, `/product/${product.id}`);
});

test("13c. signed-in and admin routes do not overflow at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page);
  for (const path of ["/profile", "/my-orders"]) await expectNoHorizontalOverflow(page, path);

  await page.context().clearCookies();
  await adminLogin(page, ADMIN.email, ADMIN.password, "/admin");
  await page.waitForURL("**/admin");
  await expectNoHorizontalOverflow(page, "/admin");
});

test("13d. product detail does not overflow at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const list = await (await page.request.get("/api/products/?page_size=200")).json();
  const product = list.products[0];
  await expectNoHorizontalOverflow(page, `/product/${product.id}`);
});

test("13e. forms are labelled and reachable with the keyboard", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel(/full name/i).focus();
  await expect(page.getByLabel(/full name/i)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/email/i).first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/password/i).first()).toBeFocused();
  await expect(page.getByLabel(/confirm password/i)).toHaveCount(1);

  await page.goto("/login");
  await page.getByLabel(/email/i).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/password/i)).toBeFocused();
});
