import { useNavigate } from 'react-router-dom';
import { useServices } from '@/context/ServicesContext';
import { useToast } from '@/context/ToastContext';
import { useDialogs } from '@/context/DialogsContext';
import { useTrash } from '@/hooks/useLibrary';
import { formatBytes } from '@/services/storage/StorageService';

export default function TrashScreen() {
  const navigate = useNavigate();
  const { documents } = useServices();
  const { show } = useToast();
  const { confirm } = useDialogs();
  const trash = useTrash();

  const emptyTrash = async () => {
    const ok = await confirm({
      title: 'Empty trash?',
      message: 'All documents in the trash will be permanently deleted. This cannot be undone.',
      confirmLabel: 'Permanently delete',
      danger: true,
    });
    if (ok) {
      await documents.emptyTrash();
      show('Trash emptied.', 'info');
    }
  };

  const permanentlyDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete permanently?',
      message: `"${name}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete permanently',
      danger: true,
    });
    if (ok) {
      await documents.permanentlyDelete(id);
      show('Deleted permanently.', 'info');
    }
  };

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
        <h1 className="grow">Trash</h1>
        {trash && trash.length > 0 && (
          <button type="button" className="btn btn--danger" onClick={emptyTrash}>
            Empty
          </button>
        )}
      </div>

      {trash === undefined ? (
        <div className="full-spinner">
          <span className="spinner" role="status" aria-label="Loading" />
        </div>
      ) : trash.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden="true">
            🗑️
          </div>
          <p>Trash is empty.</p>
        </div>
      ) : (
        <ul className="list">
          {trash.map((doc) => (
            <li key={doc.id} className="doc-row" style={{ cursor: 'default' }}>
              <span className="doc-row__thumb" aria-hidden="true">
                📄
              </span>
              <span className="doc-row__body">
                <span className="doc-row__title">{doc.name}</span>
                <span className="doc-row__meta">
                  {doc.pageCount} page{doc.pageCount === 1 ? '' : 's'} ·{' '}
                  {formatBytes(doc.sizeBytes)}
                </span>
              </span>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  aria-label={`Restore ${doc.name}`}
                  onClick={async () => {
                    await documents.restore(doc.id);
                    show('Restored.', 'success');
                  }}
                >
                  ♻
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  aria-label={`Permanently delete ${doc.name}`}
                  onClick={() => permanentlyDelete(doc.id, doc.name)}
                >
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
