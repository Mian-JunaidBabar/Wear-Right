import path from "node:path";
import { expect, register, test, uniqueEmail } from "./fixtures";

test("12a. manual tone fallback leads to recommendations", async ({ page }) => {
  await register(page, uniqueEmail("m1-scan"));
  await page.goto("/scan");

  await page.getByRole("button", { name: /skip, pick my tone/i }).click();
  await page.getByLabel(/undertone/i).selectOption("warm");
  await page.getByRole("button", { name: /use this tone/i }).click();

  await expect(page.getByTestId("scan-palette")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /view recommended products/i }).click();
  await expect(page).toHaveURL(/\/recommended/);
  await expect(page.getByTestId("pick-reason").first()).toBeVisible({ timeout: 20_000 });
});

test("12b. a guest cart merges after registration and checks out as a server order", async ({ page, request, problems, dialogs }) => {
  const payload = await (await request.get("/api/products/?page_size=200")).json();
  const product = payload.products.find(
    (row: { stock_quantity: number; status: string }) => row.stock_quantity > 2 && row.status === "Active",
  );
  expect(product, "a seeded in-stock product").toBeTruthy();

  await page.goto(`/product/${product.id}`);
  await page.getByRole("button", { name: /add to cart/i }).first().click();
  await expect.poll(() => dialogs.join(" ")).toMatch(/added to cart/i);

  await register(page, uniqueEmail("m1-cart"));
  await page.goto("/cart");
  await expect(page.getByTestId("cart-row").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(product.name).first()).toBeVisible();

  await page.getByRole("link", { name: /checkout/i }).last().click();
  await expect(page).toHaveURL(/\/checkout/);
  await page.getByLabel(/full name/i).fill("M1 Shopper");
  await page.getByLabel(/^phone/i).fill("03001234567");
  await page.getByLabel(/delivery address/i).fill("12 Test Street, Lahore");
  await page.getByLabel(/city/i).fill("Lahore");
  await page.getByRole("button", { name: /place order/i }).click();

  await expect(page).toHaveURL(/\/order-confirmation/, { timeout: 20_000 });
  await expect(page.getByText("Order Placed Successfully", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /my orders/i }).first().click();
  await expect(page).toHaveURL(/\/my-orders/);
  await expect(page.getByText(/Order WR-/).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /view order/i }).first().click();
  await expect(page.getByTestId("order-status")).toHaveText(/Pending|Confirmed/);
  await expect(page.getByText(product.name).first()).toBeVisible();

  expect(problems).toEqual([]);
});

test("12c. a non-face upload still offers the manual picker", async ({ page }) => {
  await page.goto("/scan");
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(__dirname, "assets", "skin-patch.jpg"));
  await expect(page.getByTestId("scan-rescan-message")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /pick my tone instead/i }).click();
  await expect(page.getByLabel(/skin depth/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /use this tone/i })).toBeVisible();
});
