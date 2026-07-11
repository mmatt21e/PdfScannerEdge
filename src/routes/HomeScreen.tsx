import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NewScanButton } from '@/components/NewScanButton';
import { ImportButton } from '@/components/ImportButton';
import { DocumentRow } from '@/components/DocumentRow';
import { OnlineIndicator, StorageIndicator } from '@/components/Indicators';
import { useDocuments, useFolders, useActiveDraft } from '@/hooks/useLibrary';
import { useScanFlow } from '@/context/ScanFlowContext';
import type { StoredDocument } from '@/domain/types';

export default function HomeScreen() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const recent = useDocuments({ sortKey: 'createdAt', sortDirection: 'desc' });
  const favorites = useDocuments({
    favoritesOnly: true,
    sortKey: 'updatedAt',
    sortDirection: 'desc',
  });
  const folders = useFolders();
  const draft = useActiveDraft();
  const { resume } = useScanFlow();

  const openDoc = (doc: StoredDocument) => navigate(`/documents/${doc.id}`);

  const filteredRecent = (recent ?? [])
    .filter((d) => (search ? d.name.toLowerCase().includes(search.toLowerCase()) : true))
    .slice(0, 5);

  return (
    <div>
      <div className="screen-header">
        <h1 className="grow">PocketScan</h1>
        <OnlineIndicator />
      </div>

      {draft && draft.pages.length > 0 && (
        <div className="card" role="status" style={{ borderColor: 'var(--primary)' }}>
          <strong>Unfinished scan</strong>
          <p className="text-sm muted" style={{ margin: '0.25rem 0 0.75rem' }}>
            You have a scan in progress with {draft.pages.length} page
            {draft.pages.length === 1 ? '' : 's'}. Resume where you left off.
          </p>
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => {
              resume(draft);
              navigate('/review');
            }}
          >
            Resume scan
          </button>
        </div>
      )}

      <div className="stack" style={{ marginBottom: '1rem' }}>
        <NewScanButton />
        <ImportButton />
      </div>

      <div className="field">
        <label htmlFor="home-search" className="sr-only">
          Search documents
        </label>
        <input
          id="home-search"
          className="input"
          type="search"
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {favorites && favorites.length > 0 && (
        <section aria-labelledby="fav-heading">
          <div className="row spread">
            <h2 id="fav-heading">Favorites</h2>
          </div>
          <ul className="list" style={{ marginBottom: '1rem' }}>
            {favorites.slice(0, 3).map((doc) => (
              <li key={doc.id}>
                <DocumentRow document={doc} onOpen={openDoc} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="recent-heading">
        <div className="row spread">
          <h2 id="recent-heading">Recent</h2>
          <button
            type="button"
            className="btn btn--ghost text-sm"
            onClick={() => navigate('/documents')}
          >
            View all
          </button>
        </div>
        {filteredRecent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true">
              📄
            </div>
            <p>No documents yet. Tap New Scan to create your first PDF.</p>
          </div>
        ) : (
          <ul className="list" style={{ marginBottom: '1rem' }}>
            {filteredRecent.map((doc) => (
              <li key={doc.id}>
                <DocumentRow document={doc} onOpen={openDoc} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="folders-heading">
        <div className="row spread">
          <h2 id="folders-heading">Folders</h2>
          <button
            type="button"
            className="btn btn--ghost text-sm"
            onClick={() => navigate('/folders')}
          >
            Manage
          </button>
        </div>
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          {(folders ?? []).slice(0, 6).map((folder) => (
            <button
              key={folder.id}
              type="button"
              className="folder-card"
              onClick={() => navigate(`/folders/${folder.id}`)}
            >
              <span className="folder-card__icon" aria-hidden="true">
                📁
              </span>
              <span className="doc-row__title">{folder.name}</span>
            </button>
          ))}
        </div>
      </section>

      <StorageIndicator />

      <p className="text-sm muted center">
        🔒 Your scans remain on this device unless you explicitly download or share them.
      </p>
    </div>
  );
}
