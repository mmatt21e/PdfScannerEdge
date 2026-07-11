import { useLiveQuery } from 'dexie-react-hooks';
import { useServices } from '@/context/ServicesContext';
import type { Folder, StoredDocument, ScanSession } from '@/domain/types';
import type { ListDocumentsQuery } from '@/repositories/interfaces';

/** Reactive list of folders (updates automatically on any folder change). */
export function useFolders(): Folder[] | undefined {
  const { folderRepository, db } = useServices();
  return useLiveQuery(() => folderRepository.list(), [folderRepository, db]);
}

/** Reactive document list for a query. */
export function useDocuments(query: ListDocumentsQuery): StoredDocument[] | undefined {
  const { documentRepository } = useServices();
  return useLiveQuery(
    () => documentRepository.list(query),
    [
      documentRepository,
      query.folderId,
      query.favoritesOnly,
      query.search,
      query.sortKey,
      query.sortDirection,
      query.includeDeleted,
    ]
  );
}

/** Reactive trash list. */
export function useTrash(): StoredDocument[] | undefined {
  const { documentRepository } = useServices();
  return useLiveQuery(() => documentRepository.listTrash(), [documentRepository]);
}

/** Reactive single document. */
export function useDocument(id: string | undefined): StoredDocument | undefined | null {
  const { documentRepository } = useServices();
  return useLiveQuery(
    () => (id ? documentRepository.getById(id) : Promise.resolve(undefined)),
    [documentRepository, id]
  );
}

/** Reactive active (resumable) draft scan session, if any. */
export function useActiveDraft(): ScanSession | undefined {
  const { scanSessionRepository } = useServices();
  return useLiveQuery(() => scanSessionRepository.getActive(), [scanSessionRepository]);
}
