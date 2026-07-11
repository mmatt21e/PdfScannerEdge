import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocumentService, DuplicateNameError, QuotaExceededError } from './DocumentService';
import { DexieDocumentRepository } from '@/repositories/DocumentRepository';
import type { DocumentRepository } from '@/repositories/interfaces';
import type { PdfGenerationService } from './pdf/PdfGenerationService';
import { makeTestDb, fakeBlob, fakePage } from '@/test/helpers';
import { DEFAULT_FOLDER_ID, DEFAULT_PDF_OPTIONS } from '@/domain/types';
import type { PocketScanDatabase } from '@/db/database';

// Stub PDF service so tests don't touch the canvas pipeline.
const stubPdf: PdfGenerationService = {
  async generate() {
    return fakeBlob('%PDF-1.4 generated', 'application/pdf');
  },
  async estimateSize() {
    return 1234;
  },
};

let db: PocketScanDatabase;
let repo: DexieDocumentRepository;
let service: DocumentService;

beforeEach(async () => {
  db = await makeTestDb();
  repo = new DexieDocumentRepository(db);
  service = new DocumentService(repo, stubPdf);
});
afterEach(() => db.close());

const baseInput = () => ({
  pages: [fakePage(0)],
  filenameBase: 'Report',
  folderId: DEFAULT_FOLDER_ID,
  pdfOptions: DEFAULT_PDF_OPTIONS,
});

describe('DocumentService.saveFromScan', () => {
  it('saves a single-page PDF with a .pdf extension', async () => {
    const doc = await service.saveFromScan(baseInput());
    expect(doc.name).toBe('Report.pdf');
    expect(doc.pageCount).toBe(1);
    expect(doc.sizeBytes).toBeGreaterThan(0);
    expect(await repo.getById(doc.id)).toBeDefined();
  });

  it('saves a multi-page PDF', async () => {
    const doc = await service.saveFromScan({
      ...baseInput(),
      pages: [fakePage(0), fakePage(1), fakePage(2)],
    });
    expect(doc.pageCount).toBe(3);
  });

  it('throws DuplicateNameError with the cancel strategy', async () => {
    await service.saveFromScan(baseInput());
    await expect(service.saveFromScan(baseInput())).rejects.toBeInstanceOf(DuplicateNameError);
  });

  it('increments the name with the increment strategy', async () => {
    await service.saveFromScan(baseInput());
    const doc = await service.saveFromScan({ ...baseInput(), duplicateStrategy: 'increment' });
    expect(doc.name).toBe('Report (2).pdf');
  });

  it('replaces the existing document with the replace strategy', async () => {
    const first = await service.saveFromScan(baseInput());
    const second = await service.saveFromScan({ ...baseInput(), duplicateStrategy: 'replace' });
    expect(second.id).not.toBe(first.id);
    expect(await repo.getById(first.id)).toBeUndefined();
    const inFolder = await repo.listByFolder(DEFAULT_FOLDER_ID);
    expect(inFolder).toHaveLength(1);
  });

  it('maps quota errors to a friendly QuotaExceededError', async () => {
    const quotaRepo = {
      ...repo,
      namesInFolder: async () => [],
      create: async () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    } as unknown as DocumentRepository;
    const svc = new DocumentService(quotaRepo, stubPdf);
    await expect(svc.saveFromScan(baseInput())).rejects.toBeInstanceOf(QuotaExceededError);
  });
});
