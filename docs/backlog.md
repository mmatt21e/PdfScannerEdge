# PocketScan — Optional Future Enhancements

The initial release is fully usable offline with no backend. The following are optional,
intentionally deferred enhancements. They are ordered roughly by value/effort.

## Image processing
- **OpenCV.js backend** for `ImageProcessingService`: robust contour-based edge detection,
  higher-quality perspective correction, adaptive thresholding for B&W.
- Auto-orientation detection from text/line analysis.
- Per-region shadow removal and glare reduction.
- On-device **OCR** (e.g. Tesseract.js) to produce searchable PDFs and text extraction.

## Capture
- Auto-capture quality gates (blur/exposure checks before firing).
- Multi-crop: detect several documents/receipts in one frame.
- Barcode/QR detection during capture.

## PDF & export
- True in-app **PDF page thumbnails/zoom** via `pdfjs-dist` (current viewer uses the
  browser's native PDF rendering with download/print fallback).
- Password-protected / encrypted PDFs.
- Export to image (PNG/JPEG) and combine/split existing PDFs.
- Page number and date stamping / watermarks.

## Organization
- **Nested folders** (the data model already carries `parentFolderId`).
- Tags and saved smart filters.
- Bulk actions (multi-select move/delete/share).

## Sync & accounts (separate optional phase)
- Cloud backends behind the repository interfaces: Google Drive, OneDrive, Dropbox,
  WebDAV, S3-compatible storage.
- Optional accounts with **end-to-end encrypted** sync.
- Conflict resolution and background sync when returning online.

## Platform & UX
- Share-target / file-handler registration so PocketScan can receive shared images.
- Localization (i18n) and RTL support.
- Configurable retention policy for drafts and trash.
- Haptic feedback and richer gesture support (with non-gesture alternatives retained).

## Quality & tooling
- Visual regression tests for the editor and viewer.
- Performance budget checks and a 50-page stress test in CI.
- Lighthouse PWA/accessibility audits in CI.
