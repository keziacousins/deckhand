import { useState, useEffect } from 'react';
import { apiFetch } from '../api/decks';

interface AuthImageProps {
  src: string;
  alt?: string;
  className?: string;
}

/**
 * Image component that fetches via apiFetch (with auth token)
 * and renders as a blob URL. Use this instead of <img src={url}>
 * for any authenticated asset endpoints.
 */
export function AuthImage({ src, alt = '', className }: AuthImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    apiFetch(src).then((res) => {
      if (!res.ok) return;
      return res.blob();
    }).then((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      revoke = url;
      setBlobUrl(url);
    }).catch(() => {});

    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [src]);

  if (!blobUrl) return null;
  return <img src={blobUrl} alt={alt} className={className} />;
}
