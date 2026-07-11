import { describe, it, expect } from 'vitest';
import {
  applyBrightnessContrast,
  toGrayscale,
  toBlackAndWhite,
  applyAdjustmentsToImageData,
  type ImageDataLike,
} from './imageOps';
import { DEFAULT_ADJUSTMENTS } from '@/domain/types';

function makeImage(pixels: number[][]): ImageDataLike {
  const width = pixels.length;
  const data = new Uint8ClampedArray(width * 4);
  pixels.forEach((p, i) => {
    data[i * 4] = p[0]!;
    data[i * 4 + 1] = p[1]!;
    data[i * 4 + 2] = p[2]!;
    data[i * 4 + 3] = 255;
  });
  return { data, width, height: 1 };
}

describe('imageOps', () => {
  it('brightens pixels', () => {
    const img = makeImage([[100, 100, 100]]);
    applyBrightnessContrast(img, 50, 0);
    expect(img.data[0]).toBeGreaterThan(100);
  });

  it('increases separation with contrast', () => {
    const dark = makeImage([[80, 80, 80]]);
    const light = makeImage([[180, 180, 180]]);
    applyBrightnessContrast(dark, 0, 60);
    applyBrightnessContrast(light, 0, 60);
    expect(dark.data[0]).toBeLessThan(80);
    expect(light.data[0]).toBeGreaterThan(180);
  });

  it('converts to grayscale with equal channels', () => {
    const img = makeImage([[255, 0, 0]]);
    toGrayscale(img);
    expect(img.data[0]).toBe(img.data[1]);
    expect(img.data[1]).toBe(img.data[2]);
  });

  it('thresholds to pure black and white', () => {
    const img = makeImage([
      [30, 30, 30],
      [220, 220, 220],
    ]);
    toBlackAndWhite(img, 128);
    expect(img.data[0]).toBe(0);
    expect(img.data[4]).toBe(255);
  });

  it('applies the full adjustment stack without throwing', () => {
    const img = makeImage([
      [120, 130, 140],
      [10, 20, 30],
    ]);
    expect(() =>
      applyAdjustmentsToImageData(img, {
        ...DEFAULT_ADJUSTMENTS,
        brightness: 10,
        contrast: 20,
        colorMode: 'grayscale',
        sharpen: 30,
        backgroundCleanup: 40,
      })
    ).not.toThrow();
    expect(img.data[0]).toBe(img.data[1]); // grayscale applied
  });
});
