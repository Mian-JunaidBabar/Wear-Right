import { expect, register, test, alertBox } from "./fixtures";

test("3. register a new user, land logged in, reload, still logged in", async ({ page, problems }) => {
  const { email, name } = await register(page);

  // Landed on the home page, signed in: the account menu offers Logout
  await page.getByTitle("Account Menu").click();
  await expect(page.getByRole("button", { name: /logout/i }).first()).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();

  // The tokens are httpOnly cookies, never readable from JS
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "wr-access")?.httpOnly).toBe(true);
  expect(cookies.find((c) => c.name === "wr-refresh")?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain("wr-access");

  // Reload: still logged in, and the private profile page opens without a redirect
  await page.reload();
  await page.getByTitle("Account Menu").click();
  await expect(page.getByRole("button", { name: /logout/i }).first()).toBeVisible();
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();

  expect(problems).toEqual([]);
});

test("3b. a duplicate email is rejected with a readable message", async ({ page, browser }) => {
  const { email } = await register(page);
  const other = await browser.newPage();
  await other.goto("/register");
  await other.getByPlaceholder("Full name").fill("Someone Else");
  await other.getByPlaceholder("customer@gmail.com").fill(email);
  await other.getByPlaceholder("Enter password").fill("Str0ng-Passw0rd!x");
  await other.getByRole("button", { name: /create account/i }).click();
  await expect(alertBox(other)).toContainText(/already exists/i);
  await other.close();
});

test("3c. a wrong password shows an error and does not sign in", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("customer@gmail.com").fill("admin@wearright.local");
  await page.getByPlaceholder("Enter password").fill("definitely-wrong");
  await page.getByRole("button", { name: /^login$/i }).last().click();
  await expect(alertBox(page)).toContainText(/incorrect email or password/i);
  await expect(page).toHaveURL(/\/login$/);
});
