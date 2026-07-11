import { useEffect, useState } from 'react';

/**
 * Create an object URL for a Blob and revoke it automatically when the blob changes or the
 * component unmounts. Returns undefined when no blob is provided.
 */
export function useObjectUrl(blob: Blob | undefined | null): string | undefined {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return url;
}
