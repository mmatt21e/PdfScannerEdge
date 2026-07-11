# PocketScan — Implementation Plan & Checklist

PocketScan is an **offline-first Progressive Web App** that turns a phone camera into a
multi-page document scanner. It captures pages, processes them locally, and exports
single- or multi-page PDFs that are stored on-device in IndexedDB. No backend is required
and no document ever leaves the device unless the user explicitly downloads or shares it.

## Architecture overview

The app follows a layered architecture with clear separation of concerns. Services and
repositories are constructed once and provided to the React tree through a
`ServicesContext`, so components never import IndexedDB or browser APIs directly.

```
┌──────────────────────────────────────────────────────────────┐
│ UI (routes/*, components/*)                                    │
│   Home · Folders · Scan · Review · Save · Detail · Recent ·    │
│   Trash · Settings + BottomNav / dialogs / toasts              │
├──────────────────────────────────────────────────────────────┤
│ Hooks (useServices, useScanSession, useStorageEstimate, …)     │
├──────────────────────────────────────────────────────────────┤
│ Services (stateless/browser-facing)                            │
│   CameraService · ImageProcessingService (+ Web Worker) ·      │
│   PdfGenerationService · capabilities · pwa update manager     │
├──────────────────────────────────────────────────────────────┤
│ Repositories (persistence)                                     │
│   FolderRepository · DocumentRepository ·                      │
│   ScanSessionRepository · PreferencesRepository                │
├──────────────────────────────────────────────────────────────┤
│ Dexie database (IndexedDB) — versioned schema + migrations     │
└──────────────────────────────────────────────────────────────┘
```

### Key design decisions

- **Image processing is Canvas-based behind an interface.** The `ImageProcessingService`
  interface (`detectDocument`, `cropAndCorrect`, `applyAdjustments`) is implemented with
  the 2D Canvas API running inside a Web Worker (via `OffscreenCanvas` where available,
  with a main-thread fallback). This keeps the bundle small, fully offline, and testable.
  OpenCV.js can be dropped in later behind the same interface without touching the UI —
  see `docs/architecture.md`.
- **Edge detection never blocks.** Automatic detection returns `null` on failure and the
  UI falls back to the full image with manual four-corner cropping.
- **Storage is repository-abstracted.** Cloud backends (Drive/OneDrive/S3/WebDAV) can be
  added later by implementing the same repository interfaces. Not built in phase 1.
- **Drafts are persisted incrementally.** A `ScanSession` is written to IndexedDB after the
  first capture and after every edit, so an interrupted scan can be resumed.
- **Safe SW updates.** `registerType: 'prompt'` + a custom update manager means a new
  service worker never activates mid-scan; the user is prompted to reload.

## Data model (see `src/domain/types.ts`)

`Folder`, `StoredDocument`, `ScanPage`, `ScanSession`, `Preferences`, plus enums for
page size, orientation, quality, and color mode. Schema versions live in `src/db/database.ts`
with Dexie migrations.

## Development phases & checklist

Items are marked complete only after the related code **and** tests pass.

### Phase 1 — Foundation
- [x] Vite + React + TypeScript (strict) + React Router
- [x] ESLint + Prettier + Vitest + Playwright configured
- [x] App shell + responsive bottom navigation
- [x] Web app manifest + service worker (vite-plugin-pwa / Workbox)
- [x] Dexie database with versioned schema + migration test
- [x] Folder + document repositories with a default "Documents" folder
- [x] Capability detection service

### Phase 2 — Capture
- [x] Camera permission handling + denied guidance
- [x] Live rear-camera preview
- [x] Manual shutter capture
- [x] File-input / photo-library import fallback (`capture="environment"`)
- [x] Multi-page capture session + page counter + thumbnail strip
- [x] Retake last page, finish, cancel-with-confirmation
- [x] Torch control (capability-gated)
- [x] Incremental scan-session persistence (draft)

### Phase 3 — Review & processing
- [x] Manual four-corner crop + perspective correction
- [x] Automatic edge detection (heuristic) with safe fallback
- [x] Rotate in 90° increments
- [x] Brightness / contrast / grayscale / B&W / color / sharpen / background cleanup
- [x] Preview before apply + reset-to-original
- [x] Delete / duplicate / replace / retake / add / reorder (drag + buttons)
- [x] Worker-based processing with progress + object-URL cleanup

### Phase 4 — PDF creation
- [x] Single-page PDF (pdf-lib)
- [x] Multi-page PDF preserving aspect ratio
- [x] Page size (Auto/Letter/A4/Legal), orientation, margins
- [x] Quality (Small/Balanced/High) + estimated size
- [x] Filename suggestion, sanitization, `.pdf` suffix
- [x] Duplicate-name handling (replace / increment / cancel)
- [x] Save PDF blob to IndexedDB, open detail screen

### Phase 5 — Library management
- [x] Document viewer (thumbnails, navigation, zoom, full-screen, metadata)
- [x] Search / sort (name/created/modified/size) / filter by folder
- [x] Favorites, recent scans, all documents
- [x] Trash + restore + permanent delete
- [x] Rename / move / duplicate / download / print / share (Web Share + fallback)
- [x] Folder create / rename / delete (empty + confirmed non-empty)
- [x] Storage-usage indicator, low-storage warnings, clear temp data, persist()

### Phase 6 — Hardening
- [x] Unit tests (repositories, services, utils, migrations, trash)
- [x] Playwright primary-workflow e2e test with mocked camera
- [x] Offline behavior + install/update handling
- [x] Accessibility (labels, focus, contrast, reduced motion, 44px targets)
- [x] Privacy information surfaced in-app
- [x] README + architecture docs + backlog

## Testing strategy

- **Unit (Vitest + fake-indexeddb + jsdom):** repositories, folder/document/session logic,
  filename utilities, PDF generation, image adjustments, database migrations, trash/restore.
- **E2E (Playwright, mobile viewport):** the full primary workflow with a mocked
  `getUserMedia`, plus offline-reload persistence.

## Known limitations

- iOS Safari: no torch/exposure control, `navigator.share({files})` support varies, and
  camera requires HTTPS + a user gesture. Fallbacks are provided for each.
- Canvas edge detection is a lightweight heuristic, not a full CV pipeline; manual crop is
  always available.

See `docs/backlog.md` for optional future enhancements (OpenCV.js, cloud sync, OCR, etc.).
