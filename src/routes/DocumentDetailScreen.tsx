import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServices } from '@/context/ServicesContext';
import { useToast } from '@/context/ToastContext';
import { useDialogs } from '@/context/DialogsContext';
import { useDocument, useFolders } from '@/hooks/useLibrary';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { Dialog } from '@/components/Dialog';
import { FolderSelect } from '@/components/FolderSelect';
import { formatBytes } from '@/services/storage/StorageService';
import { getCapabilities } from '@/services/capabilities';
import { downloadBlob, printPdf, sharePdf } from '@/utils/fileActions';
import { stripPdfExtension } from '@/utils/filename';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export default function DocumentDetailScreen() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { documents } = useServices();
  const { show } = useToast();
  const { confirm, prompt } = useDialogs();
  const doc = useDocument(documentId);
  const folders = useFolders();

  const pdfUrl = useObjectUrl(doc?.pdfBlob);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string>('');

  if (doc === undefined) {
    return (
      <div className="full-spinner">
        <span className="spinner" role="status" aria-label="Loading" />
      </div>
    );
  }
  if (doc === null) {
    return (
      <div className="empty-state">
        <p>This document could not be found.</p>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
          Go home
        </button>
      </div>
    );
  }

  const caps = getCapabilities();
  const folderName = folders?.find((f) => f.id === doc.folderId)?.name ?? 'Documents';

  const onRename = async () => {
    const name = await prompt({
      title: 'Rename document',
      label: 'Document name',
      initialValue: stripPdfExtension(doc.name),
      confirmLabel: 'Rename',
      validate: (v) => (v.trim() ? null : 'Please enter a name.'),
    });
    if (name) {
      await documents.rename(doc.id, name);
      show('Renamed.', 'success');
    }
  };

  const onDuplicate = async () => {
    const copy = await documents.duplicate(doc.id, stripPdfExtension(doc.name));
    show('Duplicated.', 'success');
    navigate(`/documents/${copy.id}`, { replace: true });
  };

  const onDownload = () => {
    downloadBlob(doc.pdfBlob, doc.name);
    show('Download started.', 'info');
  };

  const onShare = async () => {
    const result = await sharePdf(doc.pdfBlob, doc.name, doc.name);
    if (result === 'unsupported') {
      show('Sharing files is not supported here. Use Download instead.', 'info');
      onDownload();
    } else if (result === 'failed') {
      show('Sharing failed. Try downloading instead.', 'error');
    }
  };

  const onPrint = () => {
    if (!printPdf(doc.pdfBlob)) {
      show('Printing is unavailable. Downloading instead.', 'info');
      onDownload();
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Move to trash?',
      message: `"${doc.name}" will be moved to the trash. You can restore it later.`,
      confirmLabel: 'Move to trash',
      danger: true,
    });
    if (ok) {
      await documents.moveToTrash(doc.id);
      show('Moved to trash.', 'info');
      navigate(-1);
    }
  };

  const onFullscreen = () => {
    const el = viewerRef.current;
    if (el?.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
  };

  const doMove = async () => {
    await documents.move(doc.id, moveTarget || doc.folderId);
    setMoveOpen(false);
    show('Moved.', 'success');
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
        <h1 className="grow" style={{ fontSize: '1.1rem', wordBreak: 'break-word' }}>
          {doc.name}
        </h1>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label={doc.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={doc.isFavorite}
          onClick={() => void documents.setFavorite(doc.id, !doc.isFavorite)}
        >
          {doc.isFavorite ? '★' : '☆'}
        </button>
      </div>

      <div className="card card--pad-0" ref={viewerRef}>
        {pdfUrl ? (
          <object
            data={pdfUrl}
            type="application/pdf"
            width="100%"
            height="440"
            aria-label={`Preview of ${doc.name}`}
          >
            <div className="empty-state">
              <p>Inline preview isn't available in this browser.</p>
              <button type="button" className="btn btn--primary" onClick={onDownload}>
                Open / Download PDF
              </button>
            </div>
          </object>
        ) : (
          <div className="full-spinner">
            <span className="spinner" role="status" aria-label="Loading preview" />
          </div>
        )}
      </div>

      <div className="btn-row" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn" onClick={onFullscreen}>
          ⛶ Full screen
        </button>
        <button type="button" className="btn" onClick={onDownload}>
          ⬇ Download
        </button>
        {caps.webShare && (
          <button type="button" className="btn" onClick={onShare}>
            ⇪ Share
          </button>
        )}
        <button type="button" className="btn" onClick={onPrint}>
          🖨 Print
        </button>
      </div>

      <div className="card">
        <h2>Details</h2>
        <dl
          className="text-sm"
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '0.35rem 1rem',
            margin: 0,
          }}
        >
          <dt className="muted">Folder</dt>
          <dd style={{ margin: 0 }}>{folderName}</dd>
          <dt className="muted">Pages</dt>
          <dd style={{ margin: 0 }}>{doc.pageCount}</dd>
          <dt className="muted">Size</dt>
          <dd style={{ margin: 0 }}>{formatBytes(doc.sizeBytes)}</dd>
          <dt className="muted">Created</dt>
          <dd style={{ margin: 0 }}>{formatDateTime(doc.createdAt)}</dd>
          <dt className="muted">Modified</dt>
          <dd style={{ margin: 0 }}>{formatDateTime(doc.updatedAt)}</dd>
        </dl>
      </div>

      <div className="grid-2">
        <button type="button" className="btn" onClick={onRename}>
          ✏ Rename
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setMoveTarget(doc.folderId);
            setMoveOpen(true);
          }}
        >
          📁 Move
        </button>
        <button type="button" className="btn" onClick={onDuplicate}>
          ⧉ Duplicate
        </button>
        <button type="button" className="btn btn--danger" onClick={onDelete}>
          🗑 Delete
        </button>
      </div>

      <p className="text-sm muted center" style={{ marginTop: '1rem' }}>
        🔒 Stored only on this device.
      </p>

      <Dialog
        open={moveOpen}
        title="Move document"
        onClose={() => setMoveOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setMoveOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={doMove}>
              Move here
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="move-folder">Destination folder</label>
          <FolderSelect id="move-folder" value={moveTarget} onChange={setMoveTarget} />
        </div>
      </Dialog>
    </div>
  );
}
