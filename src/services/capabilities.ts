// Runtime capability detection. Never claim support without checking — the UI uses these
// flags to enable/disable features and pick fallbacks.

export interface Capabilities {
  camera: boolean;
  fileInput: boolean;
  offscreenCanvas: boolean;
  webWorker: boolean;
  webShare: boolean;
  webShareFiles: boolean;
  persistentStorage: boolean;
  storageEstimate: boolean;
  serviceWorker: boolean;
  indexedDb: boolean;
  /** File System Access API: save a file to a user-chosen location. */
  fileSystemSave: boolean;
  /** File System Access API: pick a device directory to write into. */
  directoryPicker: boolean;
}

/** Whether a torch-capable camera track exists is only known after a stream opens, so
 * torch/exposure are detected per-stream in CameraService, not here. */
export function detectCapabilities(): Capabilities {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;

  const webShare = !!nav && typeof nav.share === 'function';
  // canShare with files is the only reliable signal for file sharing support.
  let webShareFiles = false;
  if (nav && typeof nav.canShare === 'function') {
    try {
      const probe = new File([new Blob(['x'])], 'probe.pdf', { type: 'application/pdf' });
      webShareFiles = nav.canShare({ files: [probe] });
    } catch {
      webShareFiles = false;
    }
  }

  return {
    camera: !!nav?.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function',
    fileInput: typeof document !== 'undefined',
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    webWorker: typeof Worker !== 'undefined',
    webShare,
    webShareFiles,
    persistentStorage: !!nav?.storage && typeof nav.storage.persist === 'function',
    storageEstimate: !!nav?.storage && typeof nav.storage.estimate === 'function',
    serviceWorker: !!nav && 'serviceWorker' in nav,
    indexedDb: typeof indexedDB !== 'undefined',
    fileSystemSave: typeof window !== 'undefined' && 'showSaveFilePicker' in window,
    directoryPicker: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
  };
}

let cached: Capabilities | undefined;

/** Memoized capabilities for the current session. */
export function getCapabilities(): Capabilities {
  if (!cached) {
    cached = detectCapabilities();
  }
  return cached;
}
