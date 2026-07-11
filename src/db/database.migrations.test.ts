import { describe, it, expect } from 'vitest';
import { PocketScanDatabase, seedDatabase } from './database';
import { DEFAULT_FOLDER_ID } from '@/domain/types';

describe('database schema & migrations', () => {
  it('opens at version 1 with the expected object stores', async () => {
    const db = new PocketScanDatabase(`mig-${Date.now()}-a`);
    await db.open();
    expect(db.verno).toBe(1);
    const stores = db.tables.map((t) => t.name).sort();
    expect(stores).toEqual(['documents', 'folders', 'preferences', 'scanSessions']);
    db.close();
  });

  it('seeds the default folder and preferences idempotently', async () => {
    const name = `mig-${Date.now()}-b`;
    const db = new PocketScanDatabase(name);
    await db.open();
    const now = new Date().toISOString();
    await seedDatabase(db, now);
    await seedDatabase(db, now); // second call must not duplicate
    expect(await db.folders.count()).toBe(1);
    expect(await db.preferences.count()).toBe(1);
    expect((await db.folders.get(DEFAULT_FOLDER_ID))?.name).toBe('Documents');
    db.close();
  });

  it('persists data across reopen (same database name)', async () => {
    const name = `mig-${Date.now()}-c`;
    const db1 = new PocketScanDatabase(name);
    await db1.open();
    await seedDatabase(db1, new Date().toISOString());
    await db1.folders.add({
      id: 'keep',
      name: 'Keep',
      createdAt: 'x',
      updatedAt: 'x',
    });
    db1.close();

    const db2 = new PocketScanDatabase(name);
    await db2.open();
    expect(await db2.folders.get('keep')).toBeDefined();
    expect(db2.verno).toBe(1);
    db2.close();
  });
});
