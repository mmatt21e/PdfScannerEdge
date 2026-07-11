/// <reference lib="webworker" />
// Web Worker entry for CPU-heavy image processing. Delegates to the shared processCore so
// the exact same logic runs off the main thread.

import type { DocumentCorners, ProcessedImage } from '@/domain/types';
import * as core from './processCore';
import type { WorkerRequest, WorkerResponse } from './ImageProcessingService';

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    let result: DocumentCorners | null | ProcessedImage;
    switch (req.op) {
      case 'detect':
        result = await core.detectDocument(req.blob);
        break;
      case 'crop':
        result = await core.cropAndCorrect(req.blob, req.corners, req.maxDimension);
        break;
      case 'adjust':
        result = await core.applyAdjustments(req.blob, req.options, req.maxDimension);
        break;
      case 'rotate':
        result = await core.rotateImage(req.blob, req.rotation);
        break;
      default:
        throw new Error('Unknown operation.');
    }
    const response: WorkerResponse = { id: req.id, ok: true, result };
    (self as DedicatedWorkerGlobalScope).postMessage(response);
  } catch (err) {
    const response: WorkerResponse = {
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : 'Image processing failed.',
    };
    (self as DedicatedWorkerGlobalScope).postMessage(response);
  }
};
