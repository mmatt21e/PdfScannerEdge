import { describe, it, expect } from 'vitest';
import {
  computeHomography,
  applyHomography,
  estimateOutputSize,
  cornersToPixels,
} from './perspective';
import type { DocumentCorners, Point } from '@/domain/types';

const rect: Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe('perspective math', () => {
  it('computes an identity-like homography for matching squares', () => {
    const h = computeHomography(rect, rect);
    const p = applyHomography(h, 50, 50);
    expect(p.x).toBeCloseTo(50, 4);
    expect(p.y).toBeCloseTo(50, 4);
  });

  it('maps corners of a translated/scaled quad correctly', () => {
    const dst: Point[] = [
      { x: 10, y: 20 },
      { x: 210, y: 20 },
      { x: 210, y: 420 },
      { x: 10, y: 420 },
    ];
    const h = computeHomography(rect, dst);
    const tl = applyHomography(h, 0, 0);
    const br = applyHomography(h, 100, 100);
    expect(tl.x).toBeCloseTo(10, 3);
    expect(tl.y).toBeCloseTo(20, 3);
    expect(br.x).toBeCloseTo(210, 3);
    expect(br.y).toBeCloseTo(420, 3);
  });

  it('throws on degenerate (collinear) points', () => {
    const bad: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(() => computeHomography(rect, bad)).toThrow();
  });

  it('estimates output size from quad edge lengths and clamps to max', () => {
    const quad: Point[] = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 400 },
      { x: 0, y: 400 },
    ];
    const size = estimateOutputSize(quad, 1000);
    expect(size.width).toBe(200);
    expect(size.height).toBe(400);
    const clamped = estimateOutputSize(quad, 200);
    expect(Math.max(clamped.width, clamped.height)).toBe(200);
  });

  it('denormalizes corners to pixel coordinates', () => {
    const corners: DocumentCorners = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 1, y: 1 },
      bottomLeft: { x: 0, y: 1 },
    };
    const px = cornersToPixels(corners, 640, 480);
    expect(px[2]).toEqual({ x: 640, y: 480 });
  });
});
