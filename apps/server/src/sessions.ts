/**
 * Active session tracking for collaborative editing.
 */

import * as Y from 'yjs';
import type { WebSocket } from 'ws';

interface Session {
  ydoc: Y.Doc;
  clients: Set<WebSocket>;
  lastActivity: Date;
}

// In-memory map of active sessions
const sessions = new Map<string, Session>();

/**
 * Get or create a session for a deck
 */
export function getOrCreateSession(deckId: string): Session {
  let session = sessions.get(deckId);
  if (!session) {
    session = {
      ydoc: new Y.Doc(),
      clients: new Set(),
      lastActivity: new Date(),
    };
    sessions.set(deckId, session);
  }
  return session;
}

/**
 * Get an active session (if exists)
 */
export function getActiveSession(deckId: string): Session | null {
  const session = sessions.get(deckId);
  if (session && session.clients.size > 0) {
    return session;
  }
  return null;
}

/**
 * Add a client WebSocket to a session
 */
export function addClient(deckId: string, ws: WebSocket): void {
  const session = getOrCreateSession(deckId);
  session.clients.add(ws);
  session.lastActivity = new Date();
  console.log(`[Session] Client joined ${deckId} (${session.clients.size} clients)`);
}

/**
 * Remove a client WebSocket from a session
 */
export function removeClient(deckId: string, ws: WebSocket): void {
  const session = sessions.get(deckId);
  if (session) {
    session.clients.delete(ws);
    session.lastActivity = new Date();
    console.log(`[Session] Client left ${deckId} (${session.clients.size} clients)`);

    // Clean up session after a delay if no clients
    if (session.clients.size === 0) {
      setTimeout(() => {
        const current = sessions.get(deckId);
        if (current && current.clients.size === 0) {
          sessions.delete(deckId);
          console.log(`[Session] Cleaned up ${deckId}`);
        }
      }, 30000); // 30 second delay before cleanup
    }
  }
}

/**
 * Broadcast a YDoc update to all clients in a session
 */
export function broadcastUpdate(deckId: string, update: Uint8Array, excludeWs?: WebSocket): void {
  const session = sessions.get(deckId);
  if (!session) return;

  for (const client of session.clients) {
    if (client !== excludeWs && client.readyState === 1) { // 1 = OPEN
      try {
        client.send(update);
      } catch (err) {
        console.error(`[Session] Failed to send to client:`, err);
      }
    }
  }
}

/**
 * Broadcast the current YDoc state to all clients
 */
export function broadcastYDocState(deckId: string): void {
  const session = sessions.get(deckId);
  if (!session || session.clients.size === 0) return;

  const update = Y.encodeStateAsUpdate(session.ydoc);
  broadcastUpdate(deckId, update);
}

/**
 * Broadcast a JSON control message to all clients in a session.
 */
export function broadcastJSON(deckId: string, message: object, excludeWs?: WebSocket): void {
  const session = sessions.get(deckId);
  if (!session) return;

  const data = JSON.stringify(message);
  for (const client of session.clients) {
    if (client !== excludeWs && client.readyState === 1) {
      try {
        client.send(data);
      } catch (err) {
        console.error('[Session] Failed to send JSON to client:', err);
      }
    }
  }
}

/**
 * Send a JSON control message to a specific client.
 */
export function sendJSON(ws: WebSocket, message: object): void {
  if (ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(message));
    } catch (err) {
      console.error('[Session] Failed to send JSON to client:', err);
    }
  }
}

/**
 * Force-close all clients and remove a session.
 * Used when deleting a deck — owner has authority to end all connections.
 */
export function closeSession(deckId: string): void {
  const session = sessions.get(deckId);
  if (!session) {
    console.log(`[Session] No session found for ${deckId} — nothing to close`);
    return;
  }

  console.log(`[Session] Closing session for ${deckId} — ${session.clients.size} client(s)`);
  // Send a control message before closing — Vite's WS proxy swallows close codes,
  // so the client needs to detect deletion from a message instead.
  broadcastJSON(deckId, { type: 'deck-deleted' });
  for (const client of session.clients) {
    try {
      client.close(4002, 'Deck deleted');
    } catch {
      // Ignore close errors
    }
  }
  session.clients.clear();
  sessions.delete(deckId);
  console.log(`[Session] Force-closed session for ${deckId}`);
}

/**
 * Get client count for a session
 */
export function getClientCount(deckId: string): number {
  const session = sessions.get(deckId);
  return session?.clients.size ?? 0;
}

// ============================================================================
// Control message handling
// ============================================================================

interface ControlMessage {
  type: string;
  [key: string]: unknown;
}

// Pending capture requests awaiting client response
const pendingCaptures = new Map<string, {
  resolve: (url: string) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}>();

/**
 * Handle an incoming JSON control message from a client.
 */
export function handleControlMessage(_deckId: string, _ws: WebSocket, msg: ControlMessage): void {
  switch (msg.type) {
    case 'response:capture-slide': {
      const requestId = msg.requestId as string;
      const dataUrl = msg.dataUrl as string | undefined;
      const error = msg.error as string | undefined;
      const pending = pendingCaptures.get(requestId);
      if (!pending) return;

      clearTimeout(pending.timeout);
      pendingCaptures.delete(requestId);

      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(dataUrl!);
      }
      break;
    }
    default:
      console.warn(`[Session] Unknown control message type: ${msg.type}`);
  }
}

/**
 * Request a slide capture from a connected client.
 * Returns a promise that resolves with the base64 data URL (data:image/jpeg;base64,...).
 */
export async function requestCapture(deckId: string, slideId: string): Promise<string> {
  const session = sessions.get(deckId);
  if (!session || session.clients.size === 0) {
    throw new Error('No clients connected to capture slide');
  }

  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCaptures.delete(requestId);
      reject(new Error('Capture timeout'));
    }, 10000);

    pendingCaptures.set(requestId, { resolve, reject, timeout });

    // Send to first connected client
    const client = session.clients.values().next().value!;
    sendJSON(client, {
      type: 'command:capture-slide',
      requestId,
      slideId,
    });
  });
}

/**
 * Get all active sessions info
 */
export function getAllSessions(): Array<{
  deckId: string;
  clientCount: number;
  lastActivity: string;
}> {
  return Array.from(sessions.entries())
    .filter(([_, session]) => session.clients.size > 0)
    .map(([deckId, session]) => ({
      deckId,
      clientCount: session.clients.size,
      lastActivity: session.lastActivity.toISOString(),
    }));
}
