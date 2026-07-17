import type { OpaqueBounds, PixelBuffer } from "./types";

export function createSilhouette(buffer: PixelBuffer): PixelBuffer {
  const data = new Uint8ClampedArray(buffer.data.length);

  for (let index = 0; index < buffer.data.length; index += 4) {
    data[index + 3] = buffer.data[index + 3]!;
  }

  return { width: buffer.width, height: buffer.height, data };
}

export function findOpaqueBounds(buffer: PixelBuffer): OpaqueBounds | null {
  let minX = buffer.width;
  let minY = buffer.height;
  let maxX = -1;
  let maxY = -1;
  let opaquePixels = 0;

  for (let y = 0; y < buffer.height; y += 1) {
    for (let x = 0; x < buffer.width; x += 1) {
      if (buffer.data[(y * buffer.width + x) * 4 + 3]! === 0) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      opaquePixels += 1;
    }
  }

  if (opaquePixels === 0) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    opaquePixels,
  };
}
