/**
 * Hook that listens for component render errors (e.g., bad Mermaid syntax)
 * and relays them to the server via WebSocket so the LLM can fix them.
 */

import { useEffect, useRef } from 'react';
import type { ControlMessage } from '../sync/useYDoc';

interface UseRenderErrorReporterOptions {
  sendMessage: (msg: ControlMessage) => void;
}

const DEDUP_WINDOW_MS = 2000;

export function useRenderErrorReporter({ sendMessage }: UseRenderErrorReporterOptions) {
  const recentRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        componentType: string;
        componentId: string;
        error: string;
      };

      if (!detail.componentId) return;

      // Deduplicate: suppress identical errors within the window
      const key = `${detail.componentId}:${detail.error}`;
      const now = Date.now();
      const lastSent = recentRef.current.get(key);
      if (lastSent && now - lastSent < DEDUP_WINDOW_MS) return;
      recentRef.current.set(key, now);

      sendMessage({
        type: 'render-error',
        componentType: detail.componentType,
        componentId: detail.componentId,
        error: detail.error,
      });
    };

    document.addEventListener('deck-render-error', handler);
    return () => document.removeEventListener('deck-render-error', handler);
  }, [sendMessage]);
}
