import { describe, expect, it } from "vitest";
import {
  createOpaquePixelMap,
  createRandomCrop,
  isCropValid,
  measureCropMetrics,
  type CropInput,
} from "./crop";
import type { CropTransform, PixelBuffer, Rect } from "./types";

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
  it("returns a valid random candidate at 1.5 to 6 times contain scale", () => {
    const crop = createRandomCrop(squareInput, sequenceRng([1, 0.5, 0.5]));
    const containScale = 0.5;

    expect(crop.fallback).toBe(false);
    expect(crop.scale).toBe(containScale * 6);
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

  it("accepts a crop whose opaque bounds contain transparent holes", () => {
    const data = solidBuffer(4, 4);
    data[(1 * 4 + 1) * 4 + 3] = 0;
    const input: CropInput = {
      source: { width: 4, height: 4, data },
      viewport: { x: 0, y: 0, width: 2, height: 2 },
    };

    expect(isCropValid(input, {
      scale: 1,
      offsetX: -1,
      offsetY: -1,
      fallback: false,
    })).toBe(true);
  });

  it("rejects blank, over-revealing, and out-of-range crops", () => {
    expect(isCropValid(squareInput, {
      scale: 1,
      offsetX: 100,
      offsetY: 100,
      fallback: false,
    })).toBe(false);
    expect(isCropValid(squareInput, {
      scale: 0.5,
      offsetX: 0,
      offsetY: 0,
      fallback: false,
    })).toBe(false);
    expect(isCropValid(squareInput, {
      scale: 3,
      offsetX: -5,
      offsetY: -5,
      fallback: false,
    })).toBe(true);
    expect(isCropValid(squareInput, {
      scale: 3.1,
      offsetX: -5,
      offsetY: -5,
      fallback: false,
    })).toBe(false);
    const sparseData = new Uint8ClampedArray(4 * 4 * 4);
    sparseData[3] = 255;
    expect(isCropValid({
      source: { width: 4, height: 4, data: sparseData },
      viewport: squareInput.viewport,
    }, {
      scale: 1.5,
      offsetX: 0,
      offsetY: 0,
      fallback: false,
    })).toBe(false);
  });

  it("matches the full alpha scan across varied transforms", () => {
    const source = patternedBuffer(13, 11);
    const viewport = { x: 70, y: 75, width: 320, height: 380 };
    const opaqueMap = createOpaquePixelMap(source);
    expect(opaqueMap).not.toBeNull();

    for (let index = 0; index < 40; index += 1) {
      const containScale = Math.min(
        viewport.width / source.width,
        viewport.height / source.height,
      );
      const transform: CropTransform = {
        scale: containScale * (1.5 + (index % 16) / 10),
        offsetX: -180 + index * 17.25,
        offsetY: -130 + index * 11.5,
        fallback: false,
      };
      const cached = measureCropMetrics({
        source,
        viewport,
        opaqueMap,
      }, transform);
      const scanned = scanCropMetrics(source, viewport, transform);

      expect(cached.contentCoverage).toBeCloseTo(scanned.contentCoverage, 12);
      expect(cached.sourceVisibleRatio).toBeCloseTo(
        scanned.sourceVisibleRatio,
        12,
      );
    }
  });

  it("reuses a prepared opaque map without reading the alpha buffer again", () => {
    const source = {
      width: 4,
      height: 4,
      data: solidBuffer(4, 4),
    };
    const opaqueMap = createOpaquePixelMap(source);
    expect(opaqueMap).not.toBeNull();
    const input = {
      source,
      viewport: squareInput.viewport,
      opaqueMap,
    };
    const transform = {
      scale: 1,
      offsetX: -1,
      offsetY: -1,
      fallback: false,
    };
    const before = measureCropMetrics(input, transform);

    source.data.fill(0);

    expect(measureCropMetrics(input, transform)).toEqual(before);
  });
});

function patternedBuffer(width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x * 7 + y * 11) % 5 !== 0) {
        data[(y * width + x) * 4 + 3] = 255;
      }
    }
  }
  return { width, height, data };
}

function scanCropMetrics(
  source: PixelBuffer,
  viewport: Rect,
  transform: CropTransform,
) {
  let visibleArea = 0;
  let opaquePixels = 0;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (source.data[(y * source.width + x) * 4 + 3] === 0) {
        continue;
      }
      opaquePixels += 1;
      const left = Math.max(x * transform.scale + transform.offsetX, viewport.x);
      const right = Math.min(
        (x + 1) * transform.scale + transform.offsetX,
        viewport.x + viewport.width,
      );
      const top = Math.max(y * transform.scale + transform.offsetY, viewport.y);
      const bottom = Math.min(
        (y + 1) * transform.scale + transform.offsetY,
        viewport.y + viewport.height,
      );
      visibleArea += Math.max(0, right - left) * Math.max(0, bottom - top);
    }
  }
  return {
    contentCoverage: visibleArea / (viewport.width * viewport.height),
    sourceVisibleRatio: visibleArea
      / (opaquePixels * transform.scale * transform.scale),
  };
}
