# PocketScan Architecture

This document describes how PocketScan is structured, the data model and IndexedDB schema,
and the extension points designed for future work (cloud sync, OpenCV, etc.).

## Layered design

PocketScan separates UI from logic from persistence. Services and repositories are
constructed once in a **composition root** (`src/services/container.ts`) and provided to the
React tree via `ServicesContext`. Components never import IndexedDB or browser APIs
directly — they depend on injected services.

```
UI (routes/, components/)
  → hooks (useServices, useLibrary, useScanFlow, useStorageStatus, …)
    → services (camera, image, pdf, storage, folder/document/scan-session orchestration)
      → repositories (folder, document, scan-session, preferences)
        → Dexie database (IndexedDB)
```

### Why these boundaries

- **Testability** — repositories are tested against `fake-indexeddb`; services are tested
  with injected stubs (e.g. a fake PDF generator) so no canvas/browser is required.
- **Swappability** — image processing and storage sit behind interfaces, so the Canvas
  backend can be replaced by OpenCV.js and the local repositories by cloud-backed ones
  without touching the UI.
- **Reliability** — the scan flow persists to IndexedDB on every mutation, so an
  interrupted scan is recoverable.

## Services

| Service                    | Responsibility                                                     |
| -------------------------- | ------------------------------------------------------------------ |
| `CameraService`            | `getUserMedia`, frame capture, torch; maps errors to user reasons  |
| `ImageProcessingService`   | Detect/crop/perspective-correct, adjustments, rotate               |
| `PdfGenerationService`     | Build PDFs (pdf-lib), estimate size, preserve aspect ratio         |
| `FolderService`            | Folder CRUD + safe delete (reassign documents to Documents)        |
| `DocumentService`          | Save-from-scan, duplicate handling, quota mapping, library actions |
| `ScanSessionService`       | Draft lifecycle: create/replace/reorder/rotate/reprocess/reset     |
| `StorageService`           | Usage estimate, persistence request, quota detection               |
| `UpdateManager` (PWA)      | Prompt-based service-worker updates that never interrupt a scan    |
| `capabilities`             | Runtime feature detection (camera, share, storage, worker, …)      |

### Suggested service interfaces (as implemented)

```ts
interface CameraService {
  start(options?): Promise<CameraStreamInfo>;
  stop(): void;
  captureFrame(video, quality?): Promise<Blob>;
  setTorch(enabled: boolean): Promise<void>;
  isActive(): boolean;
}

interface ImageProcessingService {
  detectDocument(image: Blob): Promise<DocumentCorners | null>;
  cropAndCorrect(image: Blob, corners: DocumentCorners): Promise<ProcessedImage>;
  applyAdjustments(image: Blob, options: ImageAdjustmentOptions): Promise<ProcessedImage>;
  rotate(image: Blob, rotation: Rotation): Promise<ProcessedImage>;
  dispose(): void;
}

interface PdfGenerationService {
  generate(pages, options, onProgress?, signal?): Promise<Blob>;
  estimateSize(pages, options): Promise<number>;
}

interface DocumentRepository {
  create(document): Promise<string>;
  update(document): Promise<void>;
  getById(id): Promise<StoredDocument | undefined>;
  listByFolder(folderId): Promise<StoredDocument[]>;
  delete(id): Promise<void>;
  /* + trash/restore, move, rename, duplicate, favorite, search/sort */
}

interface ScanSessionRepository {
  save(session): Promise<void>;
  getActive(): Promise<ScanSession | undefined>;
  delete(id): Promise<void>;
  pruneAbandoned(maxAgeMs): Promise<number>;
}
```

## Image processing pipeline

The image pipeline is **Canvas-based** and runs inside a **Web Worker**
(`src/services/image/imageWorker.ts`) using `OffscreenCanvas` where available, with an
automatic main-thread fallback (`WorkerImageProcessingService` → `MainThreadImageProcessingService`).

- **Pixel operations** (`imageOps.ts`) are pure functions over `ImageData` buffers:
  brightness/contrast, grayscale, black & white, sharpen, background cleanup. They are unit
  tested without a canvas.
