// Core image-processing operations shared by the main-thread service and the Web Worker.
// Uses the canvas helpers (which transparently pick OffscreenCanvas or HTMLCanvasElement)
// so the exact same code runs in both contexts.

import type {
  DocumentCorners,
  ImageAdjustmentOptions,
  ProcessedImage,
  Rotation,
} from '@/domain/types';
import {
  blobToBitmap,
  canvasToBlob,
  closeBitmap,
  createCanvas,
  fitWithin,
  get2dContext,
} from '@/utils/image';
import { applyAdjustmentsToImageData, type ImageDataLike } from './imageOps';
import { detectDocumentCorners } from './edgeDetection';
import { cornersToPixels, estimateOutputSize, warpPerspective } from './perspective';

const DETECT_MAX_DIM = 480;

/** JPEG quality per requested output tier. */
function qualityFor(quality: number): number {
  return Math.min(1, Math.max(0.4, quality));
}

async function loadToImageData(
  blob: Blob,
  maxDimension?: number
): Promise<{ img: ImageDataLike; width: number; height: number }> {
  const bitmap = await blobToBitmap(blob);
  let w = bitmap.width;
  let h = bitmap.height;
  if (maxDimension) {
    const fit = fitWithin({ width: w, height: h }, maxDimension);
    w = fit.width;
    h = fit.height;
  }
  const canvas = createCanvas(w, h);
  const ctx = get2dContext(canvas);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  closeBitmap(bitmap);
  const img = ctx.getImageData(0, 0, w, h);
  return { img, width: w, height: h };
}

async function imageDataToBlob(
  img: ImageDataLike,
  type = 'image/jpeg',
  quality = 0.9
): Promise<ProcessedImage> {
  const canvas = createCanvas(img.width, img.height);
  const ctx = get2dContext(canvas);
  ctx.putImageData(img as ImageData, 0, 0);
  const blob = await canvasToBlob(canvas, type, quality);
  return { blob, width: img.width, height: img.height };
}

/** Detect document corners on a downscaled copy. Returns null when unreliable. */
export async function detectDocument(blob: Blob): Promise<DocumentCorners | null> {
  try {
    const { img } = await loadToImageData(blob, DETECT_MAX_DIM);
    return detectDocumentCorners(img);
  } catch {
    return null;
  }
}

/** Crop + perspective-correct using four normalized corners. */
export async function cropAndCorrect(
  blob: Blob,
  corners: DocumentCorners,
  maxDimension = 2200
): Promise<ProcessedImage> {
  const { img, width, height } = await loadToImageData(blob, maxDimension);
  const quad = cornersToPixels(corners, width, height);
  const size = estimateOutputSize(quad, maxDimension);
  const warped = warpPerspective(img, quad, size.width, size.height, (w, h) => new ImageData(w, h));
  return imageDataToBlob(warped, 'image/jpeg', 0.92);
}

/** Apply the adjustment stack. */
export async function applyAdjustments(
  blob: Blob,
  options: ImageAdjustmentOptions,
  maxDimension = 2200,
  quality = 0.9
): Promise<ProcessedImage> {
  const { img } = await loadToImageData(blob, maxDimension);
  applyAdjustmentsToImageData(img, options);
  return imageDataToBlob(img, 'image/jpeg', qualityFor(quality));
}

/** Rotate an image by a multiple of 90 degrees, baking it into a new blob. */
export async function rotateImage(blob: Blob, rotation: Rotation): Promise<ProcessedImage> {
  const bitmap = await blobToBitmap(blob);
  const swap = rotation === 90 || rotation === 270;
  const outW = swap ? bitmap.height : bitmap.width;
  const outH = swap ? bitmap.width : bitmap.height;
  const canvas = createCanvas(outW, outH);
  const ctx = get2dContext(canvas);
  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap as CanvasImageSource, -bitmap.width / 2, -bitmap.height / 2);
  ctx.restore();
  closeBitmap(bitmap);
  const blobOut = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  return { blob: blobOut, width: outW, height: outH };
}
