import { useNavigate } from 'react-router-dom';
import { useServices } from '@/context/ServicesContext';
import { useToast } from '@/context/ToastContext';
import { useDialogs } from '@/context/DialogsContext';
import { usePreferences } from '@/hooks/usePreferences';
import { useStorageStatus } from '@/hooks/useStorageStatus';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { OnlineIndicator } from '@/components/Indicators';
import { formatBytes } from '@/services/storage/StorageService';
import { getCapabilities } from '@/services/capabilities';
import { exportOutcomeMessage } from '@/utils/exportMessages';
import type { ColorMode } from '@/domain/types';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { storage, db, scanSessionRepository, documentRepository, exporter } = useServices();
  const { show } = useToast();
  const { confirm } = useDialogs();
  const { preferences, update } = usePreferences();
  const { status, refresh } = useStorageStatus();
  const { canInstall, promptInstall } = useInstallPrompt();
  const caps = getCapabilities();

  const requestPersist = async () => {
    const ok = await storage.requestPersistence();
    show(
      ok
        ? 'Persistent storage granted. Your data is protected from automatic cleanup.'
        : 'The browser did not grant persistent storage. Your data is kept but may be cleared under storage pressure.',
      ok ? 'success' : 'info'
    );
    refresh();
  };

  const clearTemp = async () => {
    const ok = await confirm({
      title: 'Clear temporary scan data?',
      message:
        'This deletes any in-progress or abandoned scan drafts. Saved PDFs are never affected.',
      confirmLabel: 'Clear drafts',
      danger: true,
    });
    if (!ok) return;
    await db.scanSessions.clear();
    show('Temporary scan data cleared.', 'info');
    refresh();
  };

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Delete ALL app data?',
      message:
        'This permanently deletes every folder, document, and setting stored on this device. This cannot be undone. Export anything you want to keep first.',
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (!ok) return;
    await db.delete();
    show('All data deleted. Reloading…', 'info');
    setTimeout(() => window.location.reload(), 800);
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'unavailable') {
      show('To install, use your browser menu → “Add to Home Screen”.', 'info');
    }
  };

  const pruneDrafts = async () => {
    const removed = await scanSessionRepository.pruneAbandoned(0);
    show(`Removed ${removed} draft${removed === 1 ? '' : 's'}.`, 'info');
  };

  const exportAll = async () => {
    const docs = await documentRepository.list({ sortKey: 'createdAt', sortDirection: 'desc' });
    if (docs.length === 0) {
      show('There are no documents to export yet.', 'info');
      return;
    }
    const outcome = await exporter.exportFolder('PocketScan', docs);
    const msg = exportOutcomeMessage(outcome, docs.length);
    if (msg) show(msg.text, msg.kind);
  };

  return (
    <div>
      <div className="screen-header">
        <h1 className="grow">Settings</h1>
        <OnlineIndicator />
      </div>

      <div className="card">
        <h2>Scanning defaults</h2>
        <div className="field">
          <label htmlFor="default-color">Default color mode</label>
          <select
            id="default-color"
            className="select"
            value={preferences?.defaultColorMode ?? 'color'}
            onChange={(e) => void update({ defaultColorMode: e.target.value as ColorMode })}
          >
            <option value="color">Color</option>
            <option value="grayscale">Grayscale</option>
            <option value="bw">Black &amp; white</option>
          </select>
        </div>
        <label className="row" style={{ gap: '0.5rem', fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={preferences?.autoCapture ?? false}
            onChange={(e) => void update({ autoCapture: e.target.checked })}
          />
          Enable automatic capture by default
        </label>
      </div>

      <div className="card">
        <h2>Storage</h2>
        {status && status.supported ? (
          <p className="text-sm">
            Using {formatBytes(status.usageBytes)} of {formatBytes(status.quotaBytes)}.
            <br />
            Persistent storage: <strong>{status.persisted ? 'On' : 'Not guaranteed'}</strong>
          </p>
        ) : (
          <p className="text-sm muted">Storage estimates are not available in this browser.</p>
        )}
        <div className="stack">
          {caps.persistentStorage && !status?.persisted && (
            <button type="button" className="btn" onClick={requestPersist}>
              Request persistent storage
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={exportAll}>
            📤 Export all documents to device
          </button>
          <button type="button" className="btn" onClick={() => navigate('/trash')}>
            🗑 Open trash
          </button>
          <button type="button" className="btn" onClick={pruneDrafts}>
            Remove abandoned drafts
          </button>
          <button type="button" className="btn" onClick={clearTemp}>
            Clear temporary scan data
          </button>
          <button type="button" className="btn btn--danger" onClick={clearAll}>
            Delete all app data
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Install</h2>
        <p className="text-sm muted">
          Install PocketScan to your home screen to launch it like an app and use it fully offline.
        </p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={install}
          disabled={!canInstall && !caps.serviceWorker}
        >
          {canInstall ? 'Install app' : 'How to install'}
        </button>
      </div>

      <div className="card">
        <h2>Privacy</h2>
        <p className="text-sm">
          PocketScan works entirely on your device. Camera frames, image processing, and PDF
          generation all happen locally in your browser.
        </p>
        <ul className="text-sm" style={{ paddingLeft: '1.2rem' }}>
          <li>Your scans and PDFs are stored only in this browser's local database.</li>
          <li>Nothing is uploaded to any server. There is no account and no analytics.</li>
          <li>Files leave your device only when you explicitly download or share them.</li>
          <li>The camera is requested only when you start a scan.</li>
        </ul>
        <p className="text-sm muted">
          Because data is stored locally, clearing your browser data or uninstalling will remove
          your documents. Use Download or Share to keep copies elsewhere.
        </p>
      </div>

      <p className="text-sm muted center">PocketScan · offline-first document scanner</p>
    </div>
  );
}
