// Export saved PDFs to real device folders. Chooses the best available mechanism and
// always has a working fallback:
//   - File System Access API (desktop Chromium): pick a file location or a directory.
//   - Web Share with files (mobile): opens "Save to Files"/Drive to place in a real folder.
//   - Download (everywhere): lands in the browser's Downloads folder.
// Everything runs locally; nothing is uploaded.

import type { StoredDocument } from '@/domain/types';
import { getCapabilities } from '@/services/capabilities';
import { downloadBlob, shareFile } from '@/utils/fileActions';
import { sanitizeFilenameBase } from '@/utils/filename';
import { createZipBlob, type ZipEntry } from '@/utils/zip';

export type ExportOutcome = 'saved' | 'shared' | 'downloaded' | 'cancelled' | 'failed';

// Minimal typings for the File System Access API (not in older lib.dom versions).
interface SavePickerOptions {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}
interface FsWritable {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
}
interface FsFileHandle {
  createWritable: () => Promise<FsWritable>;
}
interface FsDirHandle {
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<FsFileHandle>;
  getDirectoryHandle: (name: string, opts?: { create?: boolean }) => Promise<FsDirHandle>;
}
type FsWindow = Window &
  typeof globalThis & {
    showSaveFilePicker?: (opts?: SavePickerOptions) => Promise<FsFileHandle>;
    showDirectoryPicker?: () => Promise<FsDirHandle>;
  };

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/** Ensure a unique filename within a set of already-used names (case-insensitive). */
function uniqueName(name: string, used: Set<string>): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let candidate = name;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} (${i})${ext}`;
    i++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export class ExportService {
  /** Export a single PDF to a real location the user chooses. */
  async exportDocument(doc: StoredDocument): Promise<ExportOutcome> {
    return this.saveBlob(doc.pdfBlob, doc.name, 'application/pdf');
  }

  /**
   * Export every PDF in a virtual folder to a real device folder.
   * - With the directory picker: writes each PDF into a subfolder named after the folder.
   * - Otherwise: packages them into a single <folder>.zip the user can save and extract.
   */
  async exportFolder(folderName: string, docs: StoredDocument[]): Promise<ExportOutcome> {
    if (docs.length === 0) return 'failed';
    const win = window as FsWindow;
    const safeFolder = sanitizeFilenameBase(folderName) || 'Documents';

    if (typeof win.showDirectoryPicker === 'function') {
      try {
        const root = await win.showDirectoryPicker();
        const dir = await root.getDirectoryHandle(safeFolder, { create: true });
        const used = new Set<string>();
        for (const doc of docs) {
          const name = uniqueName(doc.name, used);
          const handle = await dir.getFileHandle(name, { create: true });
          const writable = await handle.createWritable();
          await writable.write(doc.pdfBlob);
          await writable.close();
        }
        return 'saved';
      } catch (err) {
        if (isAbort(err)) return 'cancelled';
        // fall through to zip fallback
      }
    }

    // Fallback: build a single zip and save/share/download it.
    const used = new Set<string>();
    const entries: ZipEntry[] = docs.map((doc) => ({
      name: `${safeFolder}/${uniqueName(doc.name, used)}`,
      blob: doc.pdfBlob,
    }));
    const zip = await createZipBlob(entries);
    return this.saveBlob(zip, `${safeFolder}.zip`, 'application/zip');
  }

  /** Save a single blob using the best available mechanism, with fallbacks. */
  private async saveBlob(blob: Blob, filename: string, mime: string): Promise<ExportOutcome> {
    const caps = getCapabilities();
    const win = window as FsWindow;

    // 1) Desktop: native "Save As" dialog lets the user pick any folder.
    if (caps.fileSystemSave && typeof win.showSaveFilePicker === 'function') {
      try {
        const ext = filename.slice(filename.lastIndexOf('.')) || '';
        const handle = await win.showSaveFilePicker({
          suggestedName: filename,
          types: ext ? [{ description: 'File', accept: { [mime]: [ext] } }] : undefined,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return 'saved';
      } catch (err) {
        if (isAbort(err)) return 'cancelled';
        // fall through
      }
    }

    // 2) Mobile: share sheet includes "Save to Files"/Drive (a real folder).
    if (caps.webShareFiles) {
      const result = await shareFile(blob, filename, mime);
      if (result === 'shared') return 'shared';
      if (result === 'cancelled') return 'cancelled';
      // otherwise fall through to download
    }

    // 3) Universal fallback: download to the browser's Downloads folder.
    downloadBlob(blob, filename);
    return 'downloaded';
  }
}
