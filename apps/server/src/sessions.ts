/**
 * Active session tracking for collaborative editing.
 */

import * as Y from 'yjs';

interface Session {
  ydoc: Y.Doc;
  clientCount: number;
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
      clientCount: 0,
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
  if (session && session.clientCount > 0) {
    return session;
  }
  return null;
}

/**
 * Increment client count for a session
 */
export function addClient(deckId: string): void {
  const session = getOrCreateSession(deckId);
  session.clientCount++;
  session.lastActivity = new Date();
  console.log(`[Session] Client joined ${deckId} (${session.clientCount} clients)`);
}

/**
 * Decrement client count for a session
 */
export function removeClient(deckId: string): void {
  const session = sessions.get(deckId);
  if (session) {
    session.clientCount = Math.max(0, session.clientCount - 1);
    session.lastActivity = new Date();
    console.log(`[Session] Client left ${deckId} (${session.clientCount} clients)`);

    // Clean up session after a delay if no clients
    if (session.clientCount === 0) {
      setTimeout(() => {
        const current = sessions.get(deckId);
        if (current && current.clientCount === 0) {
          sessions.delete(deckId);
          console.log(`[Session] Cleaned up ${deckId}`);
        }
      }, 30000); // 30 second delay before cleanup
    }
  }
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
    .filter(([_, session]) => session.clientCount > 0)
    .map(([deckId, session]) => ({
      deckId,
      clientCount: session.clientCount,
      lastActivity: session.lastActivity.toISOString(),
    }));
}
