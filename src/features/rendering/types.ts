export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface OpaqueBounds extends Rect {
  opaquePixels: number;
}

export interface CropTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  fallback: boolean;
}
