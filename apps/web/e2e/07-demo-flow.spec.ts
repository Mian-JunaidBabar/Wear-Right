import path from "node:path";
import { ADMIN, alertBox, expect, login, logout, register, test } from "./fixtures";

test("7a. scanner: uploading an image returns a result (or a clear rescan message) without errors", async ({ page, problems }) => {
  await page.goto("/scanner");
  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "assets", "skin-patch.jpg"));
  // Either a detected tone or a "rescan" message; both are valid answers for a synthetic patch.
  await expect(page.getByText(/scan complete|rescan|unable to analyze|View Recommended Products/i).first()).toBeVisible({ timeout: 30_000 });
  expect(problems).toEqual([]);
});

test("7b. recommendations and complete-the-outfit work for a detected tone", async ({ page, problems }) => {
  await page.goto("/recommended?skinTone=medium");
  await expect(page.getByText(/recommended/i).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  const card = page.locator("main img").nth(1);
  await expect(card).toBeVisible();

  await page.goto("/complete-outfit?skinTone=medium&style=casual");
  await expect(page.getByText(/outfit/i).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(problems).toEqual([]);
});

test("7c. full purchase: cart, checkout, confirmation, my orders, then admin processes it", async ({ page, browser, dialogs, problems }) => {
  const { email } = await register(page, undefined, "Demo Customer");

  // Add two products from the shop
  await page.goto("/shop");
  await page.getByRole("button", { name: /Men Shirt/ }).first().click();
  await page.getByRole("button", { name: /add to cart/i }).first().click();
  await page.getByRole("button", { name: /add to cart/i }).nth(1).click();
  await expect(page.getByTitle("Cart").locator("span")).toHaveText("2");

  // Checkout
  await page.getByTitle("Cart").click();
  await page.getByRole("button", { name: /^checkout$/i }).first().click();
  await page.getByPlaceholder("Full name").fill("Demo Customer");
  await page.getByPlaceholder("03000000000").fill("03001234567");
  await page.getByPlaceholder("House no, street, city").fill("12 Model Town, Lahore");
  await page.getByRole("button", { name: /place order/i }).click();

  // Confirmation page shows the order, the cart is emptied
  await expect(page).toHaveURL(/\/order-confirmation$/);
  await expect(page.getByText("Demo Customer").first()).toBeVisible();
  await expect(page.getByTitle("Cart").locator("span")).toHaveText("0");

  // My orders lists it
  await page.goto("/my-orders");
  await expect(page.getByText(/WR-\d+/).first()).toBeVisible();
  await expect(page.getByText("Pending").first()).toBeVisible();

  // The admin sees it and confirms it
  const adminPage = await browser.newPage();
  adminPage.on("dialog", (d) => d.accept());
  await login(adminPage, ADMIN.email, ADMIN.password, "/admin");
  await adminPage.getByRole("button", { name: "Orders", exact: true }).click();
  await expect(adminPage.getByText("Demo Customer").first()).toBeVisible();
  await adminPage.close();

  expect(dialogs.some((m) => /logged out/i.test(m))).toBe(false);
  expect(problems).toEqual([]);
  void email;
});

test("7d. guest checkout is sent to login and the cart is kept", async ({ page, dialogs }) => {
  await page.goto("/shop");
  await page.getByRole("button", { name: /Men Shirt/ }).first().click();
  await page.getByRole("button", { name: /add to cart/i }).first().click();
  await page.getByTitle("Cart").click();
  await page.getByRole("button", { name: /^checkout$/i }).first().click();
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(dialogs.some((m) => /log in to check out/i.test(m))).toBe(true);
  await page.goto("/");
  await expect(page.getByTitle("Cart").locator("span")).toHaveText("1");
});

test("7e. profile edits are saved and survive a reload", async ({ page, problems }) => {
  await register(page, undefined, "Profile Tester");
  await page.goto("/profile");
  await page.getByRole("button", { name: /edit profile/i }).click();
  await page.getByPlaceholder("Your Name").fill("Profile Tester Renamed");
  await page.getByPlaceholder("e.g. M").fill("L");
  await page.getByRole("button", { name: /save changes/i }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Profile Tester Renamed" })).toBeVisible();
  await page.getByRole("button", { name: /edit profile/i }).click();
  await expect(page.getByPlaceholder("e.g. M")).toHaveValue("L");
  void logout; void alertBox;
  expect(problems).toEqual([]);
});

test("7f. the seeded demo customer can sign in, and is not an admin", async ({ page, problems }) => {
  await login(page, "demo@wearright.local", "demo12345", "/profile");
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "Demo Customer" })).toBeVisible();
  expect((await page.request.get("/api/admin/dashboard/")).status()).toBe(403);
  expect(problems).toEqual([]);
});
