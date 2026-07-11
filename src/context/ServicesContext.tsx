import { createContext, useContext, type ReactNode } from 'react';
import type { Services } from '@/services/container';

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

/** Access the wired service container. Throws if used outside the provider. */
export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) {
    throw new Error('useServices must be used within a ServicesProvider.');
  }
  return ctx;
}
