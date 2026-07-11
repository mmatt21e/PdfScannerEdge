import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional footer, usually action buttons. */
  footer?: ReactNode;
  /** When false, clicking the backdrop / pressing Escape will not close. */
  dismissible?: boolean;
}

/**
 * Accessible modal dialog: labelled, focus-trapped to the panel, closes on Escape/backdrop
 * (when dismissible), and restores focus to the previously focused element on close.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  dismissible = true,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useRef(`dialog-title-${Math.floor(Math.random() * 1e9)}`);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the first focusable element (or the panel).
    const focusable = panel?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab' && panel) {
        const items = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled'));
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        ref={panelRef}
      >
        <div className="row spread" style={{ marginBottom: '0.75rem' }}>
          <h2 id={titleId.current} style={{ margin: 0 }}>
            {title}
          </h2>
          {dismissible && (
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              aria-label="Close dialog"
              onClick={onClose}
            >
              ✕
            </button>
          )}
        </div>
        <div>{children}</div>
        {footer && (
          <div className="btn-row" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
