/**
 * React hook for YDoc synchronization via WebSocket.
 *
 * Connects to the server's WebSocket endpoint and keeps a local YDoc
 * in sync. Provides the current deck state, update function, and undo/redo.
 * 
 * Handles disconnection gracefully with automatic reconnection.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { yDocToDeck, diffDeck, applyPatchesToYDoc } from '@deckhand/sync';
import type { Deck } from '@deckhand/schema';
import { getAuthToken } from '../api/decks';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ControlMessage {
  type: string;
  [key: string]: unknown;
}

type MessageHandler = (msg: ControlMessage) => void;

interface UseYDocResult {
  /** Current deck state (null while loading) */
  deck: Deck | null;
  /** Connection status */
  status: ConnectionStatus;
  /** Whether we've ever successfully synced (for offline indicator) */
  hasEverSynced: boolean;
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
  /** Subscribe to JSON control messages by type. Returns unsubscribe function. */
  onMessage: (type: string, handler: MessageHandler) => () => void;
  /** Send a JSON control message to the server */
  sendMessage: (msg: ControlMessage) => void;
  /** Send a refreshed auth token to extend the WebSocket session */
  refreshWsToken: () => void;
}

// Use same-origin WebSocket - Vite proxies /ws in dev, same-origin in prod
const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

// Reconnection settings
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const INITIAL_SYNC_TIMEOUT_MS = 15000;

