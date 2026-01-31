/**
 * React hook for YDoc synchronization via WebSocket.
 *
 * Connects to the server's WebSocket endpoint and keeps a local YDoc
 * in sync. Provides the current deck state, update function, and undo/redo.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { yDocToDeck, diffDeck, applyPatchesToYDoc } from '@deckhand/sync';
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
  /** Undo last change */
  undo: () => void;
  /** Redo previously undone change */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
}

const WS_BASE = import.meta.env.DEV
  ? `ws://localhost:3001`
  : `ws://${window.location.host}`;

export function useYDoc(deckId: string): UseYDocResult {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const ydocRef = useRef<Y.Doc | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const deckRef = useRef<Deck | null>(null);

  // Keep deckRef in sync with state for use in callbacks
  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Set up UndoManager to track all changes from 'local' origin
    // We track the root map - Y.UndoManager will capture all nested changes
    const root = ydoc.getMap('root');
    const undoManager = new Y.UndoManager([root], {
      trackedOrigins: new Set(['local']),
      // Don't merge changes - each transaction is a separate undo item
      captureTimeout: 0,
    });
    undoManagerRef.current = undoManager;

    // Update undo/redo counts when stack changes
    const updateStackCounts = () => {
      setUndoCount(undoManager.undoStack.length);
      setRedoCount(undoManager.redoStack.length);
    };

    undoManager.on('stack-item-added', updateStackCounts);
    undoManager.on('stack-item-popped', updateStackCounts);

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
      } catch {
        // Error converting YDoc to deck - ignore
      }
    };

    // Listen for YDoc updates (from remote or local changes)
    ydoc.on('update', updateFromYDoc);

    ws.onopen = () => {
      setStatus('connected');
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const update = new Uint8Array(event.data);
        Y.applyUpdate(ydoc, update);
      } catch {
        // Error applying update - ignore
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = () => {
      setStatus('error');
      setError('Connection failed');
    };

    return () => {
      ydoc.off('update', updateFromYDoc);
      undoManager.destroy();
      ydoc.destroy();
      ws.close();
      ydocRef.current = null;
      undoManagerRef.current = null;
      wsRef.current = null;
    };
  }, [deckId]);

  const updateDeck = useCallback((updater: (deck: Deck) => Deck) => {
    const ydoc = ydocRef.current;
    const ws = wsRef.current;
    const currentDeck = deckRef.current;

    if (!ydoc || !ws || ws.readyState !== WebSocket.OPEN || !currentDeck) {
      return;
    }

    // Compute new deck state
    const newDeck = updater(currentDeck);

    // Diff and apply patches to YDoc
    const patches = diffDeck(currentDeck, newDeck);
    if (patches.length === 0) {
      return;
    }

    // Apply in transaction with 'local' origin so UndoManager tracks it
    ydoc.transact(() => {
      applyPatchesToYDoc(patches, ydoc);
    }, 'local');

    // Send update to server
    const update = Y.encodeStateAsUpdate(ydoc);
    ws.send(update);
  }, []);

  const undo = useCallback(() => {
    const undoManager = undoManagerRef.current;
    const ydoc = ydocRef.current;
    const ws = wsRef.current;
    
    if (!undoManager || !ydoc || !ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    undoManager.undo();
    
    // Rebuild deck state from YDoc and update React state
    const newDeck = yDocToDeck(ydoc);
    if (newDeck?.meta?.id) {
      setDeck(newDeck);
    }
    
    // Send update to server
    const update = Y.encodeStateAsUpdate(ydoc);
    ws.send(update);
  }, []);

  const redo = useCallback(() => {
    const undoManager = undoManagerRef.current;
    const ydoc = ydocRef.current;
    const ws = wsRef.current;
    
    if (!undoManager || !ydoc || !ws || ws.readyState !== WebSocket.OPEN) return;

    undoManager.redo();
    
    // Rebuild deck state from YDoc
    const newDeck = yDocToDeck(ydoc);
    if (newDeck?.meta?.id) {
      setDeck(newDeck);
    }
    
    // Send update to server
    const update = Y.encodeStateAsUpdate(ydoc);
    ws.send(update);
  }, []);

  const canUndo = undoCount > 0;
  const canRedo = redoCount > 0;

  return { deck, status, error, updateDeck, undo, redo, canUndo, canRedo };
}
