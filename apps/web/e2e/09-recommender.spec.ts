import fs from "node:fs";
import path from "node:path";
import { expect, test } from "./fixtures";

const PORTRAIT = path.join(__dirname, "..", "..", "server", "ml_models", "test_assets", "portrait.jpg");

test("9a. recommended page: ranked picks come from the server, each with a reason, and the palette is shown", async ({ page, problems }) => {
  await page.goto("/recommended?skinTone=medium&undertone=warm");

  await expect(page.getByRole("heading", { name: "Your best colours", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Colours to avoid", exact: true })).toBeVisible();
  const reasons = page.getByTestId("pick-reason");
  await expect(reasons.first()).toBeVisible({ timeout: 20_000 });
  expect(await reasons.count()).toBeGreaterThan(0);
  await expect(reasons.first()).toContainText(/colour|colours|neutral/i);
  expect(problems).toEqual([]);
});

test("9b. a different undertone changes the palette shown", async ({ page }) => {
  await page.goto("/recommended?skinTone=medium&undertone=warm");
  await expect(page.getByTestId("pick-reason").first()).toBeVisible({ timeout: 20_000 });
  const warm = await page.getByRole("heading", { name: "Your best colours", exact: true }).locator("xpath=../..").innerText();

  await page.goto("/recommended?skinTone=medium&undertone=cool");
  await expect(page.getByTestId("pick-reason").first()).toBeVisible({ timeout: 20_000 });
  const cool = await page.getByRole("heading", { name: "Your best colours", exact: true }).locator("xpath=../..").innerText();

  expect(warm).not.toEqual(cool);
});

test("9c. complete the look: a pick per slot, swaps, a total, and the whole look goes to the cart", async ({ page, request, dialogs, problems }) => {
  const products = await (await request.get("/api/products/")).json();
  const shirt = products.products.find((p: { name: string }) => p.name === "Off-White Casual Linen Shirt");
  expect(shirt, "the seeded demo shirt").toBeTruthy();

  await page.goto(`/complete-outfit?productId=${shirt.id}&skinTone=medium&undertone=warm`);

  await expect(page.getByRole("heading", { name: /look/i }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Your pick")).toBeVisible();
  await expect(page.getByText("Off-White Casual Linen Shirt").first()).toBeVisible();
  await expect(page.getByTestId("look-slot-bottom")).toBeVisible();
  await expect(page.getByTestId("look-slot-footwear")).toBeVisible();
  const before = await page.getByTestId("look-total").innerText();
  expect(before).toMatch(/Rs\. [\d,]+/);

  await page.getByRole("button", { name: /add whole look to cart/i }).click();
  expect(dialogs.join(" ")).toMatch(/whole look/i);
  expect(problems).toEqual([]);
});

test("9d. with no product selected the outfit page says what to do", async ({ page }) => {
  await page.goto("/complete-outfit?skinTone=medium");
  await expect(page.getByText("No product selected")).toBeVisible();
});

test("9e. the scan result card shows the palette from the server's tone rules", async ({ page }) => {
  test.skip(!fs.existsSync(PORTRAIT), "run `make models` to fetch the test portrait");
  await page.goto("/scanner");
  await page.locator('input[type="file"]').setInputFiles(PORTRAIT);

  await expect(page.getByText("Scan Successful")).toBeVisible({ timeout: 60_000 });
  const palette = page.getByTestId("scan-palette");
  await expect(palette).toBeVisible();
  await expect(palette.locator("div[title]").first()).toBeVisible({ timeout: 15_000 });
  expect(await palette.locator("div[title]").count()).toBeGreaterThanOrEqual(4);
  await expect(palette).toContainText("Skip:");
});
