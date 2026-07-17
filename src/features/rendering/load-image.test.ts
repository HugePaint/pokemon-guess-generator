import { describe, expect, it, vi } from "vitest";
import { loadFirstImage } from "./load-image";

class FakeImage {
  crossOrigin: string | null = null;
  onerror: ((event: Event) => void) | null = null;
  onload: (() => void) | null = null;
  private readonly onSource: (image: this, url: string) => void;

  constructor(onSource: (image: FakeImage, url: string) => void) {
    this.onSource = onSource;
  }

  set src(url: string) {
    this.onSource(this, url);
  }
}

describe("loadFirstImage", () => {
  it("tries candidates in order and assigns anonymous CORS before each source", async () => {
    const attempts: Array<{ url: string; crossOrigin: string | null }> = [];
    const createImage = () => new FakeImage((image, url) => {
      attempts.push({ url, crossOrigin: image.crossOrigin });
      queueMicrotask(() => {
        if (url === "first.png") {
          image.onerror?.(new Event("error"));
        } else {
          image.onload?.();
        }
      });
    }) as unknown as HTMLImageElement;

    const image = await loadFirstImage(["first.png", "second.png"], createImage);

    expect(image).toBeInstanceOf(FakeImage);
    expect(attempts).toEqual([
      { url: "first.png", crossOrigin: "anonymous" },
      { url: "second.png", crossOrigin: "anonymous" },
    ]);
  });

  it("waits for decode before resolving a loaded candidate", async () => {
    let resolveDecode: (() => void) | undefined;
    const image = new FakeImage(() => {}) as unknown as HTMLImageElement;
    Object.assign(image, {
      decode: vi.fn(() => new Promise<void>((resolve) => {
        resolveDecode = resolve;
      })),
    });

    const promise = loadFirstImage(["sprite.png"], () => image);
    let settled = false;
    void promise.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    resolveDecode?.();

    await expect(promise).resolves.toBe(image);
  });

  it("reports every URL when all candidates fail", async () => {
    const createImage = () => new FakeImage((image) => {
      queueMicrotask(() => image.onerror?.(new Event("error")));
    }) as unknown as HTMLImageElement;

    await expect(loadFirstImage(["a.png", "b.png"], createImage))
      .rejects.toThrow("所有图片候选均加载失败");
    await expect(loadFirstImage(["a.png", "b.png"], createImage))
      .rejects.toHaveProperty("cause", ["a.png", "b.png"]);
  });
});
