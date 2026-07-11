import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScanFlow } from '@/context/ScanFlowContext';
import { useServices } from '@/context/ServicesContext';
import { useToast } from '@/context/ToastContext';
import { usePreferences } from '@/hooks/usePreferences';
import { FolderSelect } from '@/components/FolderSelect';
import { Dialog } from '@/components/Dialog';
import { formatBytes } from '@/services/storage/StorageService';
import { DuplicateNameError, type DuplicateStrategy } from '@/services/DocumentService';
import { suggestFilenameBase, sanitizeFilenameBase, ensurePdfExtension } from '@/utils/filename';
import {
  DEFAULT_FOLDER_ID,
  DEFAULT_PDF_OPTIONS,
  type PageSize,
  type PageOrientation,
  type PdfQuality,
  type MarginSize,
  type PdfGenerationOptions,
} from '@/domain/types';

const PAGE_SIZES: { key: PageSize; label: string }[] = [
  { key: 'auto', label: 'Automatic' },
  { key: 'letter', label: 'Letter' },
  { key: 'a4', label: 'A4' },
  { key: 'legal', label: 'Legal' },
];
const ORIENTATIONS: { key: PageOrientation; label: string }[] = [
  { key: 'auto', label: 'Automatic' },
  { key: 'portrait', label: 'Portrait' },
  { key: 'landscape', label: 'Landscape' },
];
const QUALITIES: { key: PdfQuality; label: string }[] = [
  { key: 'small', label: 'Small file' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'high', label: 'High quality' },
];
const MARGINS: { key: MarginSize; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'small', label: 'Small' },
  { key: 'medium', label: 'Medium' },
  { key: 'large', label: 'Large' },
];

export default function SaveScreen() {
  const navigate = useNavigate();
  const { session, setFolder, setProposedFilename, clear } = useScanFlow();
  const { documents, pdf } = useServices();
  const { show } = useToast();
  const { preferences } = usePreferences();

  const [filenameBase, setFilenameBase] = useState('');
  const [folderId, setFolderId] = useState(DEFAULT_FOLDER_ID);
  const [options, setOptions] = useState<PdfGenerationOptions>(DEFAULT_PDF_OPTIONS);
  const [estimate, setEstimate] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dupOpen, setDupOpen] = useState(false);

  const pages = useMemo(() => session?.pages ?? [], [session]);

  useEffect(() => {
    if (!session) {
      navigate('/');
      return;
    }
    setFilenameBase(session.proposedFilename ?? suggestFilenameBase());
    setFolderId(session.folderId ?? DEFAULT_FOLDER_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (preferences?.defaultPdfOptions) {
      setOptions(preferences.defaultPdfOptions);
    }
  }, [preferences]);

  // Debounced size estimate.
  useEffect(() => {
    if (pages.length === 0) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const size = await pdf.estimateSize(pages, options);
        if (!cancelled) setEstimate(size);
      } catch {
        if (!cancelled) setEstimate(undefined);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [pages, options, pdf]);

  if (!session) return null;

  const doSave = async (strategy: DuplicateStrategy) => {
    setSaving(true);
    setProgress({ done: 0, total: pages.length });
    try {
      const doc = await documents.saveFromScan({
        pages,
        filenameBase,
        folderId,
        pdfOptions: options,
        duplicateStrategy: strategy,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      await clear();
      show('PDF saved.', 'success');
      navigate(`/documents/${doc.id}`, { replace: true });
    } catch (err) {
      if (err instanceof DuplicateNameError) {
        setDupOpen(true);
      } else {
        show(err instanceof Error ? err.message : 'Could not save the PDF.', 'error');
      }
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const previewName = ensurePdfExtension(filenameBase || suggestFilenameBase());
  const sanitizedEmpty = sanitizeFilenameBase(filenameBase).length === 0;

  return (
    <div>
      <div className="screen-header">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label="Back to review"
          onClick={() => navigate('/review')}
        >
          ←
        </button>
        <h1 className="grow">Save PDF</h1>
      </div>

      <div className="card">
        <div className="field">
          <label htmlFor="filename">Filename</label>
          <input
            id="filename"
            className="input"
            value={filenameBase}
            onChange={(e) => {
              setFilenameBase(e.target.value);
              setProposedFilename(e.target.value);
            }}
            placeholder="Document name"
          />
          <p className="text-sm muted" style={{ marginTop: '0.35rem' }}>
            Saves as <strong>{previewName}</strong>
          </p>
        </div>

        <div className="field">
          <label htmlFor="folder-select">Destination folder</label>
          <FolderSelect
            value={folderId}
            onChange={(id) => {
              setFolderId(id);
              setFolder(id);
            }}
          />
        </div>
      </div>

      <div className="card">
        <ChipField
          label="Page size"
          options={PAGE_SIZES}
          value={options.pageSize}
          onChange={(pageSize) => setOptions((o) => ({ ...o, pageSize }))}
        />
        <ChipField
          label="Orientation"
          options={ORIENTATIONS}
          value={options.orientation}
          onChange={(orientation) => setOptions((o) => ({ ...o, orientation }))}
        />
        <ChipField
          label="Margins"
          options={MARGINS}
          value={options.margin}
          onChange={(margin) => setOptions((o) => ({ ...o, margin }))}
        />
        <ChipField
          label="Quality"
          options={QUALITIES}
          value={options.quality}
          onChange={(quality) => setOptions((o) => ({ ...o, quality }))}
        />
        <p className="text-sm muted">
          {pages.length} page{pages.length === 1 ? '' : 's'}
          {estimate !== undefined ? ` · Estimated size ~${formatBytes(estimate)}` : ''}
        </p>
      </div>

      {progress && (
        <div className="card">
          <p className="text-sm">
            Generating PDF… page {progress.done} of {progress.total}
          </p>
          <div className="progress">
            <div
              className="progress__bar"
              style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={() => void doSave('cancel')}
        disabled={saving || sanitizedEmpty}
      >
        {saving ? 'Saving…' : 'Save PDF'}
      </button>

      <Dialog
        open={dupOpen}
        title="Name already used"
        onClose={() => setDupOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setDupOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDupOpen(false);
                void doSave('increment');
              }}
            >
              Keep both
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                setDupOpen(false);
                void doSave('replace');
              }}
            >
              Replace
            </button>
          </>
        }
      >
        <p className="text-sm">
          A document named <strong>{previewName}</strong> already exists in this folder. Keep both
          (save with a number) or replace the existing file?
        </p>
      </Dialog>
    </div>
  );
}

function ChipField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="chip-group">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            className="chip"
            aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
