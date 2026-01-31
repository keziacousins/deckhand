import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { initSchema } from './db/schema.js';
import { createApp } from './app.js';
import {
  getOrCreateSession,
  addClient,
  removeClient,
} from './sessions.js';
import { loadYDoc, debouncedSaveYDoc, flushSave } from './persistence.js';

// Initialize database
initSchema();

const app = createApp();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = process.env.PORT || 3001;

// WebSocket upgrade handling
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);

  // Only handle /ws/:deckId paths
  const match = url.pathname.match(/^\/ws\/(.+)$/);
  if (!match) {
    socket.destroy();
    return;
  }

  const deckId = match[1];

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, deckId);
  });
});

// WebSocket connection handling
wss.on('connection', (ws: WebSocket, _request: unknown, deckId: string) => {
  console.log(`[WS] Client connecting to deck: ${deckId}`);

  // Get or create session
  const session = getOrCreateSession(deckId);

  // Load YDoc if this is first client
  if (session.clientCount === 0) {
    const loadedDoc = loadYDoc(deckId);
    if (loadedDoc) {
      // Apply loaded state to session doc
      const state = Y.encodeStateAsUpdate(loadedDoc);
      Y.applyUpdate(session.ydoc, state);
    }
  }

  addClient(deckId);

  // Send initial state to client
  const initialState = Y.encodeStateAsUpdate(session.ydoc);
  ws.send(initialState);

  // Handle incoming updates from client
  ws.on('message', (data: Buffer) => {
    try {
      // Apply update to YDoc
      Y.applyUpdate(session.ydoc, new Uint8Array(data));

      // Broadcast to other clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });

      // Debounced save to database
      debouncedSaveYDoc(deckId, session.ydoc);
    } catch (error) {
      console.error(`[WS] Error processing message for ${deckId}:`, error);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    removeClient(deckId);

    // If last client, flush save immediately
    const currentSession = getOrCreateSession(deckId);
    if (currentSession.clientCount === 0) {
      flushSave(deckId, session.ydoc);
    }
  });

  ws.on('error', (error) => {
    console.error(`[WS] Error for ${deckId}:`, error);
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] WebSocket available at ws://localhost:${PORT}/ws/:deckId`);
});
