import { describe, expect, it } from "vitest";
import { createSilhouette, findOpaqueBounds } from "./pixels";

const buffer = {
  width: 2,
  height: 2,
  data: new Uint8ClampedArray([
    255, 0, 0, 255, 0, 0, 0, 0,
    0, 255, 0, 128, 0, 0, 255, 255,
  ]),
};

describe("pixel utilities", () => {
  it("turns non-transparent pixels black and preserves alpha without mutating input", () => {
    const silhouette = createSilhouette(buffer);

    expect([...silhouette.data]).toEqual([
      0, 0, 0, 255, 0, 0, 0, 0,
      0, 0, 0, 128, 0, 0, 0, 255,
    ]);
    expect(silhouette.data).not.toBe(buffer.data);
    expect([...buffer.data]).toEqual([
      255, 0, 0, 255, 0, 0, 0, 0,
      0, 255, 0, 128, 0, 0, 255, 255,
    ]);
  });

  it("finds inclusive bounds for every pixel with alpha above zero", () => {
    expect(findOpaqueBounds(buffer)).toEqual({
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      opaquePixels: 3,
    });
  });

  it("returns null when no pixels are visible", () => {
    expect(findOpaqueBounds({
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([0, 0, 0, 0]),
    })).toBeNull();
  });
});
