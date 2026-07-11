import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScanFlow } from '@/context/ScanFlowContext';
import { useToast } from '@/context/ToastContext';

const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif|bmp|gif)$/i;
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per image
const MAX_FILES = 50;

/**
 * Import one or more images from the photo library / file picker. Validates type and size,
 * starts (or continues) a scan session, and routes to the review screen. Also used as the
 * camera fallback on devices without live camera access.
 */
export function ImportButton({
  className = 'btn btn--block',
  label = 'Import Images',
  folderId,
}: {
  className?: string;
  label?: string;
  folderId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { session, startNew, addCapture } = useScanFlow();
  const { show } = useToast();

  const onFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, MAX_FILES);

    if (!session) {
      startNew(folderId);
    }

    let added = 0;
    let rejected = 0;
    for (const file of files) {
      // Some browsers report an empty type for HEIC; fall back to extension sniffing.
      const looksImage =
        ACCEPTED.test(file.type) || /\.(jpe?g|png|webp|heich?|bmp|gif)$/i.test(file.name);
      if (!looksImage || file.size === 0) {
        rejected++;
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejected++;
        continue;
      }
      try {
        await addCapture(file);
        added++;
      } catch {
        rejected++;
      }
    }

    if (inputRef.current) inputRef.current.value = '';

    if (added === 0) {
      show('No valid images were imported. Please choose JPEG or PNG images.', 'error');
      return;
    }
    if (rejected > 0) {
      show(`Imported ${added} image${added === 1 ? '' : 's'}; skipped ${rejected}.`, 'info');
    }
    navigate('/review');
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => void onFiles(e.target.files)}
      />
      <button type="button" className={className} onClick={() => inputRef.current?.click()}>
        <span aria-hidden="true">🖼️</span> {label}
      </button>
    </>
  );
}
