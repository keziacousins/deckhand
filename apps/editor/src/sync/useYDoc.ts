/**
 * React hook for YDoc synchronization via WebSocket.
 *
 * Connects to the server's WebSocket endpoint and keeps a local YDoc
 * in sync. Provides the current deck state and an update function.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { yDocToDeck, deckToYDoc, diffDeck, applyPatchesToYDoc } from '@deckhand/sync';
import type { Deck } from '@deckhand/schema';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseYDocResult {
  /** Current deck state (null while loading) */
  deck: Deck | null;
  /** Connection status */
  status: ConnectionStatus;
  /** Error message if status is 'error' */
  error: string | null;
  /** Update the deck - applies diff and syncs via YDoc */
  updateDeck: (updater: (deck: Deck) => Deck) => void;
}

const WS_BASE = import.meta.env.DEV
  ? `ws://localhost:3001`
  : `ws://${window.location.host}`;

export function useYDoc(deckId: string): UseYDocResult {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);

  const ydocRef = useRef<Y.Doc | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const deckRef = useRef<Deck | null>(null);

  // Keep deckRef in sync with state for use in callbacks
  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const ws = new WebSocket(`${WS_BASE}/ws/${deckId}`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    // Update local state when YDoc changes
    const updateFromYDoc = () => {
      try {
        const newDeck = yDocToDeck(ydoc);
        // Only update if we have valid data
        if (newDeck?.meta?.id) {
          setDeck(newDeck);
        }
      } catch (e) {
        console.error('[useYDoc] Error converting YDoc to deck:', e);
      }
    };

    // Listen for YDoc updates (from remote or local changes)
    ydoc.on('update', updateFromYDoc);

    ws.onopen = () => {
      console.log(`[useYDoc] Connected to ${deckId}`);
      setStatus('connected');
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const update = new Uint8Array(event.data);
        Y.applyUpdate(ydoc, update);
      } catch (e) {
        console.error('[useYDoc] Error applying update:', e);
      }
    };

    ws.onclose = () => {
      console.log(`[useYDoc] Disconnected from ${deckId}`);
      setStatus('disconnected');
    };

    ws.onerror = (e) => {
      console.error('[useYDoc] WebSocket error:', e);
      setStatus('error');
      setError('Connection failed');
    };

    return () => {
      ydoc.off('update', updateFromYDoc);
      ydoc.destroy();
      ws.close();
      ydocRef.current = null;
      wsRef.current = null;
    };
  }, [deckId]);

  const updateDeck = useCallback((updater: (deck: Deck) => Deck) => {
    const ydoc = ydocRef.current;
    const ws = wsRef.current;
    const currentDeck = deckRef.current;

    if (!ydoc || !ws || ws.readyState !== WebSocket.OPEN || !currentDeck) {
      console.warn('[useYDoc] Cannot update: not connected or no deck');
      return;
    }

    // Compute new deck state
    const newDeck = updater(currentDeck);

    // Diff and apply patches to YDoc
    const patches = diffDeck(currentDeck, newDeck);
    if (patches.length === 0) return;

    ydoc.transact(() => {
      applyPatchesToYDoc(patches, ydoc);
    });

    // Send update to server
    const update = Y.encodeStateAsUpdate(ydoc);
    ws.send(update);
  }, []);

  return { deck, status, error, updateDeck };
}
