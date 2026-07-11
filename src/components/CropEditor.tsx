import { useEffect, useRef, useState } from 'react';
import type { DocumentCorners, Point } from '@/domain/types';
import { useObjectUrl } from '@/hooks/useObjectUrl';

type CornerKey = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';
const ORDER: CornerKey[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

const FULL_FRAME: DocumentCorners = {
  topLeft: { x: 0.04, y: 0.04 },
  topRight: { x: 0.96, y: 0.04 },
  bottomRight: { x: 0.96, y: 0.96 },
  bottomLeft: { x: 0.04, y: 0.96 },
};

/**
 * Four-corner crop editor. Corners are stored in normalized (0..1) coordinates so they are
 * resolution-independent. Handles are keyboard-adjustable for accessibility.
 */
export function CropEditor({
  image,
  initialCorners,
  onChange,
}: {
  image: Blob;
  initialCorners?: DocumentCorners;
  onChange: (corners: DocumentCorners) => void;
}) {
  const url = useObjectUrl(image);
  const stageRef = useRef<HTMLDivElement>(null);
  const [corners, setCorners] = useState<DocumentCorners>(initialCorners ?? FULL_FRAME);
  const dragging = useRef<CornerKey | null>(null);

  useEffect(() => {
    setCorners(initialCorners ?? FULL_FRAME);
  }, [initialCorners]);

  const commit = (next: DocumentCorners) => {
    setCorners(next);
    onChange(next);
  };

  const clamp = (v: number) => Math.min(1, Math.max(0, v));

  const pointerToNorm = (clientX: number, clientY: number): Point => {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      x: clamp((clientX - rect.left) / rect.width),
      y: clamp((clientY - rect.top) / rect.height),
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const p = pointerToNorm(e.clientX, e.clientY);
    setCorners((prev) => {
      const next = { ...prev, [dragging.current as CornerKey]: p };
      onChange(next);
      return next;
    });
  };

  const stopDrag = () => {
    dragging.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDrag);
  };

  const startDrag = (key: CornerKey) => (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = key;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDrag);
  };

  const nudge = (key: CornerKey, dx: number, dy: number) => {
    const c = corners[key];
    commit({ ...corners, [key]: { x: clamp(c.x + dx), y: clamp(c.y + dy) } });
  };

  const polygon = ORDER.map((k) => `${corners[k].x * 100},${corners[k].y * 100}`).join(' ');

  return (
    <div>
      <div className="crop-stage" ref={stageRef}>
        {url && <img src={url} alt="Page to crop" draggable={false} />}
        <svg className="crop-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon
            points={polygon}
            fill="rgba(31,111,235,0.15)"
            stroke="var(--primary-hover)"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className="crop-handle"
            style={{ left: `${corners[key].x * 100}%`, top: `${corners[key].y * 100}%` }}
            onPointerDown={startDrag(key)}
            aria-label={`${key} crop handle`}
            onKeyDown={(e) => {
              const step = 0.01;
              if (e.key === 'ArrowLeft') nudge(key, -step, 0);
              else if (e.key === 'ArrowRight') nudge(key, step, 0);
              else if (e.key === 'ArrowUp') nudge(key, 0, -step);
              else if (e.key === 'ArrowDown') nudge(key, 0, step);
              else return;
              e.preventDefault();
            }}
          />
        ))}
      </div>
      <div className="btn-row" style={{ marginTop: '0.5rem' }}>
        <button type="button" className="btn btn--ghost text-sm" onClick={() => commit(FULL_FRAME)}>
          Reset corners
        </button>
      </div>
    </div>
  );
}
