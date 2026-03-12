/**
 * Hook to resolve asset URLs to authenticated blob URLs.
 *
 * Web components render images via CSS `url()` / `<img src>` which can't
 * include Authorization headers.  This hook pre-fetches each asset through
 * `apiFetch` (which attaches the bearer token) and replaces the `/api/...`
 * URLs with `blob:` URLs so the browser can load them without auth.
 *
 * The `preferSize` option controls which image variant to fetch:
 * - 'full' (default): Original asset (for presentation mode)
 * - 'preview': 800px WebP variant (for canvas at normal/low zoom)
 * Assets without `hasThumbnail` always fall back to 'full'.
 */

import { useEffect, useRef, useState } from 'react';
import type { Asset } from '@deckhand/schema';
import { apiFetch } from '../api/decks';

type AssetsMap = Record<string, Asset>;
type AssetSize = 'full' | 'preview';

/** Derive the fetch URL for an asset given a preferred size. */
function getAssetFetchUrl(asset: Asset, preferSize: AssetSize): string {
  if (preferSize === 'preview' && asset.hasThumbnail) {
    return `${asset.url}/preview`;
  }
  return asset.url;
}

export function useAuthAssets(assets: AssetsMap, preferSize: AssetSize = 'full'): AssetsMap {
  // Start empty — don't expose raw /api/ URLs that web components can't auth
  const [resolved, setResolved] = useState<AssetsMap>({});
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
    const toFetch = entries.filter(([, asset]) => {
      const fetchUrl = getAssetFetchUrl(asset, preferSize);
      return !fetchedRef.current.has(fetchUrl);
    });

    if (toFetch.length === 0) {
      // All already resolved — rebuild map with existing blob URLs
      const result: AssetsMap = {};
      for (const [id, asset] of entries) {
        const fetchUrl = getAssetFetchUrl(asset, preferSize);
        const blobUrl = blobUrlsRef.current.get(fetchUrl);
        result[id] = blobUrl ? { ...asset, url: blobUrl } : asset;
      }
      setResolved(result);
      return;
    }

    // Fetch new assets
    Promise.all(
      toFetch.map(async ([, asset]) => {
        const fetchUrl = getAssetFetchUrl(asset, preferSize);
        try {
          const res = await apiFetch(fetchUrl);
          if (!res.ok) return;
          const blob = await res.blob();
          if (cancelled) return;
          const blobUrl = URL.createObjectURL(blob);
          blobUrlsRef.current.set(fetchUrl, blobUrl);
          fetchedRef.current.add(fetchUrl);
        } catch (err) {
          // Failed to fetch — leave original URL, log for debugging
          console.warn('[Assets] Failed to fetch asset:', fetchUrl, err);
          fetchedRef.current.add(fetchUrl);
        }
      })
    ).then(() => {
      if (cancelled) return;
      const result: AssetsMap = {};
      for (const [id, asset] of entries) {
        const fetchUrl = getAssetFetchUrl(asset, preferSize);
        const blobUrl = blobUrlsRef.current.get(fetchUrl);
        result[id] = blobUrl ? { ...asset, url: blobUrl } : asset;
      }
      setResolved(result);
    });

    return () => {
      cancelled = true;
    };
  }, [assets, preferSize]);

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
