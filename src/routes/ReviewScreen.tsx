import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScanFlow } from '@/context/ScanFlowContext';
import { useServices } from '@/context/ServicesContext';
import { useToast } from '@/context/ToastContext';
import { useDialogs } from '@/context/DialogsContext';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { CropEditor } from '@/components/CropEditor';
import { AdjustPanel } from '@/components/AdjustPanel';
import type { DocumentCorners, ScanPage } from '@/domain/types';

type Mode = 'view' | 'crop' | 'adjust';

export default function ReviewScreen() {
  const navigate = useNavigate();
  const {
    session,
    busy,
    removePage,
    duplicatePage,
    replacePage,
    rotatePage,
    reorderPages,
    reprocessPage,
    resetPage,
    clear,
  } = useScanFlow();
  const { imageProcessing } = useServices();
  const { show } = useToast();
  const { confirm } = useDialogs();

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [mode, setMode] = useState<Mode>('view');
  const [pendingCorners, setPendingCorners] = useState<DocumentCorners | undefined>();
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const pages = useMemo(() => session?.pages ?? [], [session]);

  // Redirect out if there is nothing to review.
  useEffect(() => {
    if (session && pages.length === 0) {
      navigate('/');
    }
  }, [session, pages.length, navigate]);

  // Keep a valid selection.
  useEffect(() => {
    if (pages.length === 0) return;
    if (!selectedId || !pages.some((p) => p.id === selectedId)) {
      setSelectedId(pages[0]!.id);
    }
  }, [pages, selectedId]);

  const selected = pages.find((p) => p.id === selectedId);

  if (!session || pages.length === 0 || !selected) {
    return (
      <div className="full-spinner">
        <span className="spinner" role="status" aria-label="Loading" />
      </div>
    );
  }

  const selectedIndex = pages.findIndex((p) => p.id === selected.id);

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete page?',
      message: 'This page will be removed from the scan.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) await removePage(selected.id);
  };

  const onAutoDetect = async () => {
    try {
      const corners = await imageProcessing.detectDocument(selected.originalImage);
      if (corners) {
        setPendingCorners(corners);
        show('Edges detected. Adjust the corners if needed.', 'success');
      } else {
        show('Could not detect edges automatically. Drag the corners to crop.', 'info');
      }
    } catch {
      show('Edge detection failed. Drag the corners to crop.', 'info');
    }
  };

  const applyCrop = async () => {
    if (pendingCorners) {
      await reprocessPage(selected.id, {
        corners: pendingCorners,
        adjustments: selected.adjustments,
      });
    }
    setMode('view');
    setPendingCorners(undefined);
  };

  const onReplaceFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (replaceInputRef.current) replaceInputRef.current.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name)) {
      show('Please choose a valid image.', 'error');
      return;
    }
    await replacePage(selected.id, file);
    show('Page replaced.', 'success');
  };

  const cancelScan = async () => {
    const ok = await confirm({
      title: 'Discard scan?',
      message: `Discard all ${pages.length} page${pages.length === 1 ? '' : 's'}?`,
      confirmLabel: 'Discard',
      danger: true,
    });
    if (ok) {
      await clear();
      navigate('/');
    }
  };

  return (
    <div>
      <div className="screen-header">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label="Cancel scan"
          onClick={cancelScan}
        >
          ✕
        </button>
        <h1 className="grow">Review</h1>
        <span className="badge">
          {pages.length} page{pages.length === 1 ? '' : 's'}
        </span>
      </div>

      {mode === 'crop' ? (
        <div className="card">
          <h2>Crop &amp; straighten</h2>
          <CropEditor
            image={selected.originalImage}
            initialCorners={pendingCorners ?? selected.cropCorners}
            onChange={setPendingCorners}
          />
          <div className="btn-row" style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn" onClick={onAutoDetect}>
              ✨ Auto-detect
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setMode('view');
                setPendingCorners(undefined);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary grow"
              onClick={applyCrop}
              disabled={busy}
            >
              {busy ? 'Applying…' : 'Apply crop'}
            </button>
          </div>
        </div>
      ) : mode === 'adjust' ? (
        <div className="card">
          <div className="row spread">
            <h2>Adjust</h2>
            <button type="button" className="btn btn--ghost" onClick={() => setMode('view')}>
              Done
            </button>
          </div>
          <AdjustPanel
            page={selected}
            busy={busy}
            onApply={async (adjustments) => {
              await reprocessPage(selected.id, { adjustments });
              show('Adjustments applied.', 'success');
            }}
            onReset={async () => {
              await resetPage(selected.id);
              show('Page reset to original.', 'info');
            }}
          />
        </div>
      ) : (
        <>
          <PagePreview page={selected} />
          <div className="toolbar" style={{ margin: '0.75rem 0' }}>
            <ToolButton icon="✂️" label="Crop" onClick={() => setMode('crop')} />
            <ToolButton icon="🎨" label="Filters" onClick={() => setMode('adjust')} />
            <ToolButton
              icon="↻"
              label="Rotate"
              onClick={() => void rotatePage(selected.id)}
              disabled={busy}
            />
            <ToolButton
              icon="⧉"
              label="Duplicate"
              onClick={() => void duplicatePage(selected.id)}
            />
            <ToolButton
              icon="🔁"
              label="Replace"
              onClick={() => replaceInputRef.current?.click()}
            />
            <ToolButton icon="🗑️" label="Delete" onClick={onDelete} />
          </div>
        </>
      )}

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void onReplaceFile(e.target.files)}
      />

      <h2>Pages</h2>
      <div className="thumb-strip" role="list" aria-label="Reorder pages">
        {pages.map((p, index) => (
          <div key={p.id} role="listitem" style={{ position: 'relative' }}>
            <ThumbItem
              page={p}
              index={index}
              active={p.id === selected.id}
              onSelect={() => setSelectedId(p.id)}
              onDragStart={() => setDragIndex(index)}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== index) {
                  void reorderPages(dragIndex, index);
                }
                setDragIndex(null);
              }}
            />
          </div>
        ))}
      </div>

      <div className="btn-row" style={{ marginTop: '0.5rem' }}>
        <button
          type="button"
          className="btn"
          onClick={() => void reorderPages(selectedIndex, selectedIndex - 1)}
          disabled={selectedIndex <= 0}
          aria-label="Move selected page earlier"
        >
          ◀ Move up
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => void reorderPages(selectedIndex, selectedIndex + 1)}
          disabled={selectedIndex >= pages.length - 1}
          aria-label="Move selected page later"
        >
          Move down ▶
        </button>
      </div>

      <div className="stack" style={{ marginTop: '1.25rem' }}>
        <button type="button" className="btn btn--block" onClick={() => navigate('/scan')}>
          ＋ Add more pages
        </button>
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => navigate('/save')}
        >
          Generate PDF →
        </button>
      </div>
    </div>
  );
}

function PagePreview({ page }: { page: ScanPage }) {
  const url = useObjectUrl(page.processedImage);
  return url ? (
    <img className="review-preview" src={url} alt={`Page preview`} />
  ) : (
    <div className="review-preview" />
  );
}

function ThumbItem({
  page,
  index,
  active,
  onSelect,
  onDragStart,
  onDrop,
}: {
  page: ScanPage;
  index: number;
  active: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const url = useObjectUrl(page.thumbnailImage ?? page.processedImage);
  return (
    <button
      type="button"
      className={`thumb-strip__item ${active ? 'thumb-strip__item--active' : ''}`}
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      aria-label={`Page ${index + 1}${active ? ', selected' : ''}`}
      aria-pressed={active}
    >
      <span className="thumb-strip__badge">{index + 1}</span>
      {url && <img src={url} alt="" />}
    </button>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="tool-btn" onClick={onClick} disabled={disabled}>
      <span className="tool-btn__icon" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  );
}