export function useYDoc(deckId: string): UseYDocResult {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [hasEverSynced, setHasEverSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const ydocRef = useRef<Y.Doc | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const deckRef = useRef<Deck | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEverSyncedRef = useRef(false);
  const initialSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletedRef = useRef(false);
  const messageHandlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());

  // Keep deckRef in sync with state for use in callbacks
  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  // Calculate reconnect delay with exponential backoff
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptRef.current),
      RECONNECT_MAX_MS
    );
    return delay;
  }, []);

  useEffect(() => {
    let aborted = false; // Prevents stale closures from reconnecting after cleanup
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Set up UndoManager to track all changes from 'local' origin
    const root = ydoc.getMap('root');
    const undoManager = new Y.UndoManager([root], {
      trackedOrigins: new Set(['local']),
      captureTimeout: 500,
    });
    undoManagerRef.current = undoManager;

    // Update undo/redo counts when stack changes
    const updateStackCounts = () => {
      setUndoCount(undoManager.undoStack.length);
      setRedoCount(undoManager.redoStack.length);
    };

    undoManager.on('stack-item-added', updateStackCounts);
    undoManager.on('stack-item-popped', updateStackCounts);

    // Update local state when YDoc changes
    const updateFromYDoc = () => {
      try {
        const newDeck = yDocToDeck(ydoc);
        if (newDeck?.meta?.id) {
          setDeck(newDeck);
          // Mark as synced once we have valid data
          if (!hasEverSyncedRef.current) {
            hasEverSyncedRef.current = true;
            setHasEverSynced(true);
            // Clear initial sync timeout
            if (initialSyncTimeoutRef.current) {
              clearTimeout(initialSyncTimeoutRef.current);
              initialSyncTimeoutRef.current = null;
            }
          }
        }
      } catch (err) {
        console.error('[YDoc] Error converting YDoc to deck:', err);
      }
    };

    ydoc.on('update', updateFromYDoc);

    // WebSocket connection function (for initial connect and reconnect)
    const connect = () => {
      if (aborted) return;
      // Don't reconnect if we're already connected, connecting, or closing
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        return;
      }

      const token = getAuthToken();
      const wsUrl = token
        ? `${WS_BASE}/ws/${deckId}?token=${encodeURIComponent(token)}`
        : `${WS_BASE}/ws/${deckId}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      setStatus('connecting');

      ws.onopen = () => {
        setStatus('connected');
        setError(null);
        reconnectAttemptRef.current = 0; // Reset backoff on successful connect
        
        // If we already have state, send it to sync
        if (ydoc.store.clients.size > 0) {
          const update = Y.encodeStateAsUpdate(ydoc);
          ws.send(update);
        }
      };

      ws.onmessage = (event) => {
        // Control messages are JSON strings (not binary YDoc updates)
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data) as ControlMessage;
            if (msg.type === 'deck-deleted') {
              console.log('[YDoc] Deck has been deleted');
              deletedRef.current = true;
              setStatus('error');
              setError('This deck has been deleted');
              ws.close();
              return;
            }
            // Dispatch to subscribers
            const handlers = messageHandlersRef.current.get(msg.type);
            handlers?.forEach(h => h(msg));
          } catch (err) {
            console.warn('[YDoc] Failed to parse control message:', err);
          }
          return;
        }
        try {
          const update = new Uint8Array(event.data);
          Y.applyUpdate(ydoc, update);
        } catch (err) {
          console.error('[YDoc] Error applying update:', err);
        }
      };

      ws.onclose = (event) => {
        console.log(`[YDoc] WS closed: code=${event.code} reason=${event.reason} clean=${event.wasClean}`);
        wsRef.current = null;

        // If deck was deleted (via control message), don't reconnect
        if (deletedRef.current) return;

        setStatus('disconnected');

        // Check for specific close codes
        if (event.code === 4000) {
          setError('Server unavailable - retrying...');
        } else if (event.code === 4001) {
          setError('Deck not found');
          return; // Don't reconnect for not found
        } else if (event.code === 4002) {
          setStatus('error');
          setError('This deck has been deleted');
          return; // Don't reconnect for deleted deck
        } else if (event.code === 4003) {
          // Token expired — reconnect immediately with fresh token
          console.log('[YDoc] Token expired, reconnecting with fresh token...');
          reconnectAttemptRef.current = 0;
        }
        
        // Don't reconnect if effect was cleaned up
        if (aborted) return;

        // Schedule reconnect with backoff
        reconnectAttemptRef.current++;
        const delay = getReconnectDelay();
        console.log(`[YDoc] Disconnected, reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = () => {
        // onerror is always followed by onclose, so we handle reconnection there
        if (!hasEverSyncedRef.current) {
          setError('Connection failed');
        }
      };
    };

    // Initial connection
    connect();

    // Set up initial sync timeout (only for first connection)
    initialSyncTimeoutRef.current = setTimeout(() => {
      if (!hasEverSyncedRef.current) {
        setStatus('error');
        setError('Connection timeout - please check your network and try again');
      }
    }, INITIAL_SYNC_TIMEOUT_MS);

    // Reconnect when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const ws = wsRef.current;
        if (!ws || ws.readyState === WebSocket.CLOSED) {
          console.log('[YDoc] Tab visible, reconnecting...');
          connect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      aborted = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (initialSyncTimeoutRef.current) {
        clearTimeout(initialSyncTimeoutRef.current);
      }
      
      ydoc.off('update', updateFromYDoc);
      undoManager.destroy();
      ydoc.destroy();
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      ydocRef.current = null;
      undoManagerRef.current = null;
    };
  }, [deckId, getReconnectDelay]);

  const updateDeck = useCallback((updater: (deck: Deck) => Deck) => {
    const ydoc = ydocRef.current;
    const ws = wsRef.current;
    const currentDeck = deckRef.current;

    if (!ydoc || !currentDeck) {
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

    // Immediately update local state so next edit has fresh deck
    // (Don't wait for YDoc update event which may have timing issues)
    setDeck(newDeck);
    deckRef.current = newDeck;

    // Send update to server if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
      const update = Y.encodeStateAsUpdate(ydoc);
      ws.send(update);
    }
    // If not connected, changes are still in YDoc and will sync on reconnect
  }, []);

  const undo = useCallback(() => {
    const undoManager = undoManagerRef.current;
    const ydoc = ydocRef.current;
    const ws = wsRef.current;
    
    if (!undoManager || !ydoc) {
      return;
    }

    undoManager.undo();
    
    // Rebuild deck state from YDoc and update React state
    const newDeck = yDocToDeck(ydoc);
    if (newDeck?.meta?.id) {
      setDeck(newDeck);
    }
    
    // Send update to server if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
      const update = Y.encodeStateAsUpdate(ydoc);
      ws.send(update);
    }
  }, []);

  const redo = useCallback(() => {
    const undoManager = undoManagerRef.current;
    const ydoc = ydocRef.current;
    const ws = wsRef.current;
    
    if (!undoManager || !ydoc) {
      return;
    }

    undoManager.redo();
    
    // Rebuild deck state from YDoc
    const newDeck = yDocToDeck(ydoc);
    if (newDeck?.meta?.id) {
      setDeck(newDeck);
    }
    
    // Send update to server if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
      const update = Y.encodeStateAsUpdate(ydoc);
      ws.send(update);
    }
  }, []);

  const onMessage = useCallback((type: string, handler: MessageHandler) => {
    if (!messageHandlersRef.current.has(type)) {
      messageHandlersRef.current.set(type, new Set());
    }
    messageHandlersRef.current.get(type)!.add(handler);

    return () => {
      messageHandlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  const sendMessage = useCallback((msg: ControlMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Send a refreshed auth token to the server to extend the WS session
  const refreshWsToken = useCallback(() => {
    const token = getAuthToken();
    if (token && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'auth:refresh-token', token }));
    }
  }, []);

  const canUndo = undoCount > 0;
  const canRedo = redoCount > 0;

  return { deck, status, hasEverSynced, error, updateDeck, undo, redo, canUndo, canRedo, onMessage, sendMessage, refreshWsToken };
}
