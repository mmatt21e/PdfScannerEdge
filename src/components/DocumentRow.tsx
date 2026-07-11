import { useObjectUrl } from '@/hooks/useObjectUrl';
import { formatBytes } from '@/services/storage/StorageService';
import type { StoredDocument } from '@/domain/types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** A single document list row with a thumbnail, name, and metadata. */
export function DocumentRow({
  document,
  onOpen,
}: {
  document: StoredDocument;
  onOpen: (doc: StoredDocument) => void;
}) {
  const thumbUrl = useObjectUrl(document.thumbnailImage);
  return (
    <button type="button" className="doc-row" onClick={() => onOpen(document)}>
      <span className="doc-row__thumb" aria-hidden="true">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          '📄'
        )}
      </span>
      <span className="doc-row__body">
        <span className="doc-row__title">
          {document.isFavorite ? '★ ' : ''}
          {document.name}
        </span>
        <span className="doc-row__meta">
          {document.pageCount} page{document.pageCount === 1 ? '' : 's'} ·{' '}
          {formatBytes(document.sizeBytes)} · {formatDate(document.createdAt)}
        </span>
      </span>
      <span aria-hidden="true" className="muted">
        ›
      </span>
    </button>
  );
}
