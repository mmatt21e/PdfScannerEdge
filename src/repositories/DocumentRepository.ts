import type { PocketScanDatabase } from '@/db/database';
import type { StoredDocument } from '@/domain/types';
import { createId } from '@/utils/id';
import { incrementFilename, ensurePdfExtension, stripPdfExtension } from '@/utils/filename';
import type { DocumentRepository, ListDocumentsQuery } from './interfaces';

/** IndexedDB-backed document repository, including trash/restore and library queries. */
export class DexieDocumentRepository implements DocumentRepository {
  constructor(private readonly db: PocketScanDatabase) {}

  private now(): string {
    return new Date().toISOString();
  }

  async create(document: StoredDocument): Promise<string> {
    await this.db.documents.add(document);
    return document.id;
  }

  async update(document: StoredDocument): Promise<void> {
    await this.db.documents.put({ ...document, updatedAt: this.now() });
  }

  async getById(id: string): Promise<StoredDocument | undefined> {
    return this.db.documents.get(id);
  }

  async listByFolder(folderId: string): Promise<StoredDocument[]> {
    return this.list({ folderId });
  }

  async list(query: ListDocumentsQuery = {}): Promise<StoredDocument[]> {
    const {
      folderId,
      favoritesOnly,
      search,
      sortKey = 'createdAt',
      sortDirection = 'desc',
      includeDeleted = false,
    } = query;

    let docs = await this.db.documents.toArray();

    docs = docs.filter((d) => (includeDeleted ? true : !d.deletedAt));
    if (folderId) {
      docs = docs.filter((d) => d.folderId === folderId);
    }
    if (favoritesOnly) {
      docs = docs.filter((d) => d.isFavorite);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      docs = docs.filter((d) => d.name.toLowerCase().includes(q));
    }

    const dir = sortDirection === 'asc' ? 1 : -1;
    docs.sort((a, b) => {
      let cmp: number;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'sizeBytes':
          cmp = a.sizeBytes - b.sizeBytes;
          break;
        case 'updatedAt':
          cmp = a.updatedAt.localeCompare(b.updatedAt);
          break;
        case 'createdAt':
        default:
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
      }
      return cmp * dir;
    });

    return docs;
  }

  async moveToTrash(id: string): Promise<void> {
    const doc = await this.db.documents.get(id);
    if (!doc) return;
    await this.db.documents.put({ ...doc, deletedAt: this.now(), updatedAt: this.now() });
  }

  async restore(id: string): Promise<void> {
    const doc = await this.db.documents.get(id);
    if (!doc) return;
    const restored = { ...doc, updatedAt: this.now() };
    delete restored.deletedAt;
    await this.db.documents.put(restored);
  }

  async listTrash(): Promise<StoredDocument[]> {
    const docs = await this.db.documents.toArray();
    return docs
      .filter((d) => !!d.deletedAt)
      .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));
  }

  async delete(id: string): Promise<void> {
    await this.db.documents.delete(id);
  }

  async emptyTrash(): Promise<void> {
    const trashed = await this.listTrash();
    await this.db.documents.bulkDelete(trashed.map((d) => d.id));
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    const doc = await this.db.documents.get(id);
    if (!doc) return;
    await this.db.documents.put({ ...doc, isFavorite: favorite, updatedAt: this.now() });
  }

  async move(id: string, folderId: string): Promise<void> {
    const doc = await this.db.documents.get(id);
    if (!doc) return;
    await this.db.documents.put({ ...doc, folderId, updatedAt: this.now() });
  }

  async rename(id: string, name: string): Promise<void> {
    const doc = await this.db.documents.get(id);
    if (!doc) return;
    await this.db.documents.put({
      ...doc,
      name: ensurePdfExtension(name),
      updatedAt: this.now(),
    });
  }

  async duplicate(id: string, newName: string): Promise<StoredDocument> {
    const doc = await this.db.documents.get(id);
    if (!doc) {
      throw new Error('Document not found.');
    }
    const existing = await this.namesInFolder(doc.folderId);
    const base = incrementFilename(stripPdfExtension(newName), existing);
    const now = this.now();
    const copy: StoredDocument = {
      ...doc,
      id: createId(),
      name: ensurePdfExtension(base),
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    };
    delete copy.deletedAt;
    await this.db.documents.add(copy);
    return copy;
  }

  async namesInFolder(folderId: string, excludeId?: string): Promise<string[]> {
    const docs = await this.db.documents.toArray();
    return docs
      .filter((d) => d.folderId === folderId && !d.deletedAt && d.id !== excludeId)
      .map((d) => d.name);
  }

  async countByFolder(folderId: string): Promise<number> {
    const docs = await this.db.documents.toArray();
    return docs.filter((d) => d.folderId === folderId && !d.deletedAt).length;
  }
}
