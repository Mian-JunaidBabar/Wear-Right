import { expect, logout, register, test } from "./fixtures";

test("4. logout, then a private route redirects to login again", async ({ page, dialogs }) => {
  await register(page);
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/profile$/);

  await logout(page);
  // The "Logged out" alert fires once the server has answered
  await expect.poll(() => dialogs.some((message) => /logged out/i.test(message))).toBe(true);

  // Cookies are gone, so the proxy sends us to login
  const names = (await page.context().cookies()).map((c) => c.name);
  expect(names).not.toContain("wr-access");
  expect(names).not.toContain("wr-refresh");

  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
});
