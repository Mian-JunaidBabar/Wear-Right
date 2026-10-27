import { expect, test } from "./fixtures";

test("2. a private route while logged out redirects to login with ?next", async ({ page }) => {
  for (const path of ["/profile", "/my-orders", "/order-confirmation"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/%/g, "%")}$`));
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  }
});

test("2a. the admin panel redirects to its own login, not the shop's", async ({ page }) => {
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Forders$/);
  await expect(page.getByRole("heading", { name: /team sign in/i })).toBeVisible();
});

test("2b. the legacy /auth and /facescan URLs still work", async ({ page }) => {
  await page.goto("/auth");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/facescan");
  await expect(page).toHaveURL(/\/scanner$/);
});
