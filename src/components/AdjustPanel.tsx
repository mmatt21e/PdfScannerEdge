import { useEffect, useMemo, useRef, useState } from 'react';
import type { ImageAdjustmentOptions, ColorMode, ScanPage } from '@/domain/types';
import { DEFAULT_ADJUSTMENTS } from '@/domain/types';
import { useServices } from '@/context/ServicesContext';

const COLOR_MODES: { key: ColorMode; label: string }[] = [
  { key: 'color', label: 'Color' },
  { key: 'grayscale', label: 'Grayscale' },
  { key: 'bw', label: 'B & W' },
];

/**
 * Image adjustment controls with a debounced live preview. Applying persists the settings
 * (the parent re-derives the page from its untouched original). Reset returns to defaults.
 */
export function AdjustPanel({
  page,
  onApply,
  onReset,
  busy,
}: {
  page: ScanPage;
  onApply: (adjustments: ImageAdjustmentOptions) => void;
  onReset: () => void;
  busy: boolean;
}) {
  const { imageProcessing } = useServices();
  const [adjustments, setAdjustments] = useState<ImageAdjustmentOptions>(page.adjustments);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewing, setPreviewing] = useState(false);
  const previewUrlRef = useRef<string>();

  useEffect(() => {
    setAdjustments(page.adjustments);
  }, [page.id, page.adjustments]);

  // Debounced preview. Applies adjustments to the untouched original for an accurate,
  // non-destructive preview of color/brightness/contrast effects.
  useEffect(() => {
    let cancelled = false;
    setPreviewing(true);
    const handle = window.setTimeout(async () => {
      try {
        const result = await imageProcessing.applyAdjustments(page.originalImage, adjustments);
        if (cancelled) return;
        const url = URL.createObjectURL(result.blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch {
        /* ignore preview failures */
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [adjustments, page.originalImage, imageProcessing]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  const dirty = useMemo(
    () => JSON.stringify(adjustments) !== JSON.stringify(page.adjustments),
    [adjustments, page.adjustments]
  );

  const set = <K extends keyof ImageAdjustmentOptions>(key: K, value: ImageAdjustmentOptions[K]) =>
    setAdjustments((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="stack">
      <div style={{ position: 'relative' }}>
        {previewUrl && <img className="review-preview" src={previewUrl} alt="Adjustment preview" />}
        {previewing && (
          <span
            className="spinner"
            style={{ position: 'absolute', top: 8, right: 8 }}
            aria-label="Updating preview"
          />
        )}
      </div>

      <div className="field">
        <label>Color mode</label>
        <div className="chip-group">
          {COLOR_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className="chip"
              aria-pressed={adjustments.colorMode === m.key}
              onClick={() => set('colorMode', m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {adjustments.colorMode === 'bw' && (
        <Slider
          label="B&W threshold"
          min={0}
          max={255}
          value={adjustments.bwThreshold}
          onChange={(v) => set('bwThreshold', v)}
        />
      )}

      <Slider
        label="Brightness"
        min={-100}
        max={100}
        value={adjustments.brightness}
        onChange={(v) => set('brightness', v)}
      />
      <Slider
        label="Contrast"
        min={-100}
        max={100}
        value={adjustments.contrast}
        onChange={(v) => set('contrast', v)}
      />
      <Slider
        label="Sharpen"
        min={0}
        max={100}
        value={adjustments.sharpen}
        onChange={(v) => set('sharpen', v)}
      />
      <Slider
        label="Background cleanup"
        min={0}
        max={100}
        value={adjustments.backgroundCleanup}
        onChange={(v) => set('backgroundCleanup', v)}
      />

      <div className="btn-row">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setAdjustments({ ...DEFAULT_ADJUSTMENTS });
            onReset();
          }}
          disabled={busy}
        >
          Reset to original
        </button>
        <button
          type="button"
          className="btn btn--primary grow"
          onClick={() => onApply(adjustments)}
          disabled={busy || !dirty}
        >
          {busy ? 'Applying…' : 'Apply changes'}
        </button>
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const id = `slider-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="field" style={{ marginBottom: '0.5rem' }}>
      <label htmlFor={id}>{label}</label>
      <div className="slider-row">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="slider-row__value">{value}</span>
      </div>
    </div>
  );
}
