import { ADMIN, expect, login, test, uniqueEmail } from "./fixtures";

test("11a. signup asks for the password twice and rejects a mismatch before sending anything", async ({ page, nativeDialogs }) => {
  const sent: string[] = [];
  page.on("request", (request) => request.url().includes("/api/auth/register/") && sent.push(request.url()));
  await page.goto("/register");
  await page.getByPlaceholder("Full name").fill("Test Shopper");
  await page.getByPlaceholder("customer@gmail.com").fill(uniqueEmail("signup"));
  await page.getByPlaceholder(/choose a password/i).fill("Duck@123");
  await page.getByLabel(/confirm password/i).fill("Duck@124");
  await expect(page.getByText("The passwords do not match yet.")).toBeVisible();

  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: /do not match/i })).toBeVisible();
  expect(sent).toEqual([]);
  expect(nativeDialogs).toEqual([]);
});

test("11b. a short password is explained, and a simple 6+ character password is accepted", async ({ page }) => {
  await page.goto("/register");
  await page.getByPlaceholder("Full name").fill("Test Shopper");
  const email = uniqueEmail("simple");
  await page.getByPlaceholder("customer@gmail.com").fill(email);
  await page.getByPlaceholder(/choose a password/i).fill("abc");
  await page.getByLabel(/confirm password/i).fill("abc");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: /at least 6 characters/i })).toBeVisible();

  await page.getByPlaceholder(/choose a password/i).fill("123456");
  await page.getByLabel(/confirm password/i).fill("123456");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).not.toHaveURL(/\/register/, { timeout: 20_000 });
  await expect(page.getByTitle("Account Menu")).toBeVisible();
});

test("11c. basic actions show a toast, not a native alert", async ({ page, nativeDialogs, dialogs }) => {
  await page.goto("/shop");
  await page.getByRole("button", { name: /Men Shirt/ }).first().click();
  await page.getByRole("button", { name: /add to cart/i }).first().click();

  const toast = page.getByTestId("toast").first();
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(/added to cart/i);
  await expect(toast).toHaveAttribute("data-kind", "success");
  expect(nativeDialogs).toEqual([]);
  await expect.poll(() => dialogs.length).toBeGreaterThan(0);
  await expect(page.getByTestId("toast")).toHaveCount(0, { timeout: 8_000 });   // it goes away by itself
});

test("11d. the shop's categories come from the server: women's, regional and unisex ones included", async ({ page, request }) => {
  const { categories } = await (await request.get("/api/categories/")).json();
  const shown = categories.filter((c: { product_count: number }) => c.product_count > 0);
  expect(shown.length).toBeGreaterThan(11); // more than the old fixed list of 11

  await page.goto("/shop?gender=Women");
  await expect(page.getByRole("button", { name: /Women Kurta/ }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Regional").first()).toBeVisible();
  const women = shown.filter((c: { gender: string }) => c.gender === "women" || c.gender === "unisex");
  await expect(page.locator("button:has(h2)")).toHaveCount(women.length);

  await page.goto("/shop?gender=Men");
  await expect(page.getByRole("button", { name: /Men Shirt/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Women Kurta/ })).toHaveCount(0);
});

test("11e. products have different photos, not one placeholder", async ({ request }) => {
  const { products } = await (await request.get("/api/products/")).json();
  const images = new Set(products.map((p: { image: string | null }) => p.image).filter(Boolean));
  expect(images.size).toBeGreaterThan(20);
  for (const url of [...images].slice(0, 6)) expect((await request.get(url as string)).status()).toBe(200);
});

test("11f. staff can add and remove a category and a style from the admin screen", async ({ page, request }) => {
  const name = `E2E Category ${Date.now()}`;
  const styleName = `E2E Style ${Date.now()}`;
  await login(page, ADMIN.email, ADMIN.password, "/admin");
  await page.getByRole("button", { name: "Categories & Styles" }).click();
  const taxonomy = page.getByTestId("admin-taxonomy");
  await expect(taxonomy).toBeVisible();

  await taxonomy.getByLabel("New category name").fill(name);
  await taxonomy.getByRole("button", { name: "Add" }).first().click();
  await expect(taxonomy.getByTestId("category-row").filter({ hasText: name })).toBeVisible();
  await taxonomy.getByLabel("New style name").fill(styleName);
  await taxonomy.getByRole("button", { name: "Add" }).last().click();
  await expect(taxonomy.getByTestId("style-row").filter({ hasText: styleName })).toBeVisible();

  const stylesNow = await (await request.get("/api/styles/")).json();
  expect(stylesNow.styles.map((s: { name: string }) => s.name)).toContain(styleName);

  page.once("dialog", (dialog) => dialog.accept());
  await taxonomy.getByTestId("category-row").filter({ hasText: name }).getByTitle("Delete").click();
  await expect(taxonomy.getByTestId("category-row").filter({ hasText: name })).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await taxonomy.getByTestId("style-row").filter({ hasText: styleName }).getByTitle("Delete").click();
  await expect(taxonomy.getByTestId("style-row").filter({ hasText: styleName })).toHaveCount(0);
});

test("11g. the shop's outfit preview is the real mannequin, not the grey placeholder", async ({ page, request, problems }) => {
  const { products } = await (await request.get("/api/products/")).json();
  const shirt = products.find((p: { slot: string; mannequin_ready: boolean; stock_quantity: number; gender: string }) => p.slot === "top" && p.gender === "men" && p.mannequin_ready && p.stock_quantity > 0);
  test.skip(!shirt, "no mannequin-ready shirt: run `make mannequin-assets`");

  await page.goto("/shop");
  await page.getByRole("button", { name: /Men Shirt/ }).first().click();
  await page.getByRole("button", { name: /Quick View/ }).first().click();
  await page.getByRole("button", { name: /Preview Outfit/ }).first().click();

  const dialog = page.getByRole("dialog", { name: "Outfit preview" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("mannequin-panel")).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByText("Advanced AI")).toHaveCount(0);
  await expect(dialog.getByText("Your pick")).toBeVisible();
  await dialog.getByRole("button", { name: "Close preview" }).click();
  await expect(dialog).toHaveCount(0);
  expect(problems).toEqual([]);
});
