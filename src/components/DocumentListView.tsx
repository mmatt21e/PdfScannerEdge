import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentRow } from '@/components/DocumentRow';
import { useDocuments } from '@/hooks/useLibrary';
import type { DocumentSortKey, SortDirection, StoredDocument } from '@/domain/types';

const SORTS: { key: DocumentSortKey; label: string }[] = [
  { key: 'createdAt', label: 'Date created' },
  { key: 'updatedAt', label: 'Date modified' },
  { key: 'name', label: 'Name' },
  { key: 'sizeBytes', label: 'Size' },
];

/** Search + sort + list of documents for a given base query (folder, favorites, etc.). */
export function DocumentListView({
  folderId,
  favoritesOnly,
  emptyMessage = 'No documents yet.',
  showControls = true,
}: {
  folderId?: string;
  favoritesOnly?: boolean;
  emptyMessage?: string;
  showControls?: boolean;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<DocumentSortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const docs = useDocuments({ folderId, favoritesOnly, search, sortKey, sortDirection });
  const openDoc = (doc: StoredDocument) => navigate(`/documents/${doc.id}`);

  return (
    <div>
      {showControls && (
        <div className="stack" style={{ marginBottom: '1rem' }}>
          <input
            className="input"
            type="search"
            placeholder="Search…"
            aria-label="Search documents"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="row" style={{ gap: '0.5rem' }}>
            <label htmlFor="sort-key" className="sr-only">
              Sort by
            </label>
            <select
              id="sort-key"
              className="select grow"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as DocumentSortKey)}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              aria-label={`Sort direction: ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
              onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      )}

      {docs === undefined ? (
        <div className="full-spinner">
          <span className="spinner" role="status" aria-label="Loading" />
        </div>
      ) : docs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden="true">
            📄
          </div>
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <ul className="list">
          {docs.map((doc) => (
            <li key={doc.id}>
              <DocumentRow document={doc} onOpen={openDoc} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
