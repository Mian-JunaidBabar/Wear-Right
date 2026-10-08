import fs from "node:fs";
import path from "node:path";
import { expect, test } from "./fixtures";

// The real face photo is a MediaPipe test asset fetched by `make models` (kept out of git).
const PORTRAIT = path.join(__dirname, "..", "..", "server", "ml_models", "test_assets", "portrait.jpg");

test("8a. a real face goes through the real model: depth, undertone and Monk are shown", async ({ page, problems }) => {
  test.skip(!fs.existsSync(PORTRAIT), "run `make models` to fetch the test portrait");
  await page.goto("/scanner");
  await page.locator('input[type="file"]').setInputFiles(PORTRAIT);

  await expect(page.getByText("Scan Successful")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Your Skin Tone/)).toBeVisible();
  await expect(page.getByTestId("scan-detail")).toHaveText(/(Warm|Cool|Neutral) undertone · Monk (10|[1-9])$/);
  await expect(page.getByTestId("undertone-override")).toBeVisible();
  expect(problems).toEqual([]);
});

test("8b. answering the two questions changes the undertone shown", async ({ page }) => {
  test.skip(!fs.existsSync(PORTRAIT), "run `make models` to fetch the test portrait");
  await page.goto("/scanner");
  await page.locator('input[type="file"]').setInputFiles(PORTRAIT);
  await expect(page.getByText("Scan Successful")).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "silver" }).click();
  await page.getByRole("button", { name: "burn" }).click();
  await expect(page.getByTestId("scan-detail")).toContainText("Cool undertone");

  await page.getByRole("button", { name: "gold" }).click();
  // gold points warm, burn points cool: the answers disagree, so the undertone is neutral
  await expect(page.getByTestId("scan-detail")).toContainText("Neutral undertone");
});

test("8c. an image without a face is a clear rescan, not a success", async ({ page }) => {
  await page.goto("/scanner");
  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "assets", "skin-patch.jpg"));

  await expect(page.getByText("Rescan Needed")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Scan Successful")).toHaveCount(0);
  await expect(page.getByTestId("scan-rescan-message")).toContainText(/face/i);
});
