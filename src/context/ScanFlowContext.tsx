import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ScanSession, ImageAdjustmentOptions, DocumentCorners } from '@/domain/types';
import { useServices } from './ServicesContext';

interface ScanFlowValue {
  session: ScanSession | null;
  busy: boolean;
  /** Begin a new (in-memory) scan session. */
  startNew: (folderId?: string) => void;
  /** Resume an existing draft loaded from storage. */
  resume: (session: ScanSession) => void;
  addCapture: (blob: Blob) => Promise<void>;
  replacePage: (pageId: string, blob: Blob) => Promise<void>;
  removePage: (pageId: string) => Promise<void>;
  duplicatePage: (pageId: string) => Promise<void>;
  reorderPages: (from: number, to: number) => Promise<void>;
  rotatePage: (pageId: string) => Promise<void>;
  reprocessPage: (
    pageId: string,
    update: { adjustments?: ImageAdjustmentOptions; corners?: DocumentCorners }
  ) => Promise<void>;
  resetPage: (pageId: string) => Promise<void>;
  setFolder: (folderId: string) => void;
  setProposedFilename: (name: string) => void;
  /** Clear the in-memory session and delete its draft (after successful save or cancel). */
  clear: () => Promise<void>;
}

const ScanFlowContext = createContext<ScanFlowValue | null>(null);

export function ScanFlowProvider({ children }: { children: ReactNode }) {
  const { scanSessions } = useServices();
  const [session, setSession] = useState<ScanSession | null>(null);
  const [busy, setBusy] = useState(false);
  // Keep a ref in sync so async tasks always read the latest committed session.
  const sessionRef = useRef<ScanSession | null>(null);
  sessionRef.current = session;
  // Serialize mutations so overlapping async edits don't clobber each other.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // Run a service task against the current session, then commit the result. Mutations are
  // chained so rapid edits (e.g. rotate then delete) apply in order on the latest state.
  const mutate = useCallback(
    (task: (current: ScanSession) => Promise<ScanSession> | ScanSession): Promise<void> => {
      const p = queue.current.then(async () => {
        const current = sessionRef.current;
        if (!current) return;
        setBusy(true);
        try {
          const next = await task(current);
          sessionRef.current = next;
          setSession(next);
        } finally {
          setBusy(false);
        }
      });
      queue.current = p.catch(() => undefined);
      return p;
    },
    []
  );

  const startNew = useCallback(
    (folderId?: string) => {
      const s = scanSessions.createEmpty(folderId);
      sessionRef.current = s;
      setSession(s);
    },
    [scanSessions]
  );

  const resume = useCallback((s: ScanSession) => {
    sessionRef.current = s;
    setSession(s);
  }, []);

  const addCapture = useCallback(
    (blob: Blob) => mutate((current) => scanSessions.addCapture(current, blob)),
    [mutate, scanSessions]
  );
  const replacePage = useCallback(
    (pageId: string, blob: Blob) =>
      mutate((current) => scanSessions.replacePage(current, pageId, blob)),
    [mutate, scanSessions]
  );
  const removePage = useCallback(
    (pageId: string) =>
      mutate(async (current) => {
        const next = scanSessions.removePage(current, pageId);
        await scanSessions.persist(next);
        return next;
      }),
    [mutate, scanSessions]
  );
  const duplicatePage = useCallback(
    (pageId: string) =>
      mutate(async (current) => {
        const next = scanSessions.duplicatePage(current, pageId);
        await scanSessions.persist(next);
        return next;
      }),
    [mutate, scanSessions]
  );
  const reorderPages = useCallback(
    (from: number, to: number) =>
      mutate(async (current) => {
        const next = scanSessions.reorderPages(current, from, to);
        await scanSessions.persist(next);
        return next;
      }),
    [mutate, scanSessions]
  );
  const rotatePage = useCallback(
    (pageId: string) => mutate((current) => scanSessions.rotatePage(current, pageId)),
    [mutate, scanSessions]
  );
  const reprocessPage = useCallback(
    (pageId: string, update: { adjustments?: ImageAdjustmentOptions; corners?: DocumentCorners }) =>
      mutate((current) => scanSessions.reprocessPage(current, pageId, update)),
    [mutate, scanSessions]
  );
  const resetPage = useCallback(
    (pageId: string) => mutate((current) => scanSessions.resetPage(current, pageId)),
    [mutate, scanSessions]
  );

  const setFolder = useCallback(
    (folderId: string) =>
      mutate(async (current) => {
        const next = { ...current, folderId };
        if (current.pages.length > 0) await scanSessions.persist(next);
        return next;
      }),
    [mutate, scanSessions]
  );
  const setProposedFilename = useCallback(
    (name: string) =>
      mutate(async (current) => {
        const next = { ...current, proposedFilename: name };
        if (current.pages.length > 0) await scanSessions.persist(next);
        return next;
      }),
    [mutate, scanSessions]
  );

  const clear = useCallback(async () => {
    const current = sessionRef.current;
    if (current) {
      await scanSessions.discard(current);
    }
    sessionRef.current = null;
    setSession(null);
  }, [scanSessions]);

  const value = useMemo<ScanFlowValue>(
    () => ({
      session,
      busy,
      startNew,
      resume,
      addCapture,
      replacePage,
      removePage,
      duplicatePage,
      reorderPages,
      rotatePage,
      reprocessPage,
      resetPage,
      setFolder,
      setProposedFilename,
      clear,
    }),
    [
      session,
      busy,
      startNew,
      resume,
      addCapture,
      replacePage,
      removePage,
      duplicatePage,
      reorderPages,
      rotatePage,
      reprocessPage,
      resetPage,
      setFolder,
      setProposedFilename,
      clear,
    ]
  );

  return <ScanFlowContext.Provider value={value}>{children}</ScanFlowContext.Provider>;
}

export function useScanFlow(): ScanFlowValue {
  const ctx = useContext(ScanFlowContext);
  if (!ctx) {
    throw new Error('useScanFlow must be used within a ScanFlowProvider.');
  }
  return ctx;
}
