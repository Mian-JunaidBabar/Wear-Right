import { ADMIN, expect, login, register, test, type Problems } from "./fixtures";
import type { Page } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/shop",
  "/shop?gender=Women",
  "/scanner",
  "/recommended",
  "/recommended?skinTone=medium",
  "/complete-outfit",
  "/wishlist",
  "/about",
  "/contact",
  "/login",
  "/register",
];
const USER_ROUTES = ["/profile", "/my-orders", "/order-confirmation"];
const ADMIN_ROUTES = ["/admin"];

async function visit(page: Page, problems: Problems, path: string, failures: string[]) {
  problems.length = 0;
  const response = await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(500); // let client-side fetches and effects settle
  if (!response || response.status() >= 400) failures.push(`${path}: page responded ${response?.status()}`);
  if ((await page.locator("main").first().innerText()).trim().length < 20) failures.push(`${path}: page body is empty`);
  for (const problem of problems) failures.push(`${path}: ${problem}`);
}

test("6a. every public route loads with no console errors and no failed requests", async ({ page, problems }) => {
  // a real seeded product page too
  const list = await (await page.request.get("/api/products/")).json();
  const productRoute = `/product/${list.products[0].id}`;

  const failures: string[] = [];
  for (const path of [...PUBLIC_ROUTES, productRoute]) await visit(page, problems, path, failures);
  expect(failures).toEqual([]);
});

test("6b. every signed-in route loads cleanly", async ({ page, problems }) => {
  await register(page);
  const failures: string[] = [];
  for (const path of USER_ROUTES) await visit(page, problems, path, failures);
  expect(failures).toEqual([]);
});

test("6c. the admin route loads cleanly for an admin", async ({ page, problems }) => {
  await login(page, ADMIN.email, ADMIN.password, "/admin");
  await page.waitForURL("**/admin");
  const failures: string[] = [];
  for (const path of ADMIN_ROUTES) await visit(page, problems, path, failures);
  expect(failures).toEqual([]);
});
