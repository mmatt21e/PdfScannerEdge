import type { PDFImage } from 'pdf-lib';
import type {
  PdfGenerationOptions,
  PageSize,
  PageOrientation,
  PdfQuality,
  MarginSize,
  ScanPage,
} from '@/domain/types';
import { resizeImageBlob, getImageSize } from '@/utils/image';

/** PDF generation contract. */
export interface PdfGenerationService {
  generate(
    pages: ScanPage[],
    options: PdfGenerationOptions,
    onProgress?: (done: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<Blob>;
  estimateSize(pages: ScanPage[], options: PdfGenerationOptions): Promise<number>;
}

// Page dimensions in PostScript points (1/72 inch).
const PAGE_SIZES: Record<Exclude<PageSize, 'auto'>, { width: number; height: number }> = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
  legal: { width: 612, height: 1008 },
};

const MARGINS: Record<MarginSize, number> = {
  none: 0,
  small: 18,
  medium: 36,
  large: 54,
};

interface QualityProfile {
  maxDimension: number;
  quality: number;
}
const QUALITY: Record<PdfQuality, QualityProfile> = {
  small: { maxDimension: 1240, quality: 0.5 },
  balanced: { maxDimension: 1754, quality: 0.72 },
  high: { maxDimension: 2480, quality: 0.9 },
};

export class PdfLibGenerationService implements PdfGenerationService {
  async generate(
    pages: ScanPage[],
    options: PdfGenerationOptions,
    onProgress?: (done: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<Blob> {
    if (pages.length === 0) {
      throw new Error('Cannot create a PDF with no pages.');
    }
    const profile = QUALITY[options.quality];
    // Lazy-load pdf-lib so it isn't in the initial bundle (only needed when saving).
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    pdf.setCreator('PocketScan');
    pdf.setProducer('PocketScan');

    const ordered = [...pages].sort((a, b) => a.order - b.order);

    for (let idx = 0; idx < ordered.length; idx++) {
      if (signal?.aborted) {
        throw new DOMException('PDF generation cancelled.', 'AbortError');
      }
      const page = ordered[idx]!;
      // Re-encode to the requested quality to control file size (memory-conscious:
      // one page at a time, never all full-resolution copies at once).
      const encoded = await resizeImageBlob(
        page.processedImage,
        profile.maxDimension,
        'image/jpeg',
        profile.quality
      );
      const bytes = new Uint8Array(await encoded.arrayBuffer());
      let embedded: PDFImage;
      try {
        embedded = await pdf.embedJpg(bytes);
      } catch {
        // Fallback for non-JPEG inputs.
        embedded = await pdf.embedPng(bytes);
      }

      const imgSize = { width: embedded.width, height: embedded.height };
      const { pageWidth, pageHeight } = this.resolvePageSize(options, imgSize);
      const margin = MARGINS[options.margin];
      const pdfPage = pdf.addPage([pageWidth, pageHeight]);

      const availW = Math.max(1, pageWidth - margin * 2);
      const availH = Math.max(1, pageHeight - margin * 2);
      // Contain: preserve aspect ratio, never stretch.
      const scale = Math.min(availW / imgSize.width, availH / imgSize.height);
      const drawW = imgSize.width * scale;
      const drawH = imgSize.height * scale;
      pdfPage.drawImage(embedded, {
        x: (pageWidth - drawW) / 2,
        y: (pageHeight - drawH) / 2,
        width: drawW,
        height: drawH,
      });
      onProgress?.(idx + 1, ordered.length);
    }

    const pdfBytes = await pdf.save();
    // Copy into a fresh ArrayBuffer so the Blob owns clean, non-shared memory.
    return new Blob([pdfBytes.slice()], { type: 'application/pdf' });
  }

  async estimateSize(pages: ScanPage[], options: PdfGenerationOptions): Promise<number> {
    const profile = QUALITY[options.quality];
    let total = 0;
    for (const page of pages) {
      const encoded = await resizeImageBlob(
        page.processedImage,
        profile.maxDimension,
        'image/jpeg',
        profile.quality
      );
      total += encoded.size;
    }
    // Add ~8% for PDF structure/overhead.
    return Math.round(total * 1.08) + 1024;
  }

  private resolvePageSize(
    options: PdfGenerationOptions,
    imgSize: { width: number; height: number }
  ): { pageWidth: number; pageHeight: number } {
    const imageIsLandscape = imgSize.width >= imgSize.height;

    if (options.pageSize === 'auto') {
      // Page matches the image aspect ratio; longest side = Letter long edge.
      const longEdge = 792;
      if (imageIsLandscape) {
        return { pageWidth: longEdge, pageHeight: longEdge * (imgSize.height / imgSize.width) };
      }
      return { pageWidth: longEdge * (imgSize.width / imgSize.height), pageHeight: longEdge };
    }

    const base = PAGE_SIZES[options.pageSize];
    let { width, height } = base;
    const wantLandscape = this.wantsLandscape(options.orientation, imageIsLandscape);
    if (wantLandscape) {
      [width, height] = [height, width];
    }
    return { pageWidth: width, pageHeight: height };
  }

  private wantsLandscape(orientation: PageOrientation, imageIsLandscape: boolean): boolean {
    switch (orientation) {
      case 'landscape':
        return true;
      case 'portrait':
        return false;
      case 'auto':
      default:
        return imageIsLandscape;
    }
  }
}

/** Render the first page of a scan set to a thumbnail blob for library lists. */
export async function firstPageThumbnail(pages: ScanPage[]): Promise<Blob | undefined> {
  const first = [...pages].sort((a, b) => a.order - b.order)[0];
  if (!first) return undefined;
  if (first.thumbnailImage) return first.thumbnailImage;
  try {
    await getImageSize(first.processedImage);
    return await resizeImageBlob(first.processedImage, 320, 'image/jpeg', 0.7);
  } catch {
    return undefined;
  }
}
