import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DexieDocumentRepository } from './DocumentRepository';
import { makeTestDb, fakeBlob } from '@/test/helpers';
import { DEFAULT_FOLDER_ID, type StoredDocument } from '@/domain/types';
import { createId } from '@/utils/id';
import type { PocketScanDatabase } from '@/db/database';

let db: PocketScanDatabase;
let repo: DexieDocumentRepository;

function makeDoc(partial: Partial<StoredDocument> = {}): StoredDocument {
  const now = new Date().toISOString();
  return {
    id: createId(),
    folderId: DEFAULT_FOLDER_ID,
    name: 'Doc.pdf',
    pdfBlob: fakeBlob('%PDF-1.4', 'application/pdf'),
    pageCount: 1,
    sizeBytes: 100,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

beforeEach(async () => {
  db = await makeTestDb();
  repo = new DexieDocumentRepository(db);
});
afterEach(() => db.close());

describe('DocumentRepository', () => {
  it('creates and reads documents', async () => {
    const doc = makeDoc({ name: 'A.pdf' });
    await repo.create(doc);
    expect((await repo.getById(doc.id))?.name).toBe('A.pdf');
  });

  it('filters by folder and excludes trashed by default', async () => {
    await repo.create(makeDoc({ name: 'keep.pdf' }));
    const trashed = makeDoc({ name: 'gone.pdf' });
    await repo.create(trashed);
    await repo.moveToTrash(trashed.id);

    const inFolder = await repo.listByFolder(DEFAULT_FOLDER_ID);
    expect(inFolder.map((d) => d.name)).toEqual(['keep.pdf']);
    expect((await repo.listTrash()).map((d) => d.name)).toEqual(['gone.pdf']);
  });

  it('sorts by name ascending and size descending', async () => {
    await repo.create(makeDoc({ name: 'b.pdf', sizeBytes: 10 }));
    await repo.create(makeDoc({ name: 'a.pdf', sizeBytes: 30 }));
    const byName = await repo.list({ sortKey: 'name', sortDirection: 'asc' });
    expect(byName.map((d) => d.name)).toEqual(['a.pdf', 'b.pdf']);
    const bySize = await repo.list({ sortKey: 'sizeBytes', sortDirection: 'desc' });
    expect(bySize[0]?.sizeBytes).toBe(30);
  });

  it('searches by name', async () => {
    await repo.create(makeDoc({ name: 'Invoice March.pdf' }));
    await repo.create(makeDoc({ name: 'Recipe.pdf' }));
    const results = await repo.list({ search: 'invoice' });
    expect(results).toHaveLength(1);
  });

  it('restores from trash and empties trash', async () => {
    const doc = makeDoc();
    await repo.create(doc);
    await repo.moveToTrash(doc.id);
    await repo.restore(doc.id);
    expect((await repo.getById(doc.id))?.deletedAt).toBeUndefined();

    const doc2 = makeDoc();
    await repo.create(doc2);
    await repo.moveToTrash(doc2.id);
    await repo.emptyTrash();
    expect(await repo.getById(doc2.id)).toBeUndefined();
  });

  it('moves documents between folders', async () => {
    const doc = makeDoc();
    await repo.create(doc);
    await repo.move(doc.id, 'other-folder');
    expect((await repo.getById(doc.id))?.folderId).toBe('other-folder');
  });

  it('duplicates with an incremented, non-favorite copy', async () => {
    const doc = makeDoc({ name: 'Report.pdf', isFavorite: true });
    await repo.create(doc);
    const copy = await repo.duplicate(doc.id, 'Report');
    expect(copy.name).toBe('Report (2).pdf');
    expect(copy.isFavorite).toBe(false);
    expect(copy.id).not.toBe(doc.id);
  });

  it('toggles favorite and lists names in folder', async () => {
    const doc = makeDoc({ name: 'Fav.pdf' });
    await repo.create(doc);
    await repo.setFavorite(doc.id, true);
    expect((await repo.getById(doc.id))?.isFavorite).toBe(true);
    expect(await repo.namesInFolder(DEFAULT_FOLDER_ID)).toContain('Fav.pdf');
  });

  it('counts non-deleted documents in a folder', async () => {
    await repo.create(makeDoc());
    const trashed = makeDoc();
    await repo.create(trashed);
    await repo.moveToTrash(trashed.id);
    expect(await repo.countByFolder(DEFAULT_FOLDER_ID)).toBe(1);
  });
});
