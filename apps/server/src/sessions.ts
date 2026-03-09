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
  for (const client of session.clients) {
    try {
      // Send a control message before closing — Vite's WS proxy swallows close codes,
      // so the client needs to detect deletion from a message instead.
      client.send(JSON.stringify({ type: 'deck-deleted' }));
      client.close(4002, 'Deck deleted');
    } catch {
      // Ignore send/close errors
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
