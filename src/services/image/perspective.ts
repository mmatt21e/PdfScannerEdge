// Perspective (projective) transform utilities for four-corner crop + correction.
// Pure math + ImageData sampling so it is fully testable and worker-safe.

import type { DocumentCorners, Point } from '@/domain/types';
import type { ImageDataLike } from './imageOps';

export type Matrix3 = [number, number, number, number, number, number, number, number, number];

/**
 * Compute the 3x3 homography that maps the four `from` points onto the four `to` points.
 * Points are ordered [topLeft, topRight, bottomRight, bottomLeft]. Solves the standard
 * 8-unknown linear system via Gaussian elimination.
 */
export function computeHomography(from: Point[], to: Point[]): Matrix3 {
  if (from.length !== 4 || to.length !== 4) {
    throw new Error('Homography requires exactly four point pairs.');
  }
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]!;
    const { x: X, y: Y } = to[i]!;
    a.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    b.push(X);
    a.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
    b.push(Y);
  }
  const h = solveLinearSystem(a, b);
  return [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];
}

/** Solve A·x = b for an 8x8 system with partial pivoting. */
function solveLinearSystem(a: number[][], b: number[]): number[] {
  const n = b.length;
  // Build augmented matrix.
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    // Partial pivot.
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-12) {
      throw new Error('Degenerate corner configuration; cannot compute transform.');
    }
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    // Eliminate.
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r]![col]! / m[col]![col]!;
      for (let c = col; c <= n; c++) {
        m[r]![c] = m[r]![c]! - f * m[col]![c]!;
      }
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/** Apply a homography to a point. */
export function applyHomography(h: Matrix3, x: number, y: number): Point {
  const w = h[6] * x + h[7] * y + h[8];
  return {
    x: (h[0] * x + h[1] * y + h[2]) / w,
    y: (h[3] * x + h[4] * y + h[5]) / w,
  };
}

/** Euclidean distance between two points. */
function dist(p: Point, q: Point): number {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** Denormalize corners (0..1) to pixel coordinates for a given image size. */
export function cornersToPixels(corners: DocumentCorners, width: number, height: number): Point[] {
  return [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft].map((p) => ({
    x: p.x * width,
    y: p.y * height,
  }));
}

/**
 * Estimate the output size of the corrected document from the quad's edge lengths.
 * Uses the average of opposite edges and clamps to a maximum dimension.
 */
export function estimateOutputSize(
  quad: Point[],
  maxDimension: number
): { width: number; height: number } {
  const [tl, tr, br, bl] = quad as [Point, Point, Point, Point];
  const widthPx = (dist(tl, tr) + dist(bl, br)) / 2;
  const heightPx = (dist(tl, bl) + dist(tr, br)) / 2;
  let w = Math.max(1, Math.round(widthPx));
  let h = Math.max(1, Math.round(heightPx));
  const longest = Math.max(w, h);
  if (longest > maxDimension) {
    const scale = maxDimension / longest;
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }
  return { width: w, height: h };
}

/**
 * Warp the quadrilateral defined by `srcQuad` (pixel coords in `src`) into an axis-aligned
 * rectangle of the given output size, using inverse mapping + bilinear sampling.
 */
export function warpPerspective(
  src: ImageDataLike,
  srcQuad: Point[],
  outWidth: number,
  outHeight: number,
  createImageData: (w: number, h: number) => ImageDataLike
): ImageDataLike {
  const rect: Point[] = [
    { x: 0, y: 0 },
    { x: outWidth, y: 0 },
    { x: outWidth, y: outHeight },
    { x: 0, y: outHeight },
  ];
  // Map output rectangle coordinates back to source quad coordinates.
  const h = computeHomography(rect, srcQuad);
  const out = createImageData(outWidth, outHeight);
  const { data: sd, width: sw, height: sh } = src;
  const od = out.data;

  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const p = applyHomography(h, x + 0.5, y + 0.5);
      const oi = (y * outWidth + x) * 4;
      // Bilinear sample with clamping.
      const fx = Math.min(sw - 1, Math.max(0, p.x));
      const fy = Math.min(sh - 1, Math.max(0, p.y));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const dx = fx - x0;
      const dy = fy - y0;
      for (let c = 0; c < 4; c++) {
        const i00 = (y0 * sw + x0) * 4 + c;
        const i10 = (y0 * sw + x1) * 4 + c;
        const i01 = (y1 * sw + x0) * 4 + c;
        const i11 = (y1 * sw + x1) * 4 + c;
        const top = sd[i00]! * (1 - dx) + sd[i10]! * dx;
        const bottom = sd[i01]! * (1 - dx) + sd[i11]! * dx;
        od[oi + c] = top * (1 - dy) + bottom * dy;
      }
      od[oi + 3] = 255;
    }
  }
  return out;
}
