import Dexie, { type Table } from 'dexie';
import type { Folder, StoredDocument, ScanSession, Preferences } from '@/domain/types';
import { DEFAULT_FOLDER_ID, DEFAULT_FOLDER_NAME, DEFAULT_PREFERENCES } from '@/domain/types';

/**
 * PocketScan's IndexedDB database (via Dexie).
 *
 * Schema versioning:
 *  - v1: initial schema (folders, documents, scanSessions, preferences).
 *
 * When the schema changes, add a new `this.version(n).stores({...}).upgrade(...)` block
 * below. Dexie runs upgrades in order, so old databases migrate forward automatically.
 * Never mutate an existing version block — always append a new one. See
 * `src/db/database.migrations.test.ts` for the migration guarantees under test.
 */
export class PocketScanDatabase extends Dexie {
  folders!: Table<Folder, string>;
  documents!: Table<StoredDocument, string>;
  scanSessions!: Table<ScanSession, string>;
  preferences!: Table<Preferences, string>;

  constructor(name = 'pocketscan') {
    super(name);

    // ---- Version 1 -------------------------------------------------------
    // Indexes are chosen for the queries the repositories actually run:
    //  - documents by folder, favorite, deletion state, and sort keys.
    this.version(1).stores({
      folders: 'id, name, parentFolderId, createdAt, updatedAt',
      documents: 'id, folderId, name, isFavorite, deletedAt, createdAt, updatedAt, sizeBytes',
      scanSessions: 'id, status, updatedAt',
      preferences: 'id',
    });
  }
}

/**
 * Ensure the built-in "Documents" folder and the singleton preferences row exist.
 * Idempotent: safe to call on every startup and after migrations.
 */
export async function seedDatabase(db: PocketScanDatabase, now: string): Promise<void> {
  await db.transaction('rw', db.folders, db.preferences, async () => {
    const existingFolder = await db.folders.get(DEFAULT_FOLDER_ID);
    if (!existingFolder) {
      await db.folders.add({
        id: DEFAULT_FOLDER_ID,
        name: DEFAULT_FOLDER_NAME,
        createdAt: now,
        updatedAt: now,
      });
    }
    const existingPrefs = await db.preferences.get('singleton');
    if (!existingPrefs) {
      await db.preferences.add({ ...DEFAULT_PREFERENCES });
    }
  });
}

let singleton: PocketScanDatabase | undefined;

/** Get (and lazily create) the shared database instance for the running app. */
export function getDatabase(): PocketScanDatabase {
  if (!singleton) {
    singleton = new PocketScanDatabase();
  }
  return singleton;
}