- **Perspective correction** (`perspective.ts`) computes a homography from four corners and
  warps via inverse mapping + bilinear sampling. The math is unit tested.
- **Edge detection** (`edgeDetection.ts`) is a conservative heuristic returning normalized
  corners or `null`. A `null` result never blocks the user — the UI falls back to full-image
  manual cropping.

**Memory discipline:** captures are normalized to a bounded dimension on import, thumbnails
are generated for lists/strips, PDF pages are re-encoded **one at a time** at the chosen
quality, and object URLs are revoked after use (`useObjectUrl`, `fileActions`). This keeps
25–50 page sessions viable on modest phones.

### Replacing the backend with OpenCV.js

Implement the `ImageProcessingService` interface with an OpenCV.js-backed class and swap it
in `container.ts`. The UI and scan flow are unaffected because they only depend on the
interface.

## Data model

```ts
interface Folder {
  id: string;
  name: string;
  parentFolderId?: string; // reserved for future nested folders
  createdAt: string;
  updatedAt: string;
}

interface StoredDocument {
  id: string;
  folderId: string;
  name: string;            // includes ".pdf"
  pdfBlob: Blob;
  thumbnailImage?: Blob;
  pageCount: number;
  sizeBytes: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;      // set when in trash
}

interface ScanPage {
  id: string;
  originalImage: Blob;     // untouched capture (edits are always reversible)
  processedImage: Blob;    // cropped/adjusted/rotated result used for the PDF
  thumbnailImage?: Blob;
  rotation: 0 | 90 | 180 | 270;
  order: number;
  cropCorners?: DocumentCorners;
  adjustments: ImageAdjustmentOptions;
}

interface ScanSession {
  id: string;
  folderId?: string;
  proposedFilename?: string;
  pages: ScanPage[];
  status: 'capturing' | 'reviewing' | 'saving';
  createdAt: string;
  updatedAt: string;
}
```

`processedImage` has all edits (including rotation) baked in, so PDF generation and previews
use it directly; `originalImage` is retained so crop/adjustments can always be re-derived or
reset.

## IndexedDB schema & migrations

Defined in `src/db/database.ts` using Dexie's versioned schema.

**Version 1**

```
folders:      id, name, parentFolderId, createdAt, updatedAt
documents:    id, folderId, name, isFavorite, deletedAt, createdAt, updatedAt, sizeBytes
scanSessions: id, status, updatedAt
preferences:  id
```

Indexes are chosen for the queries the repositories run (documents by folder, favorite,
deletion state, and sort keys).

### Adding a migration

Append a new version block — **never edit an existing one**:

```ts
this.version(2)
  .stores({ documents: 'id, folderId, name, isFavorite, deletedAt, createdAt, updatedAt, sizeBytes, tags' })
  .upgrade(async (tx) => {
    await tx.table('documents').toCollection().modify((doc) => {
      doc.tags = [];
    });
  });
```

Dexie applies upgrades in order, so existing databases migrate forward automatically.
Migration guarantees (fresh open, seed idempotency, persistence across reopen) are covered
by `src/db/database.migrations.test.ts`.

## PWA & update safety

`vite-plugin-pwa` (Workbox) precaches the app shell so the app loads and functions offline.
The service worker uses a **prompt** update strategy (`registerType: 'prompt'`,
`skipWaiting: false`): a newly deployed worker waits until the user chooses to reload, so a
deploy can never destroy an in-progress scan. `UpdatePrompt` surfaces the reload option.

## Security & privacy

- A strict **Content Security Policy** (in `index.html`) blocks remote scripts and network
  connections; only `self`, `blob:`, and `data:` are permitted where required for workers
  and generated files.
- No network calls are made for app functionality; there is no backend, account, or
  analytics.
- Imported files are validated by type and size; filenames and folder names are sanitized.
- Object URLs are revoked after use to avoid leaking references to sensitive blobs.

## Cloud architecture (future)

Storage is behind repository interfaces. A future release can add cloud backends (Google
Drive, OneDrive, Dropbox, WebDAV, S3) by implementing `DocumentRepository` /
`FolderRepository` against a remote API and composing them (e.g. local-first with
background sync) in `container.ts`. No cloud code ships in the initial release.
