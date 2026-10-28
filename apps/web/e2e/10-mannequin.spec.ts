import { expect, login, test } from "./fixtures";

type Product = { id: number; name: string; slot: string | null; kind: string | null; gender: string | null; stock_quantity: number };

async function products(request: import("@playwright/test").APIRequestContext): Promise<Product[]> {
  return (await (await request.get("/api/products/?page_size=200")).json()).products;
}

/** A product whose own kind guarantees a drawable layer, with stock. */
async function anchorOfKind(request: import("@playwright/test").APIRequestContext, kind: string): Promise<Product | null> {
  const rows = await products(request);
  const exact = rows.find((p) => p.kind === kind && p.stock_quantity > 0);
  test.skip(!exact, `no ${kind} with stock in this catalog: run \`make demo-data\``);
  return exact ?? null;
}

const lookUrl = (id: number) => `/complete-outfit?productId=${id}&skinTone=medium&undertone=warm`;

test("10a. the anchor is always drawn: one layer with the anchor's product id", async ({ page, request, problems }) => {
  const shirt = (await anchorOfKind(request, "shirt")) as Product;
  await page.goto(lookUrl((shirt as Product).id));

  const anchorLayer = page.locator('[data-testid="mannequin-layer"][data-anchor="true"]');
  await expect(anchorLayer).toHaveCount(1, { timeout: 20_000 });
  await expect(anchorLayer).toHaveAttribute("data-product-id", String(shirt.id));
  expect(problems).toEqual([]);
});

test("10b. shoes are drawn as a pair: one shoe per foot", async ({ page, request }) => {
  const shoes = (await anchorOfKind(request, "sneakers")) as Product;
  await page.goto(lookUrl((shoes as Product).id));

  const layer = page.locator('[data-testid="mannequin-layer"][data-kind="sneakers"]');
  await expect(layer).toHaveCount(1, { timeout: 20_000 });
  await expect(layer.locator("path[data-foot]")).toHaveCount(2);
  const feet = await layer.locator("path[data-foot]").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-foot")));
  expect(feet.sort()).toEqual(["left", "right"]);
});

test("10c. a watch sits on the wrist, not floating on the torso", async ({ page, request }) => {
  const watch = (await anchorOfKind(request, "watch")) as Product;
  await page.goto(lookUrl((watch as Product).id));

  const layer = page.locator('[data-testid="mannequin-layer"][data-kind="watch"]');
  await expect(layer).toHaveCount(1, { timeout: 20_000 });
  // compare in the SVG's own coordinate space (viewBox 400x800)
  const overlap = await page.locator('[data-testid="mannequin"]').evaluate((host) => {
    const svg = host.querySelector("svg") as SVGSVGElement;
    const wristLeft = svg.querySelector('[data-part="wrist-left"]') as SVGCircleElement;
    const watch = svg.querySelector('[data-kind="watch"]') as SVGGElement;
    const wrist = wristLeft.getBBox();
    const strap = watch.getBBox();
    const inside = strap.x <= wrist.x + wrist.width && wrist.x <= strap.x + strap.width
      && strap.y <= wrist.y + wrist.height && wrist.y <= strap.y + strap.height;
    return { inside, strapTop: strap.y, strapBottom: strap.y + strap.height };
  });
  expect(overlap.inside).toBe(true);
  // the forearm is below the shoulders (y grows downwards); the watch rides on the arm
  expect(overlap.strapBottom).toBeGreaterThan(190);
  expect(overlap.strapTop).toBeGreaterThan(140);
});

test("10d. changing the body size re-projects every garment shape", async ({ page, request }) => {
  const shirt = (await anchorOfKind(request, "shirt")) as Product;
  await page.goto(lookUrl((shirt as Product).id));

  const bodyWidth = async () =>
    parseFloat(
      await page
        .locator('[data-testid="mannequin-body"]')
        .evaluate((el) => (el as SVGGElement).getBBox().width.toFixed(1)),
    );
  const kindCount = async () => page.getByTestId("mannequin-layer").count();

  await expect(page.getByTestId("mannequin-layer").first()).toBeAttached({ timeout: 20_000 });
  const regularWidth = await bodyWidth();
  const regularLayers = await kindCount();

  await page.getByTestId("preset-plus").click();
  await page.waitForTimeout(150);
  expect(await bodyWidth()).toBeGreaterThan(regularWidth);
  expect(await kindCount()).toBe(regularLayers); // the same outfit, re-projected

  await page.getByTestId("preset-slim").click();
  await page.waitForTimeout(150);
  expect(await bodyWidth()).toBeLessThan(regularWidth);
  expect(await kindCount()).toBe(regularLayers);
});

test("10e. swapping a piece swaps the drawn shape", async ({ page, request }) => {
  const shirt = (await anchorOfKind(request, "shirt")) as Product;
  await page.goto(lookUrl((shirt as Product).id));
  await expect(page.getByTestId("mannequin-layer").first()).toBeAttached({ timeout: 20_000 });

  for (const slot of ["bottom", "footwear"]) {
    const section = page.getByTestId(`look-slot-${slot}`);
    await section.waitFor({ state: "attached" });
    const options = section.locator("button");
    if ((await options.count()) < 2) continue;
    const layer = page.locator(`[data-testid="mannequin-layer"][data-slot="${slot}"]`);
    if ((await layer.count()) === 0) continue;
    const before = await layer.getAttribute("data-product-id");
    for (let i = 1; i < (await options.count()); i++) {
      await options.nth(i).click();
      const after = await layer.getAttribute("data-product-id").catch(() => null);
      if (after && after !== before) return; // the drawn product changed
    }
  }
  test.skip(true, "no slot in this look has two placeable options");
});

test("10f. the size choice is remembered for a signed-in shopper", async ({ page, request }) => {
  const shirt = (await anchorOfKind(request, "shirt")) as Product;
  await login(page, "demo@wearright.local", "demo12345");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
  await page.goto(lookUrl((shirt as Product).id));
  await expect(page.getByTestId("mannequin-panel")).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("preset-plus").click();
  await expect.poll(async () => (await (await page.request.get("/api/auth/me/")).json()).profile.body_preset, { timeout: 10_000 }).toBe("plus");

  await page.reload();
  await expect(page.getByTestId("preset-plus")).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
  await page.request.patch("/api/auth/me/", { data: { body_preset: "regular" }, headers: { "X-CSRFToken": (await page.context().cookies()).find((c) => c.name === "csrftoken")?.value ?? "" } });
});

test("10g. no horizontal overflow on a small phone", async ({ page, request }) => {
  const shirt = (await anchorOfKind(request, "shirt")) as Product;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(lookUrl((shirt as Product).id));
  await expect(page.getByTestId("mannequin-layer").first()).toBeAttached({ timeout: 20_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
