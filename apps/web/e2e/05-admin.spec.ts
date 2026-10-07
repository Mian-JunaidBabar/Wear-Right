import { ADMIN, expect, login, register, test, alertBox } from "./fixtures";

test("5a. admin login works and the admin panel loads its data", async ({ page, problems }) => {
  await login(page, ADMIN.email, ADMIN.password, "/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Total Products").first()).toBeVisible();

  // The API agrees: the dashboard is open to this user
  const response = await page.request.get("/api/admin/dashboard/");
  expect(response.status()).toBe(200);
  expect((await response.json()).dashboard.total_products).toBeGreaterThanOrEqual(11);

  expect(problems).toEqual([]);
});

test("5b. admin can also sign in with the username", async ({ page }) => {
  await login(page, "admin", ADMIN.password, "/admin");
  await expect(page).toHaveURL(/\/admin$/);
});

test("5c. a non-admin is blocked from the admin page and from admin/dashboard/", async ({ page }) => {
  await register(page);

  await page.goto("/admin");
  await expect(alertBox(page)).toContainText(/not authorised/i);
  await expect(page.getByText("Total Products")).toHaveCount(0);

  const response = await page.request.get("/api/admin/dashboard/");
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe("PermissionDenied");

  // and the Admin shortcut is not offered to them
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Admin" })).toHaveCount(0);
});

test("5d. anonymous callers get 401 from the admin dashboard and orders APIs", async ({ request }) => {
  expect((await request.get("/api/admin/dashboard/")).status()).toBe(401);
  expect((await request.get("/api/orders/")).status()).toBe(401);
});
