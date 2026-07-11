// Safe service-worker update management. We use vite-plugin-pwa's `registerType: 'prompt'`
// so a new service worker never activates automatically — the user is prompted to reload.
// This guarantees a deployed update cannot destroy an in-progress scan session.

import { registerSW } from 'virtual:pwa-register';

export interface UpdateManager {
  /** Called when a new version is waiting to activate. */
  onNeedRefresh(cb: () => void): void;
  /** Called when the app is ready to work offline. */
  onOfflineReady(cb: () => void): void;
  /** Activate the waiting service worker and reload. */
  applyUpdate(): Promise<void>;
}

class ViteUpdateManager implements UpdateManager {
  private needRefreshCb?: () => void;
  private offlineReadyCb?: () => void;
  private updateSW?: (reload?: boolean) => Promise<void>;

  constructor() {
    // registerSW is a no-op-safe wrapper injected by vite-plugin-pwa at build time.
    this.updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => this.needRefreshCb?.(),
      onOfflineReady: () => this.offlineReadyCb?.(),
    });
  }

  onNeedRefresh(cb: () => void): void {
    this.needRefreshCb = cb;
  }
  onOfflineReady(cb: () => void): void {
    this.offlineReadyCb = cb;
  }
  async applyUpdate(): Promise<void> {
    await this.updateSW?.(true);
  }
}

let instance: UpdateManager | undefined;

/** Get the singleton update manager. Safe to call once at app startup. */
export function getUpdateManager(): UpdateManager {
  if (!instance) {
    instance = new ViteUpdateManager();
  }
  return instance;
}
