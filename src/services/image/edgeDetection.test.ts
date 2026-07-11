import { describe, it, expect } from 'vitest';
import { detectDocumentCorners } from './edgeDetection';
import type { ImageDataLike } from './imageOps';

/** Build an image with a bright rectangle centered on a dark background. */
function docOnBackground(size: number, inset: number): ImageDataLike {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inDoc = x >= inset && x < size - inset && y >= inset && y < size - inset;
      const v = inDoc ? 240 : 20;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: size, height: size };
}

describe('edge detection heuristic', () => {
  it('detects a centered document rectangle', () => {
    const corners = detectDocumentCorners(docOnBackground(100, 20));
    expect(corners).not.toBeNull();
    if (corners) {
      expect(corners.topLeft.x).toBeGreaterThan(0.1);
      expect(corners.topLeft.x).toBeLessThan(0.3);
      expect(corners.bottomRight.x).toBeGreaterThan(0.7);
    }
  });

  it('returns null when the whole frame is uniform (nothing to crop)', () => {
    const size = 60;
    const data = new Uint8ClampedArray(size * size * 4).fill(200);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    expect(detectDocumentCorners({ data, width: size, height: size })).toBeNull();
  });

  it('returns null for tiny images', () => {
    const data = new Uint8ClampedArray(8 * 8 * 4).fill(120);
    expect(detectDocumentCorners({ data, width: 8, height: 8 })).toBeNull();
  });
});
