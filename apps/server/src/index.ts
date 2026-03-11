import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { config, isLLMEnabled } from './config.js';
import { initSchema } from './db/schema.js';
import { createApp } from './app.js';
import {
  getOrCreateSession,
  addClient,
  removeClient,
  broadcastUpdate,
  getClientCount,
  handleControlMessage,
} from './sessions.js';
import { loadYDoc, debouncedSaveYDoc, flushSave } from './persistence.js';
import { ensureBucket } from './storage.js';
import { verifyToken } from './middleware/auth.js';
import { getDeckRole } from './db/shares.js';

// Initialize database and storage
await initSchema();
await ensureBucket();

const app = createApp();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = config.port;

// WebSocket upgrade handling with JWT auth
server.on('upgrade', async (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);

  // Only handle /ws/:deckId paths
  const match = url.pathname.match(/^\/ws\/(.+)$/);
  if (!match) {
    socket.destroy();
    return;
  }

  const deckId = match[1];

  // Verify JWT from query param
  const token = url.searchParams.get('token');
  if (!token) {
    console.log(`[WS] No token provided for deck ${deckId}`);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  const claims = await verifyToken(token);
  if (!claims) {
    console.log(`[WS] Invalid token for deck ${deckId}`);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  // Check deck permissions
  const role = await getDeckRole(deckId, claims.sub);
  if (!role) {
    console.log(`[WS] No access for user ${claims.sub} on deck ${deckId}`);
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, deckId, role, token);
  });
});

// Grace period after token expiry before closing WS (allows refresh cycle)
const WS_TOKEN_GRACE_MS = 2 * 60 * 1000; // 2 minutes

// WebSocket connection handling
wss.on('connection', async (ws: WebSocket, _request: unknown, deckId: string, role: string, initialToken: string) => {
  const readOnly = role === 'viewer';
  console.log(`[WS] Client connecting to deck: ${deckId} (role: ${role}${readOnly ? ', read-only' : ''})`);

  // Get or create session
  const session = getOrCreateSession(deckId);

  // Load YDoc if this is first client
  if (session.clients.size === 0) {
    const loadedDoc = await loadYDoc(deckId);
    if (loadedDoc) {
      // Apply loaded state to session doc
      const state = Y.encodeStateAsUpdate(loadedDoc);
      Y.applyUpdate(session.ydoc, state);
    }
  }

  // Add client to session
  addClient(deckId, ws);

  // Send initial state to client
  const initialState = Y.encodeStateAsUpdate(session.ydoc);
  ws.send(initialState);

  // --- Token expiry tracking ---
  let tokenExpiryTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleTokenExpiry = (jwtToken: string) => {
    if (tokenExpiryTimer) clearTimeout(tokenExpiryTimer);
    try {
      const payload = JSON.parse(Buffer.from(jwtToken.split('.')[1], 'base64').toString());
      const exp = payload.exp as number;
      if (!exp) return;
      const expiresIn = exp * 1000 - Date.now() + WS_TOKEN_GRACE_MS;
      if (expiresIn <= 0) {
        console.log(`[WS] Token already expired for ${deckId}, closing`);
        ws.close(4003, 'Token expired');
        return;
      }
      tokenExpiryTimer = setTimeout(() => {
        console.log(`[WS] Token expired (with grace) for ${deckId}, closing connection`);
        ws.close(4003, 'Token expired');
      }, expiresIn);
    } catch {
      // Can't parse token — don't enforce expiry
    }
  };

  // Start expiry timer from the initial connect token
  scheduleTokenExpiry(initialToken);

  // Handle incoming messages from client
  ws.on('message', (data: Buffer, isBinary: boolean) => {
    // JSON control messages (text frames)
    if (!isBinary) {
      try {
        const msg = JSON.parse(data.toString());

        // Handle token refresh — client sends fresh JWT to extend WS session
        if (msg.type === 'auth:refresh-token' && typeof msg.token === 'string') {
          verifyToken(msg.token).then(claims => {
            if (claims) {
              scheduleTokenExpiry(msg.token);
            } else {
              console.warn(`[WS] Invalid refresh token for ${deckId}`);
            }
          });
          return;
        }

        handleControlMessage(deckId, ws, msg);
      } catch (error) {
        console.error(`[WS] Invalid JSON message for ${deckId}:`, error);
      }
      return;
    }

    // Binary YDoc updates — viewers cannot send these
    if (readOnly) return;

    try {
      const update = new Uint8Array(data);

      // Apply update to YDoc
      Y.applyUpdate(session.ydoc, update);

      // Broadcast to other clients (excluding sender)
      broadcastUpdate(deckId, update, ws);

      // Debounced save to database
      debouncedSaveYDoc(deckId, session.ydoc);
    } catch (error) {
      console.error(`[WS] Error processing message for ${deckId}:`, error);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    if (tokenExpiryTimer) clearTimeout(tokenExpiryTimer);
    removeClient(deckId, ws);

    // If last client, flush save immediately
    if (getClientCount(deckId) === 0) {
      void flushSave(deckId, session.ydoc);
    }
  });

  ws.on('error', (error) => {
    console.error(`[WS] Error for ${deckId}:`, error);
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] WebSocket available at ws://localhost:${PORT}/ws/:deckId`);
  console.log(`[Server] LLM chat: ${isLLMEnabled() ? 'enabled' : 'disabled (set ANTHROPIC_API_KEY)'}`);
});
