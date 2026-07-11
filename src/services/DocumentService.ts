import type { StoredDocument, ScanPage, PdfGenerationOptions } from '@/domain/types';
import type { DocumentRepository } from '@/repositories/interfaces';
import type { PdfGenerationService } from '@/services/pdf/PdfGenerationService';
import { firstPageThumbnail } from '@/services/pdf/PdfGenerationService';
import { StorageService } from '@/services/storage/StorageService';
import { createId } from '@/utils/id';
import {
  ensurePdfExtension,
  incrementFilename,
  isDuplicateName,
  sanitizeFilenameBase,
  stripPdfExtension,
} from '@/utils/filename';

export type DuplicateStrategy = 'replace' | 'increment' | 'cancel';

export interface SaveDocumentInput {
  pages: ScanPage[];
  filenameBase: string;
  folderId: string;
  pdfOptions: PdfGenerationOptions;
  duplicateStrategy?: DuplicateStrategy;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export class DuplicateNameError extends Error {
  constructor(public readonly existingName: string) {
    super(`A document named "${existingName}" already exists in this folder.`);
    this.name = 'DuplicateNameError';
  }
}

export class QuotaExceededError extends Error {
  constructor() {
    super(
      'There is not enough storage space to save this PDF. Free up space or export existing documents, then try again. Your scan is still safe.'
    );
    this.name = 'QuotaExceededError';
  }
}

/** Orchestrates PDF generation + persistence and library actions on saved documents. */
export class DocumentService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly pdf: PdfGenerationService
  ) {}

  /**
   * Generate a PDF from scan pages and store it. Handles duplicate names according to the
   * chosen strategy and surfaces quota errors without losing the caller's data.
   */
  async saveFromScan(input: SaveDocumentInput): Promise<StoredDocument> {
    const { pages, folderId, pdfOptions, duplicateStrategy = 'cancel', onProgress, signal } = input;
    if (pages.length === 0) {
      throw new Error('There are no pages to save.');
    }

    const existingNames = await this.documents.namesInFolder(folderId);
    let base = sanitizeFilenameBase(input.filenameBase);

    if (isDuplicateName(base, existingNames)) {
      if (duplicateStrategy === 'cancel') {
        throw new DuplicateNameError(ensurePdfExtension(base));
      }
      if (duplicateStrategy === 'increment') {
        base = incrementFilename(base, existingNames);
      }
      // 'replace' keeps the same base; the existing doc is trashed below.
    }

    const name = ensurePdfExtension(base);
    const pdfBlob = await this.pdf.generate(pages, pdfOptions, onProgress, signal);
    const thumb = await firstPageThumbnail(pages);
    const now = new Date().toISOString();

    const doc: StoredDocument = {
      id: createId(),
      folderId,
      name,
      pdfBlob,
      thumbnailImage: thumb,
      pageCount: pages.length,
      sizeBytes: pdfBlob.size,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      if (duplicateStrategy === 'replace') {
        const clash = (await this.documents.namesInFolder(folderId)).find(
          (n) => stripPdfExtension(n).toLowerCase() === base.toLowerCase()
        );
        if (clash) {
          const all = await this.documents.listByFolder(folderId);
          const target = all.find((d) => d.name.toLowerCase() === clash.toLowerCase());
          if (target) {
            await this.documents.delete(target.id);
          }
        }
      }
      await this.documents.create(doc);
    } catch (err) {
      if (StorageService.isQuotaError(err)) {
        throw new QuotaExceededError();
      }
      throw err;
    }
    return doc;
  }

  getById(id: string): Promise<StoredDocument | undefined> {
    return this.documents.getById(id);
  }
  list(...args: Parameters<DocumentRepository['list']>) {
    return this.documents.list(...args);
  }
  listTrash() {
    return this.documents.listTrash();
  }
  moveToTrash(id: string) {
    return this.documents.moveToTrash(id);
  }
  restore(id: string) {
    return this.documents.restore(id);
  }
  emptyTrash() {
    return this.documents.emptyTrash();
  }
  permanentlyDelete(id: string) {
    return this.documents.delete(id);
  }
  setFavorite(id: string, favorite: boolean) {
    return this.documents.setFavorite(id, favorite);
  }
  move(id: string, folderId: string) {
    return this.documents.move(id, folderId);
  }
  rename(id: string, name: string) {
    return this.documents.rename(id, name);
  }
  duplicate(id: string, newName: string) {
    return this.documents.duplicate(id, newName);
  }
}
