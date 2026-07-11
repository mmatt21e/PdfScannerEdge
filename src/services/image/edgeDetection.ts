// Lightweight document edge detection heuristic. Returns normalized corners (0..1) or
// null. It is intentionally conservative: a null result is expected and the UI falls back
// to the full image with manual cropping. This is NOT a full CV pipeline — see backlog.

import type { DocumentCorners } from '@/domain/types';
import { luminance, type ImageDataLike } from './imageOps';

/**
 * Detect the bounding rectangle of the document by finding pixels that differ from the
 * sampled border/background color, then projecting onto the row and column axes.
 */
export function detectDocumentCorners(img: ImageDataLike): DocumentCorners | null {
  const { data, width, height } = img;
  if (width < 16 || height < 16) return null;

  // Sample background luminance from the image border.
  const bg = sampleBorderLuminance(img);
  // Difference threshold scales with overall contrast; keep a sane floor.
  const threshold = 28;

  const colHits = new Float32Array(width);
  const rowHits = new Float32Array(height);
  let totalHits = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const y0 = luminance(data[i]!, data[i + 1]!, data[i + 2]!);
      if (Math.abs(y0 - bg) > threshold) {
        colHits[x] = colHits[x]! + 1;
        rowHits[y] = rowHits[y]! + 1;
        totalHits++;
      }
    }
  }

  // If almost nothing or almost everything differs, detection is unreliable.
  const coverage = totalHits / (width * height);
  if (coverage < 0.02 || coverage > 0.985) return null;

  const left = firstIndexAbove(colHits, height * 0.08);
  const right = lastIndexAbove(colHits, height * 0.08);
  const top = firstIndexAbove(rowHits, width * 0.08);
  const bottom = lastIndexAbove(rowHits, width * 0.08);

  if (left < 0 || right < 0 || top < 0 || bottom < 0) return null;
  if (right - left < width * 0.2 || bottom - top < height * 0.2) return null;

  // If the box is essentially the whole frame, there's no useful crop to suggest.
  const nearFull =
    left <= width * 0.02 &&
    right >= width * 0.98 &&
    top <= height * 0.02 &&
    bottom >= height * 0.98;
  if (nearFull) return null;

  const nx = (v: number) => Math.min(1, Math.max(0, v / width));
  const ny = (v: number) => Math.min(1, Math.max(0, v / height));

  return {
    topLeft: { x: nx(left), y: ny(top) },
    topRight: { x: nx(right), y: ny(top) },
    bottomRight: { x: nx(right), y: ny(bottom) },
    bottomLeft: { x: nx(left), y: ny(bottom) },
  };
}

function sampleBorderLuminance(img: ImageDataLike): number {
  const { data, width, height } = img;
  let sum = 0;
  let count = 0;
  const add = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    sum += luminance(data[i]!, data[i + 1]!, data[i + 2]!);
    count++;
  };
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 64))) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 64))) {
    add(0, y);
    add(width - 1, y);
  }
  return count ? sum / count : 255;
}

function firstIndexAbove(arr: Float32Array, min: number): number {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]! >= min) return i;
  }
  return -1;
}

function lastIndexAbove(arr: Float32Array, min: number): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i]! >= min) return i;
  }
  return -1;
}
