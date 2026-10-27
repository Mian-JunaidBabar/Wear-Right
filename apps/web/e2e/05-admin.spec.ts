import { ADMIN, PASSWORD, adminLogin, alertBox, expect, register, test, uniqueEmail } from "./fixtures";

test("5a. admin login works on /admin/login and the panel loads its data", async ({ page, problems }) => {
  await adminLogin(page, ADMIN.email, ADMIN.password, "/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Total Products").first()).toBeVisible();

  // The API agrees: the dashboard is open to this admin session
  const response = await page.request.get("/api/admin/dashboard/");
  expect(response.status()).toBe(200);
  expect((await response.json()).dashboard.total_products).toBeGreaterThanOrEqual(11);

  // The shop does not treat the admin session as a signed-in customer, and draws no shop chrome here
  expect((await page.request.get("/api/auth/me/")).status()).toBe(401);
  await expect(page.getByTitle("Cart")).toHaveCount(0);

  expect(problems).toEqual([]);
});

test("5b. admin can also sign in with the username, and every section has its own URL", async ({ page }) => {
  await adminLogin(page, "admin", ADMIN.password, "/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Orders", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Orders", level: 2 })).toBeVisible();
});

test("5c. shop and admin logins are separate both ways", async ({ page }) => {
  // A customer cannot use the admin login, and their shop session does not open the admin panel or API
  const { email } = await register(page);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(alertBox(page)).toContainText(/no admin access/i);
  expect((await page.request.get("/api/admin/dashboard/")).status()).toBe(401);

  // and there is no Admin shortcut in the shop navbar
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Admin" })).toHaveCount(0);

  // A team account cannot sign in to the shop
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByPlaceholder("customer@gmail.com").fill(ADMIN.email);
  await page.getByPlaceholder("Enter password").fill(ADMIN.password);
  await page.getByRole("button", { name: /^login$/i }).last().click();
  await expect(page.getByText(/team account/i).first()).toBeVisible();
});

test("5d. anonymous callers get 401 from the admin dashboard and orders APIs", async ({ request }) => {
  expect((await request.get("/api/admin/dashboard/")).status()).toBe(401);
  expect((await request.get("/api/admin/orders/")).status()).toBe(401);
  expect((await request.get("/api/orders/")).status()).toBe(401);
});

test("5e. the sidebar collapses and remembers it", async ({ page }) => {
  await adminLogin(page, ADMIN.email, ADMIN.password, "/admin");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
});

test("5f. a Super Admin adds an Order Handler, who only sees what the role allows", async ({ page, browser }) => {
  const email = uniqueEmail("handler");
  page.on("dialog", (dialog) => dialog.accept());
  await adminLogin(page, ADMIN.email, ADMIN.password, "/admin/team");
  await page.getByRole("button", { name: /add member/i }).click();
  const dialog = page.getByRole("dialog", { name: "Add team member" });
  await dialog.getByLabel("Full name").fill("Order Handler E2E");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Password").fill(PASSWORD);
  await dialog.getByLabel("Role").selectOption({ label: "Order Handler" });
  await dialog.getByRole("button", { name: /add member/i }).click();
  await expect(page.getByTestId("member-row").filter({ hasText: email })).toBeVisible();

  const handler = await browser.newPage();
  await adminLogin(handler, email, PASSWORD, "/admin");
  await expect(handler).toHaveURL(/\/admin$/);
  await expect(handler.getByRole("button", { name: "Orders", exact: true })).toBeVisible();
  await expect(handler.getByRole("button", { name: "Team & Roles" })).toHaveCount(0);
  await handler.goto("/admin/team");
  await expect(alertBox(handler)).toContainText(/not allowed|does not include/i);
  expect((await handler.request.get("/api/admin/members/")).status()).toBe(403);
  await handler.goto("/admin/products");
  await expect(handler.getByRole("button", { name: /add product/i })).toHaveCount(0);
  await handler.close();

  // and the Super Admin removes them again
  await page.getByTestId("member-row").filter({ hasText: email }).getByRole("button", { name: /remove/i }).click();
  await expect(page.getByTestId("member-row").filter({ hasText: email })).toHaveCount(0);
});
