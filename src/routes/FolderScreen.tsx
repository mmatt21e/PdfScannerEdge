import { useNavigate, useParams } from 'react-router-dom';
import { DocumentListView } from '@/components/DocumentListView';
import { NewScanButton } from '@/components/NewScanButton';
import { useFolders } from '@/hooks/useLibrary';

export default function FolderScreen() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const folders = useFolders();
  const folder = folders?.find((f) => f.id === folderId);

  return (
    <div>
      <div className="screen-header">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label="Back to folders"
          onClick={() => navigate('/folders')}
        >
          ←
        </button>
        <h1 className="grow">{folder?.name ?? 'Folder'}</h1>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <NewScanButton label="Scan into this folder" folderId={folderId} />
      </div>

      <DocumentListView
        folderId={folderId}
        emptyMessage="This folder is empty. Scan a document to add one."
      />
    </div>
  );
}
