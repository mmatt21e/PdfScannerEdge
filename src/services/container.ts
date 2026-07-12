// Composition root. Constructs repositories and services once and exposes them as a
// container. Components receive this via ServicesContext and never import IndexedDB or
// browser APIs directly (dependency injection through simple composition).

import { getDatabase, seedDatabase, type PocketScanDatabase } from '@/db/database';
import { DexieFolderRepository } from '@/repositories/FolderRepository';
import { DexieDocumentRepository } from '@/repositories/DocumentRepository';
import { DexieScanSessionRepository } from '@/repositories/ScanSessionRepository';
import { DexiePreferencesRepository } from '@/repositories/PreferencesRepository';
import type {
  FolderRepository,
  DocumentRepository,
  ScanSessionRepository,
  PreferencesRepository,
} from '@/repositories/interfaces';
import { BrowserCameraService, type CameraService } from '@/services/camera/CameraService';
import {
  WorkerImageProcessingService,
  type ImageProcessingService,
} from '@/services/image/ImageProcessingService';
import {
  PdfLibGenerationService,
  type PdfGenerationService,
} from '@/services/pdf/PdfGenerationService';
import { FolderService } from '@/services/FolderService';
import { DocumentService } from '@/services/DocumentService';
import { ScanSessionService } from '@/services/ScanSessionService';
import { StorageService } from '@/services/storage/StorageService';
import { ExportService } from '@/services/ExportService';

export interface Services {
  db: PocketScanDatabase;
  folderRepository: FolderRepository;
  documentRepository: DocumentRepository;
  scanSessionRepository: ScanSessionRepository;
  preferencesRepository: PreferencesRepository;
  camera: CameraService;
  imageProcessing: ImageProcessingService;
  pdf: PdfGenerationService;
  folders: FolderService;
  documents: DocumentService;
  scanSessions: ScanSessionService;
  storage: StorageService;
  exporter: ExportService;
}

export interface CreateServicesOptions {
  db?: PocketScanDatabase;
  maxImageDimension?: number;
}

/** Build a fully wired service container. Tests can pass a fake/in-memory db. */
export function createServices(options: CreateServicesOptions = {}): Services {
  const db = options.db ?? getDatabase();
  const maxImageDimension = options.maxImageDimension ?? 2200;

  const folderRepository = new DexieFolderRepository(db);
  const documentRepository = new DexieDocumentRepository(db);
  const scanSessionRepository = new DexieScanSessionRepository(db);
  const preferencesRepository = new DexiePreferencesRepository(db);

  const camera = new BrowserCameraService();
  const imageProcessing = new WorkerImageProcessingService(maxImageDimension);
  const pdf = new PdfLibGenerationService();

  const folders = new FolderService(folderRepository, documentRepository);
  const documents = new DocumentService(documentRepository, pdf);
  const scanSessions = new ScanSessionService(
    scanSessionRepository,
    imageProcessing,
    maxImageDimension
  );
  const storage = new StorageService();
  const exporter = new ExportService();

  return {
    db,
    folderRepository,
    documentRepository,
    scanSessionRepository,
    preferencesRepository,
    camera,
    imageProcessing,
    pdf,
    folders,
    documents,
    scanSessions,
    storage,
    exporter,
  };
}

/** Initialize the database (seed default folder + preferences) before first use. */
export async function initializeServices(services: Services): Promise<void> {
  await seedDatabase(services.db, new Date().toISOString());
  // Housekeeping: remove abandoned draft scan data past the retention window.
  try {
    await services.scanSessions.pruneAbandoned();
  } catch {
    /* non-fatal */
  }
}
