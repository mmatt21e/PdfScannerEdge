import { describe, it, expect } from 'vitest';
import { ScanSessionService } from './ScanSessionService';
import type { ScanSessionRepository } from '@/repositories/interfaces';
import type { ImageProcessingService } from './image/ImageProcessingService';
import { fakePage } from '@/test/helpers';
import type { ScanSession } from '@/domain/types';

const noopRepo = {
  save: async () => undefined,
  getActive: async () => undefined,
  getById: async () => undefined,
  delete: async () => undefined,
  pruneAbandoned: async () => 0,
} satisfies ScanSessionRepository;

const noopImageProcessing = {
  detectDocument: async () => null,
  cropAndCorrect: async () => ({ blob: new Blob(), width: 1, height: 1 }),
  applyAdjustments: async () => ({ blob: new Blob(), width: 1, height: 1 }),
  rotate: async () => ({ blob: new Blob(), width: 1, height: 1 }),
  dispose: () => undefined,
} satisfies ImageProcessingService;

function service() {
  return new ScanSessionService(noopRepo, noopImageProcessing);
}

function session(pages: number): ScanSession {
  return {
    id: 's1',
    pages: Array.from({ length: pages }, (_, i) => fakePage(i)),
    status: 'reviewing',
    createdAt: 'x',
    updatedAt: 'x',
  };
}

describe('ScanSessionService page operations', () => {
  it('removes a page and reindexes order', () => {
    const svc = service();
    const s = session(3);
    const next = svc.removePage(s, s.pages[1]!.id);
    expect(next.pages).toHaveLength(2);
    expect(next.pages.map((p) => p.order)).toEqual([0, 1]);
  });

  it('duplicates a page immediately after the original with a new id', () => {
    const svc = service();
    const s = session(2);
    const next = svc.duplicatePage(s, s.pages[0]!.id);
    expect(next.pages).toHaveLength(3);
    expect(next.pages[1]!.id).not.toBe(next.pages[0]!.id);
    expect(next.pages.map((p) => p.order)).toEqual([0, 1, 2]);
  });

  it('reorders pages and reindexes order', () => {
    const svc = service();
    const s = session(3);
    const firstId = s.pages[0]!.id;
    const next = svc.reorderPages(s, 0, 2);
    expect(next.pages[2]!.id).toBe(firstId);
    expect(next.pages.map((p) => p.order)).toEqual([0, 1, 2]);
  });

  it('ignores out-of-range reorder requests', () => {
    const svc = service();
    const s = session(2);
    expect(svc.reorderPages(s, 0, 5)).toBe(s);
    expect(svc.reorderPages(s, -1, 0)).toBe(s);
  });
});
