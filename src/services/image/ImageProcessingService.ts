import type {
  DocumentCorners,
  ImageAdjustmentOptions,
  ProcessedImage,
  Rotation,
} from '@/domain/types';
import { getCapabilities } from '@/services/capabilities';
import * as core from './processCore';

/**
 * Image-processing contract. Kept implementation-agnostic so the Canvas backend can be
 * replaced with OpenCV.js (or WebGL) later without touching the UI.
 */
export interface ImageProcessingService {
  detectDocument(image: Blob): Promise<DocumentCorners | null>;
  cropAndCorrect(image: Blob, corners: DocumentCorners): Promise<ProcessedImage>;
  applyAdjustments(image: Blob, options: ImageAdjustmentOptions): Promise<ProcessedImage>;
  rotate(image: Blob, rotation: Rotation): Promise<ProcessedImage>;
  dispose(): void;
}

/** Runs the core operations directly on the calling thread. Used as a fallback. */
export class MainThreadImageProcessingService implements ImageProcessingService {
  constructor(private readonly maxDimension = 2200) {}

  detectDocument(image: Blob): Promise<DocumentCorners | null> {
    return core.detectDocument(image);
  }
  cropAndCorrect(image: Blob, corners: DocumentCorners): Promise<ProcessedImage> {
    return core.cropAndCorrect(image, corners, this.maxDimension);
  }
  applyAdjustments(image: Blob, options: ImageAdjustmentOptions): Promise<ProcessedImage> {
    return core.applyAdjustments(image, options, this.maxDimension);
  }
  rotate(image: Blob, rotation: Rotation): Promise<ProcessedImage> {
    return core.rotateImage(image, rotation);
  }
  dispose(): void {
    /* no-op */
  }
}

// ---- Worker-backed implementation ------------------------------------------

type WorkerRequest =
  | { id: number; op: 'detect'; blob: Blob }
  | { id: number; op: 'crop'; blob: Blob; corners: DocumentCorners; maxDimension: number }
  | {
      id: number;
      op: 'adjust';
      blob: Blob;
      options: ImageAdjustmentOptions;
      maxDimension: number;
    }
  | { id: number; op: 'rotate'; blob: Blob; rotation: Rotation };

type WorkerResponse =
  | { id: number; ok: true; result: DocumentCorners | null | ProcessedImage }
  | { id: number; ok: false; error: string };

/**
 * Offloads processing to a Web Worker (using OffscreenCanvas). Falls back automatically to
 * the main thread if the worker or OffscreenCanvas is unavailable, or if a task fails.
 */
export class WorkerImageProcessingService implements ImageProcessingService {
  private worker?: Worker;
  private seq = 0;
  private readonly pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private readonly fallback: MainThreadImageProcessingService;

  constructor(private readonly maxDimension = 2200) {
    this.fallback = new MainThreadImageProcessingService(maxDimension);
    const caps = getCapabilities();
    if (caps.webWorker && caps.offscreenCanvas) {
      try {
        this.worker = new Worker(new URL('./imageWorker.ts', import.meta.url), {
          type: 'module',
        });
        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.onMessage(e.data);
        this.worker.onerror = () => this.failAll('The image processing worker crashed.');
      } catch {
        this.worker = undefined;
      }
    }
  }

  private onMessage(msg: WorkerResponse): void {
    const entry = this.pending.get(msg.id);
    if (!entry) return;
    this.pending.delete(msg.id);
    if (msg.ok) {
      entry.resolve(msg.result);
    } else {
      entry.reject(new Error(msg.error));
    }
  }

  private failAll(message: string): void {
    for (const [, entry] of this.pending) {
      entry.reject(new Error(message));
    }
    this.pending.clear();
  }

  private post<T>(req: WorkerRequest): Promise<T> {
    if (!this.worker) {
      return Promise.reject(new Error('worker-unavailable'));
    }
    return new Promise<T>((resolve, reject) => {
      this.pending.set(req.id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.worker!.postMessage(req);
    });
  }

  async detectDocument(image: Blob): Promise<DocumentCorners | null> {
    if (!this.worker) return this.fallback.detectDocument(image);
    try {
      return await this.post<DocumentCorners | null>({
        id: ++this.seq,
        op: 'detect',
        blob: image,
      });
    } catch {
      return this.fallback.detectDocument(image);
    }
  }

  async cropAndCorrect(image: Blob, corners: DocumentCorners): Promise<ProcessedImage> {
    if (!this.worker) return this.fallback.cropAndCorrect(image, corners);
    try {
      return await this.post<ProcessedImage>({
        id: ++this.seq,
        op: 'crop',
        blob: image,
        corners,
        maxDimension: this.maxDimension,
      });
    } catch {
      return this.fallback.cropAndCorrect(image, corners);
    }
  }

  async applyAdjustments(image: Blob, options: ImageAdjustmentOptions): Promise<ProcessedImage> {
    if (!this.worker) return this.fallback.applyAdjustments(image, options);
    try {
      return await this.post<ProcessedImage>({
        id: ++this.seq,
        op: 'adjust',
        blob: image,
        options,
        maxDimension: this.maxDimension,
      });
    } catch {
      return this.fallback.applyAdjustments(image, options);
    }
  }

  async rotate(image: Blob, rotation: Rotation): Promise<ProcessedImage> {
    if (!this.worker) return this.fallback.rotate(image, rotation);
    try {
      return await this.post<ProcessedImage>({
        id: ++this.seq,
        op: 'rotate',
        blob: image,
        rotation,
      });
    } catch {
      return this.fallback.rotate(image, rotation);
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.failAll('Image processing was disposed.');
  }
}

export type { WorkerRequest, WorkerResponse };
