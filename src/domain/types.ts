// Core domain models for PocketScan. These are the single source of truth shared by
// repositories, services, and UI. Persisted shapes live in IndexedDB via Dexie.

/** A point in normalized image coordinates (0..1) so corners survive resizing. */
export interface Point {
  x: number;
  y: number;
}

/** Four detected/adjusted document corners, clockwise from top-left, normalized 0..1. */
export interface DocumentCorners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export type Rotation = 0 | 90 | 180 | 270;

export type ColorMode = 'color' | 'grayscale' | 'bw';

/** Per-page image adjustments. All values are normalized so they are easy to reset. */
export interface ImageAdjustmentOptions {
  colorMode: ColorMode;
  /** -100..100, 0 = unchanged */
  brightness: number;
  /** -100..100, 0 = unchanged */
  contrast: number;
  /** 0..100, higher = sharper */
  sharpen: number;
  /** Reduce shadows / clean background (0..100) */
  backgroundCleanup: number;
  /** Black-and-white threshold used when colorMode === 'bw' (0..255) */
  bwThreshold: number;
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustmentOptions = {
  colorMode: 'color',
  brightness: 0,
  contrast: 0,
  sharpen: 0,
  backgroundCleanup: 0,
  bwThreshold: 128,
};

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

/** A single captured page inside a scan session. */
export interface ScanPage {
  id: string;
  /** The untouched capture — kept so edits are always reversible. */
  originalImage: Blob;
  /** The processed (cropped/adjusted/rotated) image used for the PDF. */
  processedImage: Blob;
  /** Small thumbnail for strips and lists. */
  thumbnailImage?: Blob;
  rotation: Rotation;
  order: number;
  cropCorners?: DocumentCorners;
  adjustments: ImageAdjustmentOptions;
}

export type ScanSessionStatus = 'capturing' | 'reviewing' | 'saving';

export interface ScanSession {
  id: string;
  folderId?: string;
  proposedFilename?: string;
  pages: ScanPage[];
  status: ScanSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  /** Reserved for future nested folders; the initial release keeps a single level. */
  parentFolderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredDocument {
  id: string;
  folderId: string;
  name: string;
  pdfBlob: Blob;
  /** A rendered first-page thumbnail for library lists. */
  thumbnailImage?: Blob;
  pageCount: number;
  sizeBytes: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  /** ISO date if the document is in the trash; undefined otherwise. */
  deletedAt?: string;
}

// ---- PDF generation options -------------------------------------------------

export type PageSize = 'auto' | 'letter' | 'a4' | 'legal';
export type PageOrientation = 'auto' | 'portrait' | 'landscape';
export type PdfQuality = 'small' | 'balanced' | 'high';
export type MarginSize = 'none' | 'small' | 'medium' | 'large';

export interface PdfGenerationOptions {
  pageSize: PageSize;
  orientation: PageOrientation;
  quality: PdfQuality;
  margin: MarginSize;
}

export const DEFAULT_PDF_OPTIONS: PdfGenerationOptions = {
  pageSize: 'auto',
  orientation: 'auto',
  quality: 'balanced',
  margin: 'small',
};

// ---- Preferences ------------------------------------------------------------

export type DocumentSortKey = 'name' | 'createdAt' | 'updatedAt' | 'sizeBytes';
export type SortDirection = 'asc' | 'desc';

export interface Preferences {
  id: 'singleton';
  autoCapture: boolean;
  defaultColorMode: ColorMode;
  defaultPdfOptions: PdfGenerationOptions;
  maxImageDimension: number;
  sortKey: DocumentSortKey;
  sortDirection: SortDirection;
  /** Whether the user has dismissed the privacy notice. */
  privacyAcknowledged: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  id: 'singleton',
  autoCapture: false,
  defaultColorMode: 'color',
  defaultPdfOptions: DEFAULT_PDF_OPTIONS,
  maxImageDimension: 2200,
  sortKey: 'createdAt',
  sortDirection: 'desc',
  privacyAcknowledged: false,
};

/** Identifier of the built-in default folder that always exists. */
export const DEFAULT_FOLDER_ID = 'default-documents';
export const DEFAULT_FOLDER_NAME = 'Documents';
