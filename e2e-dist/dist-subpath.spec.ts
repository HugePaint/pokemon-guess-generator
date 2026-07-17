import { expect, test } from "@playwright/test";

test("loads the production build from a repository-like subpath", async ({
  page,
}) => {
  const failedResponses: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "宝可梦“我是谁”图片生成器" }),
  ).toBeVisible();

  const assetPaths = await page.evaluate(() =>
    performance.getEntriesByType("resource")
      .map((entry) => new URL(entry.name).pathname)
      .filter((path) => path.includes("/assets/"))
  );
  expect(assetPaths.length).toBeGreaterThan(0);
  expect(assetPaths.every((path) =>
    path.startsWith("/pokemon-guess-generator/assets/")
  )).toBe(true);
  expect(failedResponses).toEqual([]);
});
