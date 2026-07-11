// Storage management: usage estimates, low-storage warnings, quota detection, and
// persistent-storage requests. Wraps the StorageManager API with capability guards.

import { getCapabilities } from '@/services/capabilities';

export interface StorageStatus {
  supported: boolean;
  usageBytes: number;
  quotaBytes: number;
  /** 0..1 fraction used, or 0 when unknown. */
  usedFraction: number;
  persisted: boolean;
  /** True when the remaining space is below the low-storage threshold. */
  low: boolean;
}

const LOW_STORAGE_FRACTION = 0.9;
const LOW_STORAGE_MIN_FREE_BYTES = 30 * 1024 * 1024; // 30 MB

export class StorageService {
  async getStatus(): Promise<StorageStatus> {
    const caps = getCapabilities();
    let usageBytes = 0;
    let quotaBytes = 0;
    let persisted = false;

    if (caps.storageEstimate) {
      try {
        const est = await navigator.storage.estimate();
        usageBytes = est.usage ?? 0;
        quotaBytes = est.quota ?? 0;
      } catch {
        /* ignore */
      }
    }
    if (caps.persistentStorage && typeof navigator.storage.persisted === 'function') {
      try {
        persisted = await navigator.storage.persisted();
      } catch {
        /* ignore */
      }
    }

    const usedFraction = quotaBytes > 0 ? usageBytes / quotaBytes : 0;
    const free = quotaBytes - usageBytes;
    const low =
      quotaBytes > 0 &&
      (usedFraction >= LOW_STORAGE_FRACTION || free <= LOW_STORAGE_MIN_FREE_BYTES);

    return {
      supported: caps.storageEstimate,
      usageBytes,
      quotaBytes,
      usedFraction,
      persisted,
      low,
    };
  }

  /** Request persistent storage. Returns whether it is now persisted. */
  async requestPersistence(): Promise<boolean> {
    const caps = getCapabilities();
    if (!caps.persistentStorage) return false;
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }

  /** Heuristic for whether an error is an IndexedDB quota-exceeded error. */
  static isQuotaError(err: unknown): boolean {
    if (err instanceof DOMException) {
      return (
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22
      );
    }
    if (err instanceof Error) {
      return /quota/i.test(err.message);
    }
    return false;
  }
}

/** Human-readable byte formatting. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
