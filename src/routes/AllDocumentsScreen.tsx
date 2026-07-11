import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentListView } from '@/components/DocumentListView';

export default function AllDocumentsScreen() {
  const navigate = useNavigate();
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  return (
    <div>
      <div className="screen-header">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label="Back"
          onClick={() => navigate(-1)}
        >
          ←
        </button>
        <h1 className="grow">All documents</h1>
      </div>

      <div className="chip-group" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="chip"
          aria-pressed={!favoritesOnly}
          onClick={() => setFavoritesOnly(false)}
        >
          All
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly(true)}
        >
          ★ Favorites
        </button>
      </div>

      <DocumentListView
        favoritesOnly={favoritesOnly}
        emptyMessage={favoritesOnly ? 'No favorites yet.' : 'No documents yet.'}
      />
    </div>
  );
}
