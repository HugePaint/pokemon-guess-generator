import { describe, expect, it } from "vitest";
import { createRandomCrop, type CropInput } from "./crop";

function sequenceRng(values: number[]): () => number {
  return () => values.shift() ?? 0.5;
}

function solidBuffer(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 3; index < data.length; index += 4) {
    data[index] = 255;
  }
  return data;
}

const squareInput: CropInput = {
  source: { width: 4, height: 4, data: solidBuffer(4, 4) },
  viewport: { x: 0, y: 0, width: 2, height: 2 },
};

describe("createRandomCrop", () => {
  it("returns a valid random candidate at 1.5 to 3 times contain scale", () => {
    const crop = createRandomCrop(squareInput, sequenceRng([0.5, 0.5, 0.5]));
    const containScale = 0.5;

    expect(crop.fallback).toBe(false);
    expect(crop.scale).toBeGreaterThanOrEqual(containScale * 1.5);
    expect(crop.scale).toBeLessThanOrEqual(containScale * 3);
  });

  it("returns a valid candidate without consuming all 20 attempts", () => {
    const values = Array(20).fill(0.5);
    const rng = sequenceRng(values);

    expect(createRandomCrop(squareInput, rng).fallback).toBe(false);
    expect(values.length).toBeGreaterThan(0);
  });

  it("falls back to a centered opaque-bounds crop after invalid candidates", () => {
    const source = {
      width: 10,
      height: 10,
      data: new Uint8ClampedArray(10 * 10 * 4),
    };
    source.data[(5 * source.width + 5) * 4 + 3] = 255;
    const input: CropInput = {
      source,
      viewport: { x: 0, y: 0, width: 10, height: 10 },
    };

    expect(createRandomCrop(input, () => 0.5)).toEqual({
      scale: 2,
      offsetX: -6,
      offsetY: -6,
      fallback: true,
    });
  });

  it("throws when the source has no visible pixels", () => {
    expect(() => createRandomCrop({
      source: {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray(16),
      },
      viewport: { x: 0, y: 0, width: 2, height: 2 },
    })).toThrow("图片不包含可见像素");
  });
});
