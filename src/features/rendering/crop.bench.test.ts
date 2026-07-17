import { describe, expect, it } from "vitest";
import {
  createOpaquePixelMap,
  measureCropMetrics,
  type CropMetrics,
} from "./crop";
import type { CropTransform, PixelBuffer, Rect } from "./types";

describe("crop validation benchmark", () => {
  it("materially reduces 512x512 validation work relative to a full scan", () => {
    const source = solidBuffer(512, 512);
    const viewport = { x: 70, y: 75, width: 320, height: 380 };
    const transform = {
      scale: 1.25,
      offsetX: -90,
      offsetY: -55,
      fallback: false,
    };
    const opaqueMap = createOpaquePixelMap(source);
    expect(opaqueMap).not.toBeNull();

    const scanned = scanCropMetrics(source, viewport, transform);
    const cached = measureCropMetrics({
      source,
      viewport,
      opaqueMap,
    }, transform);
    expect(cached.contentCoverage).toBeCloseTo(scanned.contentCoverage, 12);
    expect(cached.sourceVisibleRatio).toBeCloseTo(
      scanned.sourceVisibleRatio,
      12,
    );

    const scanMedianMs = medianDuration(() =>
      scanCropMetrics(source, viewport, transform)
    );
    const cachedMedianMs = medianDuration(() =>
      measureCropMetrics({ source, viewport, opaqueMap }, transform)
    );
    const ratio = scanMedianMs / cachedMedianMs;
    const projectedFromReportedMs = 4.25 / ratio;

    console.info(
      `[crop benchmark] scan=${scanMedianMs.toFixed(3)}ms `
      + `cached=${cachedMedianMs.toFixed(3)}ms `
      + `speedup=${ratio.toFixed(1)}x `
      + `projected-from-4.25ms=${projectedFromReportedMs.toFixed(3)}ms`,
    );
    expect(cachedMedianMs).toBeLessThan(scanMedianMs * 0.25);
  });
});

function medianDuration(run: () => CropMetrics): number {
  for (let index = 0; index < 5; index += 1) {
    run();
  }
  const durations: number[] = [];
  let checksum = 0;
  for (let index = 0; index < 21; index += 1) {
    const startedAt = performance.now();
    const metrics = run();
    durations.push(performance.now() - startedAt);
    checksum += metrics.contentCoverage + metrics.sourceVisibleRatio;
  }
  expect(checksum).toBeGreaterThan(0);
  durations.sort((left, right) => left - right);
  return durations[Math.floor(durations.length / 2)]!;
}

function solidBuffer(width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 3; index < data.length; index += 4) {
    data[index] = 255;
  }
  return { width, height, data };
}

function scanCropMetrics(
  source: PixelBuffer,
  viewport: Rect,
  transform: CropTransform,
): CropMetrics {
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
