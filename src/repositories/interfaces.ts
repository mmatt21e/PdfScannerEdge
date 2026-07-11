import type {
  Folder,
  StoredDocument,
  ScanSession,
  Preferences,
  DocumentSortKey,
  SortDirection,
} from '@/domain/types';

/**
 * Persistence contracts. Everything the app persists goes through these interfaces so the
 * IndexedDB implementation can be swapped (e.g. for a cloud-backed repository) later.
 */

export interface FolderRepository {
  create(name: string): Promise<Folder>;
  rename(id: string, name: string): Promise<Folder>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Folder | undefined>;
  list(): Promise<Folder[]>;
  /** True if a folder with this name (case-insensitive) already exists. */
  nameExists(name: string, excludeId?: string): Promise<boolean>;
}

export interface ListDocumentsQuery {
  folderId?: string;
  favoritesOnly?: boolean;
  search?: string;
  sortKey?: DocumentSortKey;
  sortDirection?: SortDirection;
  /** Include trashed documents. Defaults to false. */
  includeDeleted?: boolean;
}

export interface DocumentRepository {
  create(document: StoredDocument): Promise<string>;
  update(document: StoredDocument): Promise<void>;
  getById(id: string): Promise<StoredDocument | undefined>;
  listByFolder(folderId: string): Promise<StoredDocument[]>;
  list(query?: ListDocumentsQuery): Promise<StoredDocument[]>;
  /** Soft-delete: move to trash. */
  moveToTrash(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  listTrash(): Promise<StoredDocument[]>;
  /** Hard-delete from the database. */
  delete(id: string): Promise<void>;
  emptyTrash(): Promise<void>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  move(id: string, folderId: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  duplicate(id: string, newName: string): Promise<StoredDocument>;
  /** Names (with .pdf) currently used in a folder, for duplicate detection. */
  namesInFolder(folderId: string, excludeId?: string): Promise<string[]>;
  countByFolder(folderId: string): Promise<number>;
}

export interface ScanSessionRepository {
  save(session: ScanSession): Promise<void>;
  getActive(): Promise<ScanSession | undefined>;
  getById(id: string): Promise<ScanSession | undefined>;
  delete(id: string): Promise<void>;
  /** Remove abandoned draft sessions older than `maxAgeMs`. Returns count removed. */
  pruneAbandoned(maxAgeMs: number): Promise<number>;
}

export interface PreferencesRepository {
  get(): Promise<Preferences>;
  update(patch: Partial<Preferences>): Promise<Preferences>;
}
