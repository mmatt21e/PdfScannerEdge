import type { Folder } from '@/domain/types';
import { DEFAULT_FOLDER_ID } from '@/domain/types';
import type { FolderRepository, DocumentRepository } from '@/repositories/interfaces';

/** Coordinates folder operations that also touch documents (e.g. deleting a folder). */
export class FolderService {
  constructor(
    private readonly folders: FolderRepository,
    private readonly documents: DocumentRepository
  ) {}

  list(): Promise<Folder[]> {
    return this.folders.list();
  }

  getById(id: string): Promise<Folder | undefined> {
    return this.folders.getById(id);
  }

  create(name: string): Promise<Folder> {
    return this.folders.create(name);
  }

  rename(id: string, name: string): Promise<Folder> {
    return this.folders.rename(id, name);
  }

  /** Count of non-deleted documents in a folder. */
  documentCount(folderId: string): Promise<number> {
    return this.documents.countByFolder(folderId);
  }

  /**
   * Delete a folder. Empty folders delete directly. Non-empty folders require
   * `force: true` (the UI confirms first); their documents are moved to the default
   * Documents folder rather than destroyed.
   */
  async delete(id: string, force = false): Promise<void> {
    if (id === DEFAULT_FOLDER_ID) {
      throw new Error('The default Documents folder cannot be deleted.');
    }
    const count = await this.documents.countByFolder(id);
    if (count > 0 && !force) {
      throw new Error(
        `This folder contains ${count} document${count === 1 ? '' : 's'}. Confirm to move them to Documents and delete the folder.`
      );
    }
    if (count > 0) {
      const docs = await this.documents.listByFolder(id);
      for (const doc of docs) {
        await this.documents.move(doc.id, DEFAULT_FOLDER_ID);
      }
    }
    await this.folders.delete(id);
  }
}
