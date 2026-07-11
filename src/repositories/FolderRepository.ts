import type { PocketScanDatabase } from '@/db/database';
import type { Folder } from '@/domain/types';
import { DEFAULT_FOLDER_ID } from '@/domain/types';
import { createId } from '@/utils/id';
import type { FolderRepository } from './interfaces';

/** IndexedDB-backed folder repository. Enforces unique names at the same level. */
export class DexieFolderRepository implements FolderRepository {
  constructor(private readonly db: PocketScanDatabase) {}

  private now(): string {
    return new Date().toISOString();
  }

  async create(name: string): Promise<Folder> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Folder name cannot be empty.');
    }
    if (trimmed.length > 80) {
      throw new Error('Folder name is too long (maximum 80 characters).');
    }
    if (await this.nameExists(trimmed)) {
      throw new Error(`A folder named "${trimmed}" already exists.`);
    }
    const now = this.now();
    const folder: Folder = {
      id: createId(),
      name: trimmed,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.folders.add(folder);
    return folder;
  }

  async rename(id: string, name: string): Promise<Folder> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Folder name cannot be empty.');
    }
    const folder = await this.db.folders.get(id);
    if (!folder) {
      throw new Error('Folder not found.');
    }
    if (await this.nameExists(trimmed, id)) {
      throw new Error(`A folder named "${trimmed}" already exists.`);
    }
    const updated: Folder = { ...folder, name: trimmed, updatedAt: this.now() };
    await this.db.folders.put(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (id === DEFAULT_FOLDER_ID) {
      throw new Error('The default Documents folder cannot be deleted.');
    }
    // Documents in the folder are moved to the default folder by the FolderService;
    // this low-level method only removes the folder record.
    await this.db.folders.delete(id);
  }

  async getById(id: string): Promise<Folder | undefined> {
    return this.db.folders.get(id);
  }

  async list(): Promise<Folder[]> {
    const folders = await this.db.folders.toArray();
    // Default folder first, then alphabetical.
    return folders.sort((a, b) => {
      if (a.id === DEFAULT_FOLDER_ID) return -1;
      if (b.id === DEFAULT_FOLDER_ID) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  async nameExists(name: string, excludeId?: string): Promise<boolean> {
    const target = name.trim().toLowerCase();
    const all = await this.db.folders.toArray();
    return all.some((f) => f.id !== excludeId && f.name.toLowerCase() === target);
  }
}
