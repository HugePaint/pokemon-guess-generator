import { describe, expect, it, vi } from "vitest";
import { manifestFixture } from "../../test/fixtures/pokemon-manifest";
import { exportJpeg } from "./export-jpeg";

const bulbasaur = manifestFixture.species[0];
const pikachu = manifestFixture.species[1];

describe("exportJpeg", () => {
  it("exports a 0.92 JPEG with a stable filename", async () => {
    const toBlob = vi.fn((callback: BlobCallback, type?: string, quality?: number) => {
      callback(new Blob(["jpeg"], { type: "image/jpeg" }));
      expect(type).toBe("image/jpeg");
      expect(quality).toBe(0.92);
    });
    const canvas = { toBlob } as unknown as HTMLCanvasElement;

    const file = await exportJpeg(canvas, bulbasaur, bulbasaur.forms[0], "question");

    expect(file.filename).toBe("0001-bulbasaur-question.jpg");
    expect(file.blob.type).toBe("image/jpeg");
  });

  it("sanitizes slugs and appends only non-default form slugs", async () => {
    const canvas = {
      toBlob(callback: BlobCallback) {
        callback(new Blob(["jpeg"], { type: "image/jpeg" }));
      },
    } as unknown as HTMLCanvasElement;
    const species = { ...pikachu, slug: "Pika Chu!!" };
    const form = { ...pikachu.forms[1], slug: "Rock Star_♀" };

    const file = await exportJpeg(canvas, species, form, "answer");

    expect(file.filename).toBe("0025-pika-chu-rock-star-answer.jpg");
  });

  it("rejects when Canvas does not produce a blob", async () => {
    const canvas = {
      toBlob(callback: BlobCallback) {
        callback(null);
      },
    } as unknown as HTMLCanvasElement;

    await expect(exportJpeg(
      canvas,
      bulbasaur,
      bulbasaur.forms[0],
      "question",
    )).rejects.toThrow("JPG 导出失败");
  });
});
