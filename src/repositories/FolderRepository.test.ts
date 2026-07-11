import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DexieFolderRepository } from './FolderRepository';
import { makeTestDb } from '@/test/helpers';
import { DEFAULT_FOLDER_ID } from '@/domain/types';
import type { PocketScanDatabase } from '@/db/database';

let db: PocketScanDatabase;
let repo: DexieFolderRepository;

beforeEach(async () => {
  db = await makeTestDb();
  repo = new DexieFolderRepository(db);
});
afterEach(() => db.close());

describe('FolderRepository', () => {
  it('starts with the default Documents folder listed first', async () => {
    const folders = await repo.list();
    expect(folders[0]?.id).toBe(DEFAULT_FOLDER_ID);
    expect(folders[0]?.name).toBe('Documents');
  });

  it('creates folders and sorts them after the default', async () => {
    await repo.create('Zebra');
    await repo.create('Alpha');
    const folders = await repo.list();
    expect(folders.map((f) => f.name)).toEqual(['Documents', 'Alpha', 'Zebra']);
  });

  it('prevents duplicate names (case-insensitive)', async () => {
    await repo.create('Receipts');
    await expect(repo.create('receipts')).rejects.toThrow(/already exists/i);
  });

  it('rejects empty names', async () => {
    await expect(repo.create('   ')).rejects.toThrow(/empty/i);
  });

  it('renames folders and still blocks duplicates', async () => {
    const a = await repo.create('A');
    await repo.create('B');
    const renamed = await repo.rename(a.id, 'A2');
    expect(renamed.name).toBe('A2');
    await expect(repo.rename(a.id, 'B')).rejects.toThrow(/already exists/i);
  });

  it('refuses to delete the default folder', async () => {
    await expect(repo.delete(DEFAULT_FOLDER_ID)).rejects.toThrow(/default/i);
  });

  it('deletes a custom folder', async () => {
    const f = await repo.create('Temp');
    await repo.delete(f.id);
    expect(await repo.getById(f.id)).toBeUndefined();
  });
});
