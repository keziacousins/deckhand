/**
 * Hook to resolve asset URLs to authenticated blob URLs.
 *
 * Web components render images via CSS `url()` / `<img src>` which can't
 * include Authorization headers.  This hook pre-fetches each asset through
 * `apiFetch` (which attaches the bearer token) and replaces the `/api/...`
 * URLs with `blob:` URLs so the browser can load them without auth.
 */

import { useEffect, useRef, useState } from 'react';
import type { Asset } from '@deckhand/schema';
import { apiFetch } from '../api/decks';

type AssetsMap = Record<string, Asset>;

export function useAuthAssets(assets: AssetsMap): AssetsMap {
  const [resolved, setResolved] = useState<AssetsMap>(assets);
  // Track blob URLs we've created so we can revoke them on cleanup
  const blobUrlsRef = useRef<Map<string, string>>(new Map());
  // Track which source URLs we've already fetched (avoid re-fetching)
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const entries = Object.entries(assets);
    if (entries.length === 0) {
      setResolved(assets);
      return;
    }

    // Find assets we haven't fetched yet
    const toFetch = entries.filter(([, asset]) => !fetchedRef.current.has(asset.url));

    if (toFetch.length === 0) {
      // All already resolved — rebuild map with existing blob URLs
      const result: AssetsMap = {};
      for (const [id, asset] of entries) {
        const blobUrl = blobUrlsRef.current.get(asset.url);
        result[id] = blobUrl ? { ...asset, url: blobUrl } : asset;
      }
      setResolved(result);
      return;
    }

    // Fetch new assets
    Promise.all(
      toFetch.map(async ([, asset]) => {
        try {
          const res = await apiFetch(asset.url);
          if (!res.ok) return;
          const blob = await res.blob();
          if (cancelled) return;
          const blobUrl = URL.createObjectURL(blob);
          blobUrlsRef.current.set(asset.url, blobUrl);
          fetchedRef.current.add(asset.url);
        } catch {
          // Failed to fetch — leave original URL
          fetchedRef.current.add(asset.url);
        }
      })
    ).then(() => {
      if (cancelled) return;
      const result: AssetsMap = {};
      for (const [id, asset] of entries) {
        const blobUrl = blobUrlsRef.current.get(asset.url);
        result[id] = blobUrl ? { ...asset, url: blobUrl } : asset;
      }
      setResolved(result);
    });

    return () => {
      cancelled = true;
    };
  }, [assets]);

  // Revoke all blob URLs on unmount
  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      for (const blobUrl of urls.values()) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, []);

  return resolved;
}
