import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FolderService } from './FolderService';
import { DexieFolderRepository } from '@/repositories/FolderRepository';
import { DexieDocumentRepository } from '@/repositories/DocumentRepository';
import { makeTestDb, fakeBlob } from '@/test/helpers';
import { DEFAULT_FOLDER_ID } from '@/domain/types';
import { createId } from '@/utils/id';
import type { PocketScanDatabase } from '@/db/database';

let db: PocketScanDatabase;
let service: FolderService;
let docs: DexieDocumentRepository;

beforeEach(async () => {
  db = await makeTestDb();
  docs = new DexieDocumentRepository(db);
  service = new FolderService(new DexieFolderRepository(db), docs);
});
afterEach(() => db.close());

async function addDocTo(folderId: string) {
  const now = new Date().toISOString();
  await docs.create({
    id: createId(),
    folderId,
    name: 'D.pdf',
    pdfBlob: fakeBlob('%PDF', 'application/pdf'),
    pageCount: 1,
    sizeBytes: 10,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  });
}

describe('FolderService', () => {
  it('deletes an empty folder directly', async () => {
    const f = await service.create('Empty');
    await service.delete(f.id);
    expect(await service.getById(f.id)).toBeUndefined();
  });

  it('refuses to delete a non-empty folder without force', async () => {
    const f = await service.create('Full');
    await addDocTo(f.id);
    await expect(service.delete(f.id)).rejects.toThrow(/contains/i);
  });

  it('moves documents to the default folder when force-deleting', async () => {
    const f = await service.create('Full');
    await addDocTo(f.id);
    await service.delete(f.id, true);
    expect(await service.getById(f.id)).toBeUndefined();
    expect(await docs.countByFolder(DEFAULT_FOLDER_ID)).toBe(1);
  });

  it('never deletes the default folder', async () => {
    await expect(service.delete(DEFAULT_FOLDER_ID, true)).rejects.toThrow(/default/i);
  });
});
