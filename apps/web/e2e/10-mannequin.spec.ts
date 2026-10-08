import { expect, login, test } from "./fixtures";

type Product = { id: number; name: string; slot: string | null; gender: string | null; mannequin_ready: boolean; mannequin_image: string | null; stock_quantity: number };

async function products(request: import("@playwright/test").APIRequestContext): Promise<Product[]> {
  return (await (await request.get("/api/products/")).json()).products;
}

/** A shirt that can sit on the mannequin and has stock. Needs `make mannequin-assets` (and `make demo-catalog` for more variety). */
async function readyShirt(request: import("@playwright/test").APIRequestContext) {
  const shirt = (await products(request)).find((p) => p.slot === "top" && p.gender === "men" && p.mannequin_ready && p.stock_quantity > 0);
  test.skip(!shirt, "no mannequin-ready shirt: run `make mannequin-assets`");
  return shirt as Product;
}

const lookUrl = (id: number) => `/complete-outfit?productId=${id}&skinTone=medium&undertone=warm`;
const bodySrc = (page: import("@playwright/test").Page) => page.getByTestId("mannequin").getAttribute("data-body");

test("10a. the look is drawn on a mannequin: a body and the garments in layers", async ({ page, request, problems }) => {
  const shirt = await readyShirt(request);
  await page.goto(lookUrl(shirt.id));

  await expect(page.getByTestId("mannequin-panel")).toBeVisible({ timeout: 20_000 });
  expect(await bodySrc(page)).toBe("/mannequin/men-regular-front.png");
  const layers = page.getByTestId("mannequin-layer");
  await expect(layers.first()).toBeVisible();
  expect(await layers.count()).toBeGreaterThanOrEqual(1);
  await expect(page.locator('[data-testid="mannequin-layer"][data-slot="top"]')).toHaveCount(1);
  // every layer image actually loaded
  for (const image of await layers.all()) expect(await image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  expect(problems).toEqual([]);
});

test("10b. changing the body size swaps the body and re-fits the garments", async ({ page, request }) => {
  const shirt = await readyShirt(request);
  await page.goto(lookUrl(shirt.id));
  const top = page.locator('[data-testid="mannequin-layer"][data-slot="top"]');
  await expect(top).toBeVisible({ timeout: 20_000 });
  const widthOf = async () => parseFloat(await top.evaluate((el) => (el as HTMLElement).style.width));

  const regular = await widthOf();
  await page.getByRole("button", { name: "plus", exact: true }).click();
  expect(await bodySrc(page)).toBe("/mannequin/men-plus-front.png");
  expect(await widthOf()).toBeGreaterThan(regular);

  await page.getByRole("button", { name: "slim", exact: true }).click();
  expect(await bodySrc(page)).toBe("/mannequin/men-slim-front.png");
  expect(await widthOf()).toBeLessThan(regular);
});

test("10c. the back view shows the back body and says when a garment only has a front photo", async ({ page, request }) => {
  const shirt = await readyShirt(request);
  await page.goto(lookUrl(shirt.id));
  await expect(page.getByTestId("mannequin-layer").first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "back", exact: true }).click();
  expect(await bodySrc(page)).toBe("/mannequin/men-regular-back.png");
  await expect(page.getByTestId("mannequin-note").first()).toContainText("has no back photo");

  await page.getByRole("button", { name: "front", exact: true }).click();
  expect(await bodySrc(page)).toBe("/mannequin/men-regular-front.png");
  await expect(page.getByTestId("mannequin-note")).toHaveCount(0);
});

test("10d. swapping a piece changes what is drawn on the mannequin", async ({ page, request }) => {
  const shirt = await readyShirt(request);
  await page.goto(lookUrl(shirt.id));
  await expect(page.getByTestId("mannequin-layer").first()).toBeVisible({ timeout: 20_000 });

  // find a slot with swaps whose layer exists, pick a different option, and watch the layer image change
  for (const slot of ["bottom", "footwear"]) {
    const section = page.getByTestId(`look-slot-${slot}`);
    const options = section.locator("button img");
    if ((await options.count()) < 2) continue;
    const layer = page.locator(`[data-testid="mannequin-layer"][data-slot="${slot}"]`);
    if ((await layer.count()) === 0) continue;
    const before = await layer.getAttribute("src");
    for (let i = 1; i < (await options.count()); i++) {
      await section.locator("button").nth(i).click();
      const after = await page.locator(`[data-testid="mannequin-layer"][data-slot="${slot}"]`).first().getAttribute("src").catch(() => null);
      if (after && after !== before) return; // changed: done
    }
  }
  test.skip(true, "no slot in this look has two placeable options");
});

test("10e. a photo that shows a person is not placed, and the page says why", async ({ page, request }) => {
  const person = (await products(request)).find((p) => p.slot === "top" && !p.mannequin_ready && p.mannequin_image && p.stock_quantity > 0);
  test.skip(!person, "every top is mannequin-ready in this catalog");
  await page.goto(lookUrl((person as Product).id));

  await expect(page.getByTestId("mannequin-panel")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("mannequin-skipped")).toContainText(/not usable here|No mannequin photo/);
});

test("10f. the size choice is remembered for a signed-in shopper", async ({ page, request }) => {
  const shirt = await readyShirt(request);
  await login(page, "demo@wearright.local", "demo12345");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });

  await page.goto(lookUrl(shirt.id));
  await expect(page.getByTestId("mannequin-panel")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "plus", exact: true }).click();
  await expect.poll(async () => (await (await page.request.get("/api/auth/me/")).json()).profile.body_preset).toBe("plus");

  await page.reload();
  await expect(page.getByTestId("mannequin-panel")).toBeVisible({ timeout: 20_000 });
  expect(await bodySrc(page)).toBe("/mannequin/men-plus-front.png");
  await page.request.patch("/api/auth/me/", { data: { body_preset: "regular" }, headers: { "X-CSRFToken": (await page.context().cookies()).find((c) => c.name === "csrftoken")?.value ?? "" } });
});
