import type { PocketScanDatabase } from '@/db/database';
import type { Preferences } from '@/domain/types';
import { DEFAULT_PREFERENCES } from '@/domain/types';
import type { PreferencesRepository } from './interfaces';

/** IndexedDB-backed singleton preferences repository. */
export class DexiePreferencesRepository implements PreferencesRepository {
  constructor(private readonly db: PocketScanDatabase) {}

  async get(): Promise<Preferences> {
    const prefs = await this.db.preferences.get('singleton');
    return prefs ?? { ...DEFAULT_PREFERENCES };
  }

  async update(patch: Partial<Preferences>): Promise<Preferences> {
    const current = await this.get();
    const next: Preferences = { ...current, ...patch, id: 'singleton' };
    await this.db.preferences.put(next);
    return next;
  }
}
