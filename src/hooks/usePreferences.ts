import { useCallback, useEffect, useState } from 'react';
import { useServices } from '@/context/ServicesContext';
import type { Preferences } from '@/domain/types';

/** Load and update the singleton preferences row. */
export function usePreferences(): {
  preferences?: Preferences;
  update: (patch: Partial<Preferences>) => Promise<void>;
} {
  const { preferencesRepository } = useServices();
  const [preferences, setPreferences] = useState<Preferences>();

  useEffect(() => {
    void preferencesRepository.get().then(setPreferences);
  }, [preferencesRepository]);

  const update = useCallback(
    async (patch: Partial<Preferences>) => {
      const next = await preferencesRepository.update(patch);
      setPreferences(next);
    },
    [preferencesRepository]
  );

  return { preferences, update };
}
