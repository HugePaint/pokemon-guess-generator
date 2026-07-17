import type { CropTransform, OpaqueBounds, PixelBuffer, Rect } from "./types";

export const MIN_CROP_ZOOM = 1.5;
export const MAX_CROP_ZOOM = 6;

export interface CropInput {
  source: PixelBuffer;
  viewport: Rect;
  opaqueMap?: OpaquePixelMap | null;
}

export interface OpaquePixelMap {
  readonly width: number;
  readonly height: number;
  readonly bounds: OpaqueBounds;
  readonly integral: Uint32Array;
}

export interface CropMetrics {
  contentCoverage: number;
  sourceVisibleRatio: number;
}

export function createRandomCrop(
  input: CropInput,
  rng: () => number = Math.random,
): CropTransform {
  const opaqueMap = resolveOpaqueMap(input);
  if (opaqueMap === null) {
    throw new Error("图片不包含可见像素");
  }
  const preparedInput = input.opaqueMap === opaqueMap
    ? input
    : { ...input, opaqueMap };

  const containScale = Math.min(
    input.viewport.width / input.source.width,
    input.viewport.height / input.source.height,
  );

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const multiplier = MIN_CROP_ZOOM
      + rng() * (MAX_CROP_ZOOM - MIN_CROP_ZOOM);
    const scale = containScale * multiplier;
    const transform = randomTransformWithinBounds(
      scale,
      input.viewport,
      opaqueMap.bounds,
      rng,
    );
    if (isCropValid(preparedInput, { ...transform, fallback: false })) {
      return { ...transform, fallback: false };
    }
  }

  return centeredFallback(input.viewport, opaqueMap.bounds, containScale * 2);
}

export function isCropValid(
  input: CropInput,
  transform: CropTransform,
): boolean {
  const opaqueMap = resolveOpaqueMap(input);
  if (opaqueMap === null) {
    return false;
  }
  const containScale = Math.min(
    input.viewport.width / input.source.width,
    input.viewport.height / input.source.height,
  );
  const minimumScale = containScale * MIN_CROP_ZOOM;
  const maximumScale = containScale * MAX_CROP_ZOOM;
  if (
    !Number.isFinite(transform.scale)
    || !Number.isFinite(transform.offsetX)
    || !Number.isFinite(transform.offsetY)
    || transform.scale < minimumScale
    || transform.scale > maximumScale
  ) {
    return false;
  }

  const metrics = measureCropMetrics(
    input.opaqueMap === opaqueMap ? input : { ...input, opaqueMap },
    transform,
  );
  return metrics.contentCoverage >= 0.15
    && metrics.sourceVisibleRatio <= 0.70;
}

export function createOpaquePixelMap(
  source: PixelBuffer,
): OpaquePixelMap | null {
  const stride = source.width + 1;
  const integral = new Uint32Array(stride * (source.height + 1));
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;
  let opaquePixels = 0;

  for (let y = 0; y < source.height; y += 1) {
    let rowOpaque = 0;
    for (let x = 0; x < source.width; x += 1) {
      const opaque = source.data[(y * source.width + x) * 4 + 3]! === 0
        ? 0
        : 1;
      rowOpaque += opaque;
      integral[(y + 1) * stride + x + 1] =
        integral[y * stride + x + 1]! + rowOpaque;
      if (opaque === 0) {
        continue;
      }
      opaquePixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (opaquePixels === 0) {
    return null;
  }
  return {
    width: source.width,
    height: source.height,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      opaquePixels,
    },
    integral,
  };
}

export function measureCropMetrics(
  input: CropInput,
  transform: CropTransform,
): CropMetrics {
  const opaqueMap = resolveOpaqueMap(input);
  if (opaqueMap === null) {
    return { contentCoverage: 0, sourceVisibleRatio: 1 };
  }
  const sourceLeft = (input.viewport.x - transform.offsetX) / transform.scale;
  const sourceRight = (
    input.viewport.x + input.viewport.width - transform.offsetX
  ) / transform.scale;
  const sourceTop = (input.viewport.y - transform.offsetY) / transform.scale;
  const sourceBottom = (
    input.viewport.y + input.viewport.height - transform.offsetY
  ) / transform.scale;
  const visibleOpaqueSourceArea = opaqueAreaInRect(
    opaqueMap,
    sourceLeft,
    sourceTop,
    sourceRight,
    sourceBottom,
  );
  const visibleArea = visibleOpaqueSourceArea
    * transform.scale
    * transform.scale;
  return {
    contentCoverage: visibleArea
      / (input.viewport.width * input.viewport.height),
    sourceVisibleRatio: visibleOpaqueSourceArea
      / opaqueMap.bounds.opaquePixels,
  };
}

function resolveOpaqueMap(input: CropInput): OpaquePixelMap | null {
  return input.opaqueMap === undefined
    ? createOpaquePixelMap(input.source)
    : input.opaqueMap;
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

function opaqueAreaInRect(
  map: OpaquePixelMap,
  left: number,
  top: number,
  right: number,
  bottom: number,
): number {
  const clippedLeft = clamp(left, 0, map.width);
  const clippedTop = clamp(top, 0, map.height);
  const clippedRight = clamp(right, 0, map.width);
  const clippedBottom = clamp(bottom, 0, map.height);
  if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) {
    return 0;
  }
  return Math.max(0,
    integratedOpaqueArea(map, clippedRight, clippedBottom)
    - integratedOpaqueArea(map, clippedLeft, clippedBottom)
    - integratedOpaqueArea(map, clippedRight, clippedTop)
    + integratedOpaqueArea(map, clippedLeft, clippedTop),
  );
}

function integratedOpaqueArea(
  map: OpaquePixelMap,
  x: number,
  y: number,
): number {
  const integerX = Math.floor(x);
  const integerY = Math.floor(y);
  const fractionX = x - integerX;
  const fractionY = y - integerY;
  const stride = map.width + 1;
  const at = (row: number, column: number) =>
    map.integral[row * stride + column]!;
  let area = at(integerY, integerX);

  if (integerX < map.width && fractionX > 0) {
    area += fractionX
      * (at(integerY, integerX + 1) - at(integerY, integerX));
  }
  if (integerY < map.height && fractionY > 0) {
    area += fractionY
      * (at(integerY + 1, integerX) - at(integerY, integerX));
  }
  if (
    integerX < map.width
    && integerY < map.height
    && fractionX > 0
    && fractionY > 0
  ) {
    const cell = at(integerY + 1, integerX + 1)
      - at(integerY, integerX + 1)
      - at(integerY + 1, integerX)
      + at(integerY, integerX);
    area += fractionX * fractionY * cell;
  }
  return area;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function centeredFallback(viewport: Rect, bounds: OpaqueBounds, scale: number): CropTransform {
  return {
    scale,
    offsetX: viewport.x + viewport.width / 2 - (bounds.x + bounds.width / 2) * scale,
    offsetY: viewport.y + viewport.height / 2 - (bounds.y + bounds.height / 2) * scale,
    fallback: true,
  };
}
