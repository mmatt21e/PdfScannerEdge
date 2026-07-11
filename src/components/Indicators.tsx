import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useStorageStatus } from '@/hooks/useStorageStatus';
import { formatBytes } from '@/services/storage/StorageService';

/** Small online/offline status pill. */
export function OnlineIndicator() {
  const online = useOnlineStatus();
  return (
    <span className="status-bar" title={online ? 'Online' : 'Offline'}>
      <span className={`status-dot ${online ? '' : 'status-dot--offline'}`} aria-hidden="true" />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

/** Storage usage meter with a low-space warning. */
export function StorageIndicator() {
  const { status } = useStorageStatus();
  if (!status || !status.supported || status.quotaBytes === 0) return null;
  const pct = Math.min(100, Math.round(status.usedFraction * 100));
  return (
    <div className="card">
      <div className="row spread">
        <strong>Storage</strong>
        <span className="text-sm muted">
          {formatBytes(status.usageBytes)} of {formatBytes(status.quotaBytes)}
        </span>
      </div>
      <div className="meter" style={{ marginTop: '0.5rem' }}>
        <div
          className={`meter__fill ${status.low ? 'meter__fill--warn' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {status.low && (
        <p className="text-sm" style={{ color: 'var(--warning)', marginTop: '0.5rem' }}>
          Storage is running low. Export or delete documents you no longer need.
        </p>
      )}
    </div>
  );
}
