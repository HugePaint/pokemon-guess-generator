import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import { manifestFixture } from "../src/test/fixtures/pokemon-manifest";

const SPRITE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path fill="#ffd400" d="M40 170V70L20 20l55 35a65 65 0 1 1-35 115Z"/>
  <circle cx="80" cy="95" r="8" fill="#111"/>
</svg>`;

const CONTENT_RECT = { x: 70, y: 75, width: 320, height: 380 } as const;
const TRANSPARENT_SPRITE_CORNER = { x: 71, y: 106 } as const;
const ANSWER_RECT = { x: 520, y: 100, width: 400, height: 230 } as const;
const ANSWER_PANEL_POINTS = [
  { x: ANSWER_RECT.x + 12, y: ANSWER_RECT.y + 12 },
  { x: ANSWER_RECT.x + ANSWER_RECT.width - 13, y: ANSWER_RECT.y + 12 },
  { x: ANSWER_RECT.x + 12, y: ANSWER_RECT.y + ANSWER_RECT.height - 13 },
  {
    x: ANSWER_RECT.x + ANSWER_RECT.width - 13,
    y: ANSWER_RECT.y + ANSWER_RECT.height - 13,
  },
] as const;
const ANSWER_PANEL_RGBA = [54, 92, 129, 255] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.route("**/data/pokemon.json", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(manifestFixture),
    });
  });
  await page.route("**/sprites/**", async (route) => {
    await route.fulfill({
      contentType: "image/svg+xml",
      headers: { "access-control-allow-origin": "*" },
      body: SPRITE_SVG,
    });
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "宝可梦“我是谁”图片生成器" }),
  ).toBeVisible();
});

test("searches a form and random selection changes the displayed Pokémon", async ({
  page,
}) => {
  await selectPikachu(page);

  const form = page.getByLabel("形态");
  await expect(form).toBeVisible();
  await form.selectOption("pikachu-rock-star");
  await expect(form).toHaveValue("pikachu-rock-star");
  await expect(page.getByText("图片已准备好", { exact: true })).toBeVisible();

  const species = page.getByLabel("宝可梦", { exact: true });
  await expect(species).toHaveValue("pikachu");
  await page.getByRole("button", { name: "随机选择" }).click();
  await expect(species).toHaveValue("bulbasaur");
  await expect(page.getByText("图片已准备好", { exact: true })).toBeVisible();
});

test("renders both modes, preserves canvas size, and renders the answer", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await selectPikachu(page);

  const canvas = page.getByRole("img", { name: "生成图片预览" });
  await expect(canvas).toHaveAttribute("width", "1024");
  await expect(canvas).toHaveAttribute("height", "768");

  const silhouette = await readCanvasEvidence(page);
  expect(silhouette.blackPixels).toBeGreaterThan(500);
  expect(silhouette.transparentSpriteCornerPixel[3]).toBe(255);
  expect(
    silhouette.transparentSpriteCornerPixel.slice(0, 3).some(
      (channel) => channel >= 20,
    ),
  ).toBe(true);
  expect(silhouette.blackPixels).toBeLessThan(
    CONTENT_RECT.width * CONTENT_RECT.height / 2,
  );

  await page.getByRole("radio", { name: "区域裁剪" }).click();
  const zoom = page.getByRole("slider", { name: "缩放", exact: true });
  await expect(zoom).toBeVisible();
  await expect.poll(() => readCanvasEvidence(page))
    .toMatchObject({ canvasWidth: 1024, canvasHeight: 768 });
  const crop = await readCanvasEvidence(page);
  expect(crop.spriteYellowPixels).toBeGreaterThan(100);

  const beforeZoom = await canvasHash(page);
  await zoom.fill("2.5");
  await expect(page.getByLabel("当前缩放")).toHaveText("2.5×");
  await expect.poll(() => canvasHash(page)).not.toBe(beforeZoom);

  const beforeDrag = await canvasHash(page);
  await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement;
    target.setPointerCapture = () => undefined;
    target.releasePointerCapture = () => undefined;
    target.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      pointerType: "touch",
    }));
    const move = new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: 1,
      pointerType: "touch",
    });
    Object.defineProperties(move, {
      movementX: { value: 35 },
      movementY: { value: 20 },
    });
    target.dispatchEvent(move);
    target.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 1,
      pointerType: "touch",
    }));
  });
  await expect.poll(() => canvasHash(page)).not.toBe(beforeDrag);
  await expect(canvas).toHaveAttribute("width", "1024");
  await expect(canvas).toHaveAttribute("height", "768");

  await page.getByRole("tab", { name: "答案预览" }).click();
  await expect(
    page.getByRole("tab", { name: "答案预览" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect.poll(async () => (
    await readCanvasEvidence(page)
  ).answerPanelPointPixels).toEqual(
    ANSWER_PANEL_POINTS.map(() => [...ANSWER_PANEL_RGBA]),
  );
  await expect.poll(async () => (
    await readCanvasEvidence(page)
  ).answerTextYellowPixels).toBeGreaterThan(20);
  const answer = await readCanvasEvidence(page);
  expect(answer.spriteYellowPixels).toBeGreaterThan(100);
  expect(pageErrors).toEqual([]);
});

test("downloads question and answer as JPEG files", async ({ page }) => {
  await selectPikachu(page);

  await expectJpegDownload(page, "下载题面", /-question\.jpg$/);
  await expectJpegDownload(page, "下载答案", /-answer\.jpg$/);
});

async function selectPikachu(page: Page): Promise<void> {
  await page.getByLabel("搜索宝可梦").fill("皮卡丘");
  await page
    .getByRole("listbox", { name: "搜索结果" })
    .getByRole("option", { name: /皮卡丘 \/ Pikachu/ })
    .click();
  await expect(page.getByLabel("宝可梦", { exact: true })).toHaveValue("pikachu");
  await expect(page.getByText("图片已准备好", { exact: true })).toBeVisible();
}

async function expectJpegDownload(
  page: Page,
  buttonName: string,
  filename: RegExp,
): Promise<void> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: buttonName }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(filename);
  expect(await readMagicBytes(download)).toEqual([0xff, 0xd8, 0xff]);
}

async function readMagicBytes(download: Download): Promise<number[]> {
  const path = await download.path();
  if (path === null) {
    throw new Error("Playwright did not expose the downloaded file");
  }
  const bytes = await readFile(path);
  return [...bytes.subarray(0, 3)];
}

async function readCanvasEvidence(page: Page) {
  return page.getByRole("img", { name: "生成图片预览" }).evaluate(
    (element, rects) => {
      const canvas = element as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (context === null) {
        throw new Error("Canvas 2D context is unavailable");
      }
      const content = context.getImageData(
        rects.content.x,
        rects.content.y,
        rects.content.width,
        rects.content.height,
      ).data;
      const answer = context.getImageData(
        rects.answer.x,
        rects.answer.y,
        rects.answer.width,
        rects.answer.height,
      ).data;

      return {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        blackPixels: countPixels(content, (red, green, blue, alpha) => (
          alpha > 0 && red < 20 && green < 20 && blue < 20
        )),
        spriteYellowPixels: countPixels(
          content,
          (red, green, blue, alpha) => (
            alpha > 0 && red > 245 && green >= 195 && green <= 225 && blue < 15
          ),
        ),
        answerTextYellowPixels: countPixels(
          answer,
          (red, green, blue, alpha) => (
            alpha > 0 && red > 245 && green > 230 && blue < 20
          ),
        ),
        answerPanelPointPixels: rects.answerPanelPoints.map(({ x, y }) => (
          Array.from(context.getImageData(x, y, 1, 1).data)
        )),
        transparentSpriteCornerPixel: Array.from(context.getImageData(
          rects.transparentSpriteCorner.x,
          rects.transparentSpriteCorner.y,
          1,
          1,
        ).data),
      };

      function countPixels(
        pixels: Uint8ClampedArray,
        predicate: (
          red: number,
          green: number,
          blue: number,
          alpha: number,
        ) => boolean,
      ): number {
        let count = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (predicate(
            pixels[index] ?? 0,
            pixels[index + 1] ?? 0,
            pixels[index + 2] ?? 0,
            pixels[index + 3] ?? 0,
          )) {
            count += 1;
          }
        }
        return count;
      }
    },
    {
      content: CONTENT_RECT,
      answer: ANSWER_RECT,
      answerPanelPoints: ANSWER_PANEL_POINTS,
      transparentSpriteCorner: TRANSPARENT_SPRITE_CORNER,
    },
  );
}

async function canvasHash(page: Page): Promise<number> {
  return page.getByRole("img", { name: "生成图片预览" }).evaluate(
    (element, rect) => {
      const canvas = element as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (context === null) {
        throw new Error("Canvas 2D context is unavailable");
      }
      const pixels = context.getImageData(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
      ).data;
      let hash = 2_166_136_261;
      for (let index = 0; index < pixels.length; index += 4) {
        hash ^= (
          (pixels[index] ?? 0)
          | ((pixels[index + 1] ?? 0) << 8)
          | ((pixels[index + 2] ?? 0) << 16)
          | ((pixels[index + 3] ?? 0) << 24)
        );
        hash = Math.imul(hash, 16_777_619);
      }
      return hash >>> 0;
    },
    CONTENT_RECT,
  );
}
