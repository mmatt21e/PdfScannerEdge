import type { PocketScanDatabase } from '@/db/database';
import type { ScanSession } from '@/domain/types';
import type { ScanSessionRepository } from './interfaces';

/**
 * IndexedDB-backed scan-session (draft) repository. A single active draft is expected at a
 * time; the most-recently-updated non-empty session is treated as the resumable draft.
 */
export class DexieScanSessionRepository implements ScanSessionRepository {
  constructor(private readonly db: PocketScanDatabase) {}

  async save(session: ScanSession): Promise<void> {
    await this.db.scanSessions.put(session);
  }

  async getActive(): Promise<ScanSession | undefined> {
    const sessions = await this.db.scanSessions.toArray();
    const withPages = sessions
      .filter((s) => s.pages.length > 0)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return withPages[0];
  }

  async getById(id: string): Promise<ScanSession | undefined> {
    return this.db.scanSessions.get(id);
  }

  async delete(id: string): Promise<void> {
    await this.db.scanSessions.delete(id);
  }

  async pruneAbandoned(maxAgeMs: number): Promise<number> {
    const cutoff = Date.now() - maxAgeMs;
    const sessions = await this.db.scanSessions.toArray();
    const stale = sessions.filter((s) => {
      const updated = new Date(s.updatedAt).getTime();
      return Number.isFinite(updated) && updated < cutoff;
    });
    await this.db.scanSessions.bulkDelete(stale.map((s) => s.id));
    return stale.length;
  }
}
