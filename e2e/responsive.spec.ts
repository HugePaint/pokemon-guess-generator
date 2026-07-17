import { expect, test, type Page } from "@playwright/test";
import { manifestFixture } from "../src/test/fixtures/pokemon-manifest";

test.beforeEach(async ({ page }) => {
  await page.route("**/data/pokemon.json", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(manifestFixture),
    });
  });
});

test("places controls left of the preview at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const { controls, preview } = await panelBounds(page);
  expect(controls.x + controls.width).toBeLessThanOrEqual(preview.x);
});

test("places controls above the preview at 412px", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/");

  const { controls, preview } = await panelBounds(page);
  expect(controls.y + controls.height).toBeLessThanOrEqual(preview.y);
});

async function panelBounds(page: Page) {
  const controls = await page
    .getByRole("region", { name: "生成设置" })
    .boundingBox();
  const preview = await page
    .getByRole("region", { name: "图片预览" })
    .boundingBox();

  expect(controls).not.toBeNull();
  expect(preview).not.toBeNull();
  if (controls === null || preview === null) {
    throw new Error("Responsive panels do not have layout bounds");
  }
  return { controls, preview };
}
