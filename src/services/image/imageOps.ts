// Pure pixel operations on ImageData-like buffers. These have no canvas/DOM dependency so
// they run identically on the main thread, in a Web Worker, and in unit tests.

import type { ImageAdjustmentOptions } from '@/domain/types';

export interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Perceptual luminance of an sRGB pixel. */
export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Apply brightness (-100..100) and contrast (-100..100) in place. */
export function applyBrightnessContrast(
  img: ImageDataLike,
  brightness: number,
  contrast: number
): void {
  if (brightness === 0 && contrast === 0) return;
  const b = (brightness / 100) * 255;
  // Standard contrast factor formula.
  const c = Math.max(-255, Math.min(255, (contrast / 100) * 255));
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  const { data } = img;
  for (let i = 0; i < data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const v = factor * (data[i + ch]! - 128) + 128 + b;
      data[i + ch] = v;
    }
  }
}

/** Convert to grayscale in place (keeps alpha). */
export function toGrayscale(img: ImageDataLike): void {
  const { data } = img;
  for (let i = 0; i < data.length; i += 4) {
    const y = luminance(data[i]!, data[i + 1]!, data[i + 2]!);
    data[i] = y;
    data[i + 1] = y;
    data[i + 2] = y;
  }
}

/** Convert to 1-bit black & white using a luminance threshold (0..255) in place. */
export function toBlackAndWhite(img: ImageDataLike, threshold: number): void {
  const { data } = img;
  for (let i = 0; i < data.length; i += 4) {
    const y = luminance(data[i]!, data[i + 1]!, data[i + 2]!);
    const v = y >= threshold ? 255 : 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
}

/**
 * Background cleanup / shadow reduction (amount 0..100). Stretches the upper luminance
 * range toward white so paper backgrounds become clean while keeping dark text. This is a
 * global levels operation — cheap and robust for document scans.
 */
export function backgroundCleanup(img: ImageDataLike, amount: number): void {
  if (amount <= 0) return;
  const strength = Math.min(100, amount) / 100;
  // Pull the white point down so pixels above `whitePoint` clamp to white.
  const whitePoint = 235 - strength * 70; // 235 -> 165
  const scale = 255 / whitePoint;
  const { data } = img;
  for (let i = 0; i < data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const v = data[i + ch]! * scale;
      data[i + ch] = v;
    }
  }
}

/**
 * Unsharp-mask style sharpening (amount 0..100) in place using a 3x3 kernel. Reads from a
 * copy so neighboring writes don't feed back.
 */
export function sharpen(img: ImageDataLike, amount: number): void {
  if (amount <= 0) return;
  const k = (amount / 100) * 1.2; // strength
  const { width, height, data } = img;
  const src = new Uint8ClampedArray(data);
  const center = 1 + 4 * k;
  const side = -k;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const o = i + ch;
        const v =
          center * src[o]! +
          side * src[o - 4]! +
          side * src[o + 4]! +
          side * src[o - width * 4]! +
          side * src[o + width * 4]!;
        data[o] = v;
      }
    }
  }
}

/** Apply a full adjustment stack to an ImageData buffer in place, in a sensible order. */
export function applyAdjustmentsToImageData(
  img: ImageDataLike,
  options: ImageAdjustmentOptions
): void {
  applyBrightnessContrast(img, options.brightness, options.contrast);
  if (options.backgroundCleanup > 0) {
    backgroundCleanup(img, options.backgroundCleanup);
  }
  if (options.colorMode === 'grayscale') {
    toGrayscale(img);
  } else if (options.colorMode === 'bw') {
    toBlackAndWhite(img, options.bwThreshold);
  }
  if (options.sharpen > 0 && options.colorMode !== 'bw') {
    sharpen(img, options.sharpen);
  }
}
