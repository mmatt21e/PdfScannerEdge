import { useCallback, useEffect, useState } from 'react';
import { useServices } from '@/context/ServicesContext';
import type { StorageStatus } from '@/services/storage/StorageService';

/** Poll storage status and expose a refresh function. */
export function useStorageStatus(): { status?: StorageStatus; refresh: () => void } {
  const { storage } = useServices();
  const [status, setStatus] = useState<StorageStatus>();

  const refresh = useCallback(() => {
    void storage.getStatus().then(setStatus);
  }, [storage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, refresh };
}
