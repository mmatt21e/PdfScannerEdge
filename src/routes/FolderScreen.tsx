import { useNavigate, useParams } from 'react-router-dom';
import { DocumentListView } from '@/components/DocumentListView';
import { NewScanButton } from '@/components/NewScanButton';
import { useDocuments, useFolders } from '@/hooks/useLibrary';
import { useServices } from '@/context/ServicesContext';
import { useToast } from '@/context/ToastContext';
import { exportOutcomeMessage } from '@/utils/exportMessages';

export default function FolderScreen() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const folders = useFolders();
  const folder = folders?.find((f) => f.id === folderId);
  const { exporter } = useServices();
  const { show } = useToast();
  const docs = useDocuments({ folderId, sortKey: 'createdAt', sortDirection: 'desc' });

  const onExportFolder = async () => {
    if (!docs || docs.length === 0) {
      show('This folder has no documents to export.', 'info');
      return;
    }
    const outcome = await exporter.exportFolder(folder?.name ?? 'Documents', docs);
    const msg = exportOutcomeMessage(outcome, docs.length);
    if (msg) show(msg.text, msg.kind);
  };

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
        {docs && docs.length > 0 && (
          <button type="button" className="btn" onClick={onExportFolder}>
            📤 Export
          </button>
        )}
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
