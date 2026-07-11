// Shared test helpers: build isolated databases and fake scan pages/blobs.
import { PocketScanDatabase, seedDatabase } from '@/db/database';
import type { ScanPage } from '@/domain/types';
import { DEFAULT_ADJUSTMENTS } from '@/domain/types';

let counter = 0;

/** Create a uniquely-named, seeded database for a test. */
export async function makeTestDb(): Promise<PocketScanDatabase> {
  const db = new PocketScanDatabase(`test-${Date.now()}-${counter++}`);
  await db.open();
  await seedDatabase(db, new Date().toISOString());
  return db;
}

/** A small deterministic blob standing in for image/PDF data. */
export function fakeBlob(content = 'x', type = 'image/jpeg'): Blob {
  return new Blob([content], { type });
}

/** Build a fake ScanPage without touching the canvas pipeline. */
export function fakePage(order: number, id = `page-${order}`): ScanPage {
  return {
    id,
    originalImage: fakeBlob(`orig-${order}`),
    processedImage: fakeBlob(`proc-${order}`),
    thumbnailImage: fakeBlob(`thumb-${order}`),
    rotation: 0,
    order,
    adjustments: { ...DEFAULT_ADJUSTMENTS },
  };
}
