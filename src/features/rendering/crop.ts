import { findOpaqueBounds } from "./pixels";
import type { CropTransform, OpaqueBounds, PixelBuffer, Rect } from "./types";

export interface CropInput {
  source: PixelBuffer;
  viewport: Rect;
  opaqueBounds?: OpaqueBounds | null;
}

interface CropMetrics {
  contentCoverage: number;
  sourceVisibleRatio: number;
}

export function createRandomCrop(
  input: CropInput,
  rng: () => number = Math.random,
): CropTransform {
  const opaqueBounds = input.opaqueBounds ?? findOpaqueBounds(input.source);
  if (opaqueBounds === null) {
    throw new Error("图片不包含可见像素");
  }

  const containScale = Math.min(
    input.viewport.width / input.source.width,
    input.viewport.height / input.source.height,
  );

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const multiplier = 1.5 + rng() * 1.5;
    const scale = containScale * multiplier;
    const transform = randomTransformWithinBounds(scale, input.viewport, opaqueBounds, rng);
    const metrics = measureVisibleOpaquePixels(transform, input.source, input.viewport, opaqueBounds);

    if (metrics.contentCoverage >= 0.15 && metrics.sourceVisibleRatio <= 0.70) {
      return { ...transform, fallback: false };
    }
  }

  return centeredFallback(input.viewport, opaqueBounds, containScale * 2);
}

function randomTransformWithinBounds(
  scale: number,
  viewport: Rect,
  bounds: OpaqueBounds,
  rng: () => number,
): Omit<CropTransform, "fallback"> {
  const offsetX = randomOffset(
    viewport.x + viewport.width - (bounds.x + bounds.width) * scale,
    viewport.x - bounds.x * scale,
    viewport.x + viewport.width / 2 - (bounds.x + bounds.width / 2) * scale,
    rng,
  );
  const offsetY = randomOffset(
    viewport.y + viewport.height - (bounds.y + bounds.height) * scale,
    viewport.y - bounds.y * scale,
    viewport.y + viewport.height / 2 - (bounds.y + bounds.height / 2) * scale,
    rng,
  );

  return { scale, offsetX, offsetY };
}

function randomOffset(minimum: number, maximum: number, centered: number, rng: () => number): number {
  if (minimum > maximum) {
    return centered;
  }

  return minimum + rng() * (maximum - minimum);
}

function measureVisibleOpaquePixels(
  transform: Omit<CropTransform, "fallback">,
  source: PixelBuffer,
  viewport: Rect,
  bounds: OpaqueBounds,
): CropMetrics {
  let visibleArea = 0;

  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      if (source.data[(y * source.width + x) * 4 + 3]! === 0) {
        continue;
      }

      visibleArea += overlapArea(
        {
          x: x * transform.scale + transform.offsetX,
          y: y * transform.scale + transform.offsetY,
          width: transform.scale,
          height: transform.scale,
        },
        viewport,
      );
    }
  }

  return {
    contentCoverage: visibleArea / (viewport.width * viewport.height),
    sourceVisibleRatio: visibleArea / (bounds.opaquePixels * transform.scale * transform.scale),
  };
}

function overlapArea(first: Rect, second: Rect): number {
  const width = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));
  const height = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
  return width * height;
}

function centeredFallback(viewport: Rect, bounds: OpaqueBounds, scale: number): CropTransform {
  return {
    scale,
    offsetX: viewport.x + viewport.width / 2 - (bounds.x + bounds.width / 2) * scale,
    offsetY: viewport.y + viewport.height / 2 - (bounds.y + bounds.height / 2) * scale,
    fallback: true,
  };
}
