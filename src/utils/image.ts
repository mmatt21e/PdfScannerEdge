// Low-level image helpers shared by services and UI. These wrap the Canvas / Blob APIs
// and are deliberately dependency-free so they can run on the main thread or in a worker.

export interface Size {
  width: number;
  height: number;
}

/** Decode a Blob into an ImageBitmap (preferred) or HTMLImageElement fallback. */
export async function blobToBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob);
  }
  return blobToImageElement(blob);
}

/** Decode a Blob into an HTMLImageElement (main-thread only). */
export function blobToImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image. The file may be corrupt or unsupported.'));
    };
    img.src = url;
  });
}

/** Create a canvas that works both on the main thread and inside a worker. */
export function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

/** Get a 2D context, throwing a friendly error if unavailable. */
export function get2dContext(canvas: AnyCanvas): CanvasRenderingContext2D {
  const ctx = (canvas as HTMLCanvasElement).getContext('2d', {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D | null;
  if (!ctx) {
    throw new Error('2D canvas rendering is not available in this browser.');
  }
  return ctx;
}

/** Serialize a canvas to a Blob at the given type/quality (worker-safe). */
export async function canvasToBlob(
  canvas: AnyCanvas,
  type = 'image/jpeg',
  quality = 0.9
): Promise<Blob> {
  if (typeof (canvas as OffscreenCanvas).convertToBlob === 'function') {
    return (canvas as OffscreenCanvas).convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image.'))),
      type,
      quality
    );
  });
}

/** Compute a size that fits within `maxDimension` on the longest edge, preserving ratio. */
export function fitWithin(size: Size, maxDimension: number): Size {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxDimension) {
    return { width: Math.round(size.width), height: Math.round(size.height) };
  }
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/**
 * Resize an image blob so its longest edge is at most `maxDimension`. Images already
 * within bounds are re-encoded at the requested quality (useful to normalize format).
 */
export async function resizeImageBlob(
  blob: Blob,
  maxDimension: number,
  type = 'image/jpeg',
  quality = 0.92
): Promise<Blob> {
  const bitmap = await blobToBitmap(blob);
  const source: Size = { width: bitmap.width, height: bitmap.height };
  const target = fitWithin(source, maxDimension);
  const canvas = createCanvas(target.width, target.height);
  const ctx = get2dContext(canvas);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, target.width, target.height);
  closeBitmap(bitmap);
  return canvasToBlob(canvas, type, quality);
}

/** Generate a small thumbnail blob (default longest edge 320px). */
export async function generateThumbnail(blob: Blob, maxDimension = 320): Promise<Blob> {
  return resizeImageBlob(blob, maxDimension, 'image/jpeg', 0.7);
}

/** Read the intrinsic size of an image blob. */
export async function getImageSize(blob: Blob): Promise<Size> {
  const bitmap = await blobToBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  closeBitmap(bitmap);
  return size;
}

/** Release an ImageBitmap if applicable (no-op for HTMLImageElement). */
export function closeBitmap(bitmap: ImageBitmap | HTMLImageElement): void {
  if ('close' in bitmap && typeof bitmap.close === 'function') {
    bitmap.close();
  }
}
