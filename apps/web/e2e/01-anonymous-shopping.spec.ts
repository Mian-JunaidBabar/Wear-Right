import { expect, test } from "./fixtures";

test("1. anonymous: home loads, seeded products show in the shop, product page opens, add to cart works", async ({
  page,
  dialogs,
  problems,
}) => {
  // Home
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /find your/i })).toBeVisible();

  // Shop grid shows seeded products (Men Shirt holds three of them)
  await page.goto("/shop");
  await page.getByRole("button", { name: /Men Shirt/ }).first().click();
  const names = ["Olive Green Tailored Blazer", "Beige Structured Blazer", "Off-White Casual Linen Shirt"];
  for (const name of names) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }

  // Product page opens
  await page.getByText("Beige Structured Blazer", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/product\/\d+$/);
  await expect(page.getByRole("heading", { name: "Beige Structured Blazer" })).toBeVisible();

  // Add to cart: feedback dialog, badge count, and the cart survives a reload (localStorage)
  const cartBadge = page.getByTitle("Cart").locator("span");
  await expect(cartBadge).toHaveText("0");
  await page.getByRole("button", { name: /add to cart/i }).first().click();
  await expect(cartBadge).toHaveText("1");
  await expect.poll(() => dialogs.some((message) => message.includes("Beige Structured Blazer added to cart"))).toBe(true);
  await expect(page.getByTestId("toast").first()).toContainText("added to cart");

  await page.reload();
  await expect(page.getByTitle("Cart").locator("span")).toHaveText("1");

  expect(problems).toEqual([]);
});
