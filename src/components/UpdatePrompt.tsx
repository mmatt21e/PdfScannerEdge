import { useEffect, useState } from 'react';
import { getUpdateManager } from '@/services/pwa/updateManager';
import { useToast } from '@/context/ToastContext';

/**
 * Listens for service-worker updates. Because we use a prompt strategy, a new version never
 * activates on its own — it waits until the user chooses to reload, so an in-progress scan
 * is never interrupted.
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const { show } = useToast();

  useEffect(() => {
    // In dev (no service worker) this is a harmless no-op wrapper.
    let manager: ReturnType<typeof getUpdateManager> | undefined;
    try {
      manager = getUpdateManager();
      manager.onNeedRefresh(() => setNeedRefresh(true));
      manager.onOfflineReady(() => show('Ready to work offline.', 'success'));
    } catch {
      /* service worker not available */
    }
  }, [show]);

  if (!needRefresh) return null;

  return (
    <div
      className="card"
      style={{
        position: 'fixed',
        bottom: 'calc(var(--nav-height) + 12px)',
        left: 12,
        right: 12,
        zIndex: 150,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div className="row spread wrap" style={{ gap: '0.75rem' }}>
        <div className="text-sm">
          <strong>Update available.</strong> Reload to get the latest version. Your saved documents
          and any in-progress scan are safe.
        </div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => setNeedRefresh(false)}>
            Later
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void getUpdateManager().applyUpdate()}
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
