// Download / share / print helpers. All object URLs are revoked after use to avoid leaks.

import { getCapabilities } from '@/services/capabilities';

/** Trigger a browser download of a blob with the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoke after a tick so the download has a chance to start.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

export type ShareResult = 'shared' | 'unsupported' | 'cancelled' | 'failed';

/**
 * Share a PDF file via the Web Share API when file sharing is supported. Returns a status
 * the UI can use to fall back to download guidance. A user-cancelled share is not an error.
 */
export async function sharePdf(
  blob: Blob,
  filename: string,
  title = 'PocketScan document'
): Promise<ShareResult> {
  const caps = getCapabilities();
  if (!caps.webShare) return 'unsupported';

  return shareFile(blob, filename, 'application/pdf', title);
}

/**
 * Share an arbitrary file (e.g. a PDF or a .zip) via the Web Share API. On mobile this
 * opens the system sheet including "Save to Files"/Drive, letting the user place it in a
 * real device folder. Returns a status so the caller can fall back to download.
 */
export async function shareFile(
  blob: Blob,
  filename: string,
  mime: string,
  title = 'PocketScan export'
): Promise<ShareResult> {
  const caps = getCapabilities();
  if (!caps.webShare) return 'unsupported';
  const file = new File([blob], filename, { type: mime });
  try {
    if (caps.webShareFiles && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return 'shared';
    }
    return 'unsupported';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'cancelled';
    }
    return 'failed';
  }
}

/**
 * Print a PDF blob by loading it into a hidden iframe and invoking print. Returns false if
 * printing could not be initiated (the caller should fall back to download).
 */
export function printPdf(blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        /* ignore; browser may block */
      }
      // Clean up after the print dialog has had time to open.
      setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    };
    document.body.appendChild(iframe);
    return true;
  } catch {
    return false;
  }
}
