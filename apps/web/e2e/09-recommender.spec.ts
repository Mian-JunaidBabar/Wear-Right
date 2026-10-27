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
  const products = await (await request.get("/api/products/?page_size=200&search=Off-White%20Casual%20Linen%20Shirt")).json();
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
  await expect.poll(() => dialogs.join(" ")).toMatch(/whole look/i);
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

test("9f. a shirt anchor covers the top slot: no phantom Top row and never a kids piece", async ({ page, request }) => {
  // "Heavy Shirt" is the mislabelled import row (legacy garment_type "Accessory"); the server
  // classifies it from its words (kind=shirt, slot=top), so the look must not re-complement the
  // top slot — and a kids tee must never fill any slot of an adult look.
  const products = await (await request.get("/api/products/?page_size=500&search=Heavy%20Shirt")).json();
  const shirt = products.products.find((p: { name: string }) => p.name.startsWith("Heavy Shirt"));
  expect(shirt, "the mislabelled seeded shirt").toBeTruthy();

  const apiLook = await (await request.get(`/api/looks/complete/?product_id=${shirt.id}`)).json();
  expect(apiLook.anchor_kind).toBe("shirt");
  expect(apiLook.anchor_slot).toBe("top");
  expect(apiLook.slots.map((s: { slot: string }) => s.slot)).not.toContain("top");
  for (const slot of apiLook.slots) {
    const pieces = [slot.pick, ...slot.swaps].filter(Boolean) as Array<{ name: string }>;
    for (const piece of pieces) expect(piece.name).not.toMatch(/kids?\b|kidswear/i);
  }

  await page.goto(`/complete-outfit?productId=${shirt.id}&skinTone=medium&undertone=warm`);
  await expect(page.getByRole("heading", { name: /look/i }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("look-slot-bottom")).toBeVisible();
  await expect(page.getByTestId("look-slot-top")).toHaveCount(0);
});
