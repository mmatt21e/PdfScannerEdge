import type { ScanSession, ScanPage, ImageAdjustmentOptions, Rotation } from '@/domain/types';
import { DEFAULT_ADJUSTMENTS } from '@/domain/types';
import type { ScanSessionRepository } from '@/repositories/interfaces';
import type { ImageProcessingService } from '@/services/image/ImageProcessingService';
import { createId } from '@/utils/id';
import { generateThumbnail, resizeImageBlob } from '@/utils/image';

/** Abandoned drafts older than this are pruned automatically. */
export const DRAFT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Manages the lifecycle of a scan session (draft): creating pages from captures, applying
 * edits, reordering, and persisting incrementally so an interrupted scan can be resumed.
 * Persistence is fire-and-forget-safe: every mutation returns the new session which the
 * caller stores via {@link persist}.
 */
export class ScanSessionService {
  constructor(
    private readonly repo: ScanSessionRepository,
    private readonly imageProcessing: ImageProcessingService,
    private readonly maxImageDimension = 2200
  ) {}

  private now(): string {
    return new Date().toISOString();
  }

  createEmpty(folderId?: string): ScanSession {
    const now = this.now();
    return {
      id: createId(),
      folderId,
      pages: [],
      status: 'capturing',
      createdAt: now,
      updatedAt: now,
    };
  }

  async persist(session: ScanSession): Promise<void> {
    await this.repo.save({ ...session, updatedAt: this.now() });
  }

  async getActiveDraft(): Promise<ScanSession | undefined> {
    return this.repo.getActive();
  }

  async discard(session: ScanSession): Promise<void> {
    await this.repo.delete(session.id);
  }

  async pruneAbandoned(): Promise<number> {
    return this.repo.pruneAbandoned(DRAFT_RETENTION_MS);
  }

  /**
   * Build a page from a freshly captured/imported blob. The original is normalized to a
   * bounded resolution to keep memory in check; a thumbnail is generated for strips.
   */
  async createPage(source: Blob, order: number): Promise<ScanPage> {
    const normalized = await resizeImageBlob(source, this.maxImageDimension, 'image/jpeg', 0.92);
    const thumbnail = await generateThumbnail(normalized);
    return {
      id: createId(),
      originalImage: normalized,
      processedImage: normalized,
      thumbnailImage: thumbnail,
      rotation: 0,
      order,
      adjustments: { ...DEFAULT_ADJUSTMENTS },
    };
  }

  /** Append a captured page to the session and return the updated session. */
  async addCapture(session: ScanSession, source: Blob): Promise<ScanSession> {
    const page = await this.createPage(source, session.pages.length);
    const next: ScanSession = {
      ...session,
      pages: [...session.pages, page],
      updatedAt: this.now(),
    };
    await this.persist(next);
    return next;
  }

  /** Replace an existing page's imagery from a new capture, keeping its position. */
  async replacePage(session: ScanSession, pageId: string, source: Blob): Promise<ScanSession> {
    const target = session.pages.find((p) => p.id === pageId);
    if (!target) return session;
    const fresh = await this.createPage(source, target.order);
    const next = this.mapPages(session, (p) =>
      p.id === pageId ? { ...fresh, id: p.id, order: p.order } : p
    );
    await this.persist(next);
    return next;
  }

  removePage(session: ScanSession, pageId: string): ScanSession {
    const pages = session.pages.filter((p) => p.id !== pageId).map((p, i) => ({ ...p, order: i }));
    return { ...session, pages, updatedAt: this.now() };
  }

  duplicatePage(session: ScanSession, pageId: string): ScanSession {
    const idx = session.pages.findIndex((p) => p.id === pageId);
    if (idx < 0) return session;
    const original = session.pages[idx]!;
    const copy: ScanPage = { ...original, id: createId() };
    const pages = [...session.pages];
    pages.splice(idx + 1, 0, copy);
    return { ...session, pages: pages.map((p, i) => ({ ...p, order: i })), updatedAt: this.now() };
  }

  reorderPages(session: ScanSession, fromIndex: number, toIndex: number): ScanSession {
    const pages = [...session.pages];
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= pages.length ||
      toIndex >= pages.length ||
      fromIndex === toIndex
    ) {
      return session;
    }
    const [moved] = pages.splice(fromIndex, 1);
    pages.splice(toIndex, 0, moved!);
    return { ...session, pages: pages.map((p, i) => ({ ...p, order: i })), updatedAt: this.now() };
  }

  /** Rotate a page by 90°, baking the rotation into its processed image. */
  async rotatePage(session: ScanSession, pageId: string): Promise<ScanSession> {
    const target = session.pages.find((p) => p.id === pageId);
    if (!target) return session;
    const rotated = await this.imageProcessing.rotate(target.processedImage, 90);
    const newRotation = ((target.rotation + 90) % 360) as Rotation;
    const thumbnail = await generateThumbnail(rotated.blob);
    const next = this.mapPages(session, (p) =>
      p.id === pageId
        ? { ...p, processedImage: rotated.blob, thumbnailImage: thumbnail, rotation: newRotation }
        : p
    );
    await this.persist(next);
    return next;
  }

  /** Re-derive a page's processed image from its original using crop + adjustments. */
  async reprocessPage(
    session: ScanSession,
    pageId: string,
    update: { adjustments?: ImageAdjustmentOptions; corners?: ScanPage['cropCorners'] }
  ): Promise<ScanSession> {
    const target = session.pages.find((p) => p.id === pageId);
    if (!target) return session;

    const adjustments = update.adjustments ?? target.adjustments;
    const corners = 'corners' in update ? update.corners : target.cropCorners;

    let working = target.originalImage;
    if (corners) {
      const cropped = await this.imageProcessing.cropAndCorrect(working, corners);
      working = cropped.blob;
    }
    const adjusted = await this.imageProcessing.applyAdjustments(working, adjustments);
    const thumbnail = await generateThumbnail(adjusted.blob);

    const next = this.mapPages(session, (p) =>
      p.id === pageId
        ? {
            ...p,
            processedImage: adjusted.blob,
            thumbnailImage: thumbnail,
            adjustments,
            cropCorners: corners,
            rotation: 0,
          }
        : p
    );
    await this.persist(next);
    return next;
  }

  /** Reset a page back to its untouched capture. */
  async resetPage(session: ScanSession, pageId: string): Promise<ScanSession> {
    const target = session.pages.find((p) => p.id === pageId);
    if (!target) return session;
    const thumbnail = await generateThumbnail(target.originalImage);
    const next = this.mapPages(session, (p) =>
      p.id === pageId
        ? {
            ...p,
            processedImage: target.originalImage,
            thumbnailImage: thumbnail,
            adjustments: { ...DEFAULT_ADJUSTMENTS },
            cropCorners: undefined,
            rotation: 0,
          }
        : p
    );
    await this.persist(next);
    return next;
  }

  private mapPages(session: ScanSession, fn: (p: ScanPage) => ScanPage): ScanSession {
    return { ...session, pages: session.pages.map(fn), updatedAt: this.now() };
  }
}
