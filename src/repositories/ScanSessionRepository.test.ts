import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DexieScanSessionRepository } from './ScanSessionRepository';
import { makeTestDb, fakePage } from '@/test/helpers';
import type { ScanSession } from '@/domain/types';
import { createId } from '@/utils/id';
import type { PocketScanDatabase } from '@/db/database';

let db: PocketScanDatabase;
let repo: DexieScanSessionRepository;

function makeSession(pages: number, updatedAt: string): ScanSession {
  return {
    id: createId(),
    pages: Array.from({ length: pages }, (_, i) => fakePage(i)),
    status: 'reviewing',
    createdAt: updatedAt,
    updatedAt,
  };
}

beforeEach(async () => {
  db = await makeTestDb();
  repo = new DexieScanSessionRepository(db);
});
afterEach(() => db.close());

describe('ScanSessionRepository', () => {
  it('returns the most recently updated non-empty session as active', async () => {
    await repo.save(makeSession(0, '2026-01-01T00:00:00.000Z')); // empty, ignored
    await repo.save(makeSession(2, '2026-01-02T00:00:00.000Z'));
    const newer = makeSession(1, '2026-07-01T00:00:00.000Z');
    await repo.save(newer);
    const active = await repo.getActive();
    expect(active?.id).toBe(newer.id);
  });

  it('deletes sessions', async () => {
    const s = makeSession(1, new Date().toISOString());
    await repo.save(s);
    await repo.delete(s.id);
    expect(await repo.getById(s.id)).toBeUndefined();
  });

  it('prunes sessions older than the retention window', async () => {
    await repo.save(makeSession(1, '2000-01-01T00:00:00.000Z'));
    await repo.save(makeSession(1, new Date().toISOString()));
    const removed = await repo.pruneAbandoned(24 * 60 * 60 * 1000);
    expect(removed).toBe(1);
  });
});
