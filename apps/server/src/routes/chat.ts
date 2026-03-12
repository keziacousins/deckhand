/**
 * Chat API route for LLM-powered deck editing.
 *
 * Uses Claude with tool use to understand natural language commands
 * and apply changes to the deck via YDoc.
 */

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { config, isLLMEnabled } from '../config.js';
import { getOrCreateSession, broadcastYDocState, broadcastJSON, requestCapture, drainRenderErrors, waitForRenderErrors, getLlmUndoManager, undoLlmTurn, redoLlmTurn, getLlmUndoState, startChat, endChat } from '../sessions.js';
import { getAuthUser } from '../middleware/auth.js';
import { loadYDoc, debouncedSaveYDoc } from '../persistence.js';
import { yDocToDeck } from '@deckhand/sync';
import { pool, type ChatMessageRow, type ChatSessionRow } from '../db/schema.js';
import * as Y from 'yjs';
import { tools, executeToolCall } from '../llm/tools.js';
import { buildSystemPrompt, buildContinuationPrompt } from '../llm/prompts.js';
import { requireDeckRole } from '../middleware/permissions.js';

const router = Router();

// Default model to use if none specified
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Generate an ID with prefix
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a new chat session
 */
async function createSession(deckId: string, title?: string): Promise<string> {
  const id = generateId('chat');
  await pool.query(
    'INSERT INTO chat_sessions (id, deck_id, title) VALUES ($1, $2, $3)',
    [id, deckId, title || null]
  );
  return id;
}

/**
 * Update session timestamp and optionally title
 */
async function updateSession(sessionId: string, title?: string): Promise<void> {
  if (title) {
    await pool.query(
      'UPDATE chat_sessions SET updated_at = NOW(), title = $1 WHERE id = $2',
      [title, sessionId]
    );
  } else {
    await pool.query(
      'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
      [sessionId]
    );
  }
}

/**
 * Save a chat message to the database
 */
interface MessageSegment {
  type: 'text' | 'tool';
  content?: string;
  tool?: string;
  success?: boolean;
  result?: unknown;
}

async function saveMessage(
  sessionId: string,
  deckId: string,
  role: 'user' | 'assistant',
  content: string,
  opts?: {
    model?: string;
    toolResults?: Array<{ tool: string; success: boolean }>;
    segments?: MessageSegment[];
    userId?: string;
    userName?: string;
  }
): Promise<string> {
  const id = generateId('msg');
  await pool.query(
    `INSERT INTO chat_messages (id, session_id, deck_id, role, content, model, tool_results, segments, user_id, user_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      sessionId,
      deckId,
      role,
      content,
      opts?.model || null,
      opts?.toolResults ? JSON.stringify(opts.toolResults) : null,
      opts?.segments ? JSON.stringify(opts.segments) : null,
      opts?.userId || null,
      opts?.userName || null,
    ]
  );
  return id;
}

/**
 * Generate a session title from the first user message
 */
function generateSessionTitle(message: string): string {
  const maxLen = 50;
  if (message.length <= maxLen) return message;
  const truncated = message.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

interface ChatRequest {
  message: string;
  sessionId?: string;
  model?: string;
  undoActions?: Array<'undo' | 'redo'>;
  context?: {
    selectedSlideId?: string;
    selectedComponentId?: string;
  };
}

// ============================================================================
// Session Management Endpoints
// ============================================================================

/**
 * GET /api/decks/:deckId/chat/sessions
 */
router.get('/:deckId/chat/sessions', requireDeckRole('owner', 'editor', 'viewer'), async (req, res) => {
  const { deckId } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT * FROM chat_sessions WHERE deck_id = $1 ORDER BY updated_at DESC',
      [deckId]
    );

    const sessions = (rows as ChatSessionRow[]).map(row => ({
      id: row.id,
      title: row.title,
      model: row.model,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ sessions });
  } catch (error) {
    console.error('[Chat] Error listing sessions:', error);
    res.status(500).json({ error: 'Failed to list chat sessions' });
  }
});

/**
 * POST /api/decks/:deckId/chat/sessions
 */
router.post('/:deckId/chat/sessions', requireDeckRole('owner', 'editor'), async (req, res) => {
  const { deckId } = req.params;
  const { title } = req.body as { title?: string };

  try {
    const sessionId = await createSession(deckId, title);
    res.json({
      id: sessionId,
      title: title || null,
    });
  } catch (error) {
    console.error('[Chat] Error creating session:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});

/**
 * DELETE /api/decks/:deckId/chat/sessions/:sessionId
 */
router.delete('/:deckId/chat/sessions/:sessionId', requireDeckRole('owner', 'editor'), async (req, res) => {
  const { sessionId } = req.params;

  try {
    await pool.query('DELETE FROM chat_sessions WHERE id = $1', [sessionId]);
    res.json({ success: true });
  } catch (error) {
    console.error('[Chat] Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete chat session' });
  }
});

/**
 * PATCH /api/decks/:deckId/chat/sessions/:sessionId
 */
router.patch('/:deckId/chat/sessions/:sessionId', requireDeckRole('owner', 'editor'), async (req, res) => {
  const { sessionId } = req.params;
  const { title } = req.body as { title?: string };

  try {
    if (title !== undefined) {
      await pool.query('UPDATE chat_sessions SET title = $1 WHERE id = $2', [title, sessionId]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[Chat] Error updating session:', error);
    res.status(500).json({ error: 'Failed to update chat session' });
  }
});

// ============================================================================
// LLM Undo/Redo Endpoints
// ============================================================================

/**
 * POST /api/decks/:deckId/chat/sessions/:sessionId/undo
 * Undo the last LLM turn for this chat session.
 */
router.post('/:deckId/chat/sessions/:sessionId/undo', requireDeckRole('owner', 'editor'), async (req, res) => {
  const { deckId, sessionId } = req.params;

  const didUndo = undoLlmTurn(deckId, sessionId);
  if (didUndo) {
    // Broadcast updated YDoc state and persist
    broadcastYDocState(deckId);
    const session = getOrCreateSession(deckId);
    debouncedSaveYDoc(deckId, session.ydoc);
  }

  const state = getLlmUndoState(deckId, sessionId);
  res.json({ success: didUndo, ...state });
});

/**
 * POST /api/decks/:deckId/chat/sessions/:sessionId/redo
 * Redo a previously undone LLM turn.
 */
router.post('/:deckId/chat/sessions/:sessionId/redo', requireDeckRole('owner', 'editor'), async (req, res) => {
  const { deckId, sessionId } = req.params;

  const didRedo = redoLlmTurn(deckId, sessionId);
  if (didRedo) {
    broadcastYDocState(deckId);
    const session = getOrCreateSession(deckId);
    debouncedSaveYDoc(deckId, session.ydoc);
  }

  const state = getLlmUndoState(deckId, sessionId);
  res.json({ success: didRedo, ...state });
});

// ============================================================================
// Message Endpoints
// ============================================================================

/**
 * GET /api/decks/:deckId/chat/sessions/:sessionId/messages
 */
router.get('/:deckId/chat/sessions/:sessionId/messages', requireDeckRole('owner', 'editor', 'viewer'), async (req, res) => {
  const { sessionId } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [sessionId]
    );

    const messages = (rows as (ChatMessageRow & { segments?: string })[])
      .filter(row => row.content && row.content.trim() !== '')
      .map(row => ({
        id: row.id,
        role: row.role,
        content: row.content,
        model: row.model,
        toolResults: row.tool_results ? JSON.parse(row.tool_results) : undefined,
        segments: row.segments ? JSON.parse(row.segments) : undefined,
        userId: row.user_id,
        userName: row.user_name,
        avatarUrl: row.user_id ? `/api/avatars/${row.user_id}` : undefined,
        createdAt: row.created_at,
      }));

    res.json({ messages });
  } catch (error) {
    console.error('[Chat] Error loading messages:', error);
    res.status(500).json({ error: 'Failed to load chat messages' });
  }
});

/**
 * GET /api/decks/:deckId/chat/history (DEPRECATED - for backward compatibility)
 */
router.get('/:deckId/chat/history', requireDeckRole('owner', 'editor', 'viewer'), async (req, res) => {
  const { deckId } = req.params;

  try {
    const { rows: sessionRows } = await pool.query(
      'SELECT id FROM chat_sessions WHERE deck_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [deckId]
    );
    const session = sessionRows[0] as { id: string } | undefined;

    if (!session) {
      return res.json({ messages: [], sessionId: null });
    }

    const { rows } = await pool.query(
      'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [session.id]
    );

    const messages = (rows as ChatMessageRow[]).map(row => ({
      id: row.id,
      role: row.role,
      content: row.content,
      model: row.model,
      toolResults: row.tool_results ? JSON.parse(row.tool_results) : undefined,
      createdAt: row.created_at,
    }));

    res.json({ messages, sessionId: session.id });
  } catch (error) {
    console.error('[Chat] Error loading history:', error);
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});

/**
 * DELETE /api/decks/:deckId/chat/history (DEPRECATED - for backward compatibility)
 */
router.delete('/:deckId/chat/history', requireDeckRole('owner', 'editor'), async (req, res) => {
  const { deckId } = req.params;

  try {
    await pool.query('DELETE FROM chat_sessions WHERE deck_id = $1', [deckId]);
    res.json({ success: true });
  } catch (error) {
    console.error('[Chat] Error clearing history:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// ============================================================================
// Chat Endpoint
// ============================================================================

/**
 * POST /api/decks/:deckId/chat
 */
router.post('/:deckId/chat', requireDeckRole('owner', 'editor'), async (req, res) => {
  if (!isLLMEnabled()) {
    return res.status(503).json({
      error: 'LLM features not available. Set ANTHROPIC_API_KEY in server environment.'
    });
  }

  const { deckId } = req.params;
  const { message, sessionId: providedSessionId, model, undoActions, context } = req.body as ChatRequest;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Extract user info from JWT
  const claims = getAuthUser(req);
  const userId = claims?.sub ?? 'anonymous';
  const userName = claims?.ext?.name || claims?.ext?.email || 'Anonymous';
  const avatarUrl = `/api/avatars/${userId}`;

  const modelId = model || DEFAULT_MODEL;

  // Get or create session
  let sessionId = providedSessionId;
  let isNewSession = false;

  if (!sessionId) {
    const title = generateSessionTitle(message);
    sessionId = await createSession(deckId, title);
    isNewSession = true;
  }

  // Guard against concurrent LLM requests on the same chat session
  if (!startChat(deckId, sessionId, userId)) {
    return res.status(409).json({ error: 'Another request is already in progress for this chat session' });
  }

  // Save user message with attribution
  const userMessageId = await saveMessage(sessionId, deckId, 'user', message, { userId, userName });

  // Broadcast user message to all connected clients (observers will pick this up)
  broadcastJSON(deckId, {
    type: 'chat:user-message',
    sessionId,
    messageId: userMessageId,
    userId,
    userName,
    avatarUrl,
    content: message,
  });

  // Update session timestamp
  await updateSession(sessionId);

  try {
    // Get current deck state
    console.log(`[Chat] Processing request for deckId: ${deckId}`);
    const session = getOrCreateSession(deckId);
    console.log(`[Chat] Session clients: ${session.clients.size}`);

    // Load from DB if no active clients
    if (session.clients.size === 0) {
      console.log(`[Chat] No clients, loading from DB...`);
      const loadedDoc = await loadYDoc(deckId);
      if (loadedDoc) {
        const state = Y.encodeStateAsUpdate(loadedDoc);
        Y.applyUpdate(session.ydoc, state);
        console.log(`[Chat] Loaded YDoc from DB`);
      } else {
        console.log(`[Chat] No YDoc found in DB for ${deckId}`);
      }
    }

    const deck = yDocToDeck(session.ydoc);
    console.log(`[Chat] Deck meta:`, deck?.meta?.title);
    console.log(`[Chat] Deck slides:`, deck?.slides ? Object.keys(deck.slides).length : 0);
    console.log(`[Chat] Context:`, JSON.stringify(context));

    if (!deck || !deck.meta) {
      console.log(`[Chat] Deck not found or no meta - returning 404`);
      return res.status(404).json({ error: 'Deck not found' });
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    // Load conversation history — use saved API messages if available (preserves tool_use/tool_result blocks)
    const { rows: sessionRows } = await pool.query(
      'SELECT api_messages FROM chat_sessions WHERE id = $1',
      [sessionId]
    );
    const savedApiMessages = (sessionRows[0] as { api_messages: string | null })?.api_messages;

    const messages: Anthropic.MessageParam[] = [];
    let hasHistory = false;

    if (savedApiMessages) {
      // Restore full API history including tool_use/tool_result blocks
      const parsed = JSON.parse(savedApiMessages) as Anthropic.MessageParam[];
      messages.push(...parsed);
      hasHistory = parsed.length > 0;
    } else {
      // Fallback for sessions created before api_messages was added
      const { rows: historyRows } = await pool.query(
        'SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
        [sessionId]
      );

      for (let i = 0; i < historyRows.length - 1; i++) {
        const row = historyRows[i] as { role: string; content: string };
        if (row.role === 'user' || row.role === 'assistant') {
          if (!row.content || row.content.trim() === '') continue;
          messages.push({
            role: row.role as 'user' | 'assistant',
            content: row.content,
          });
        }
      }
      hasHistory = messages.length > 0;
    }

    // Add current user message with tool reminder
    const toolReminder = '\n\n[Remember: You MUST call tools to make any changes. Describe your plan briefly, then call the necessary tools.]';

    // Prepend any pending render errors from previous turns
    const pendingErrors = drainRenderErrors(deckId);
    const errorPrefix = pendingErrors.length > 0
      ? `[CLIENT RENDER ERRORS from your previous changes — fix these first]\n${pendingErrors.map(e => `RENDER ERROR in ${e.componentType} (${e.componentId}): ${e.error}`).join('\n')}\n\n`
      : '';

    // Notify LLM if user undid/redid previous turns
    const undoPrefix = undoActions?.length
      ? `[The user ${undoActions.filter(a => a === 'undo').length ? `undid ${undoActions.filter(a => a === 'undo').length} of your previous change(s)` : ''}${undoActions.includes('undo') && undoActions.includes('redo') ? ' and ' : ''}${undoActions.filter(a => a === 'redo').length ? `redid ${undoActions.filter(a => a === 'redo').length} change(s)` : ''}. The deck state has changed — use get_deck_state if needed.]\n\n`
      : '';

    messages.push({ role: 'user', content: undoPrefix + errorPrefix + message + toolReminder });

    // Use full prompt for first message in session, lighter prompt for continuation
    const systemPrompt = hasHistory
      ? buildContinuationPrompt(deck, context)
      : buildSystemPrompt(deck, context);

    const messageId = generateId('msg');

    // Broadcast chat start to all connected clients
    broadcastJSON(deckId, {
      type: 'chat:start',
      sessionId,
      messageId,
      userId,
      userName,
    });

    const assistantMessages: string[] = [];
    const toolResults: Array<{ tool: string; success: boolean; result?: unknown }> = [];
    const segments: MessageSegment[] = [];

    // Helper: run one streaming API call, broadcasting text chunks
    async function streamOnce(): Promise<Anthropic.Message> {
      const stream = anthropic.messages.stream({
        model: modelId,
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages,
        cache_control: { type: 'ephemeral' },
      } as Anthropic.MessageCreateParams);

      stream.on('text', (delta) => {
        broadcastJSON(deckId, {
          type: 'chat:chunk',
          sessionId,
          messageId,
          delta,
        });
      });

      const finalMessage = await stream.finalMessage();

      // Log cache performance
      const usage = finalMessage.usage as unknown as Record<string, number>;
      if (usage.cache_read_input_tokens || usage.cache_creation_input_tokens) {
        console.log(`[Chat] Cache: read=${usage.cache_read_input_tokens || 0}, created=${usage.cache_creation_input_tokens || 0}, uncached=${usage.input_tokens}`);
      }

      return finalMessage;
    }

    // Initialize LLM undo tracking for this chat session.
    // stopCapturing() ensures this turn's tool calls form a single undo entry.
    const llmUndoManager = getLlmUndoManager(deckId, sessionId);
    llmUndoManager.stopCapturing();

    // Agent loop - keep calling until no more tool use
    let response = await streamOnce();

    console.log(`[Chat] Response stop_reason: ${response.stop_reason}`);

    // Process tool calls in a loop
    while (response.stop_reason === 'tool_use') {
      const assistantContent = response.content;

      // Build interleaved segments from content blocks (preserves text/tool order)
      for (const block of assistantContent) {
        if (block.type === 'text') {
          assistantMessages.push(block.text);
          segments.push({ type: 'text', content: block.text });
        }
      }

      const toolUseBlocks = assistantContent.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResultContents: (Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam)[] = [];

      for (const toolUse of toolUseBlocks) {
        console.log(`[Chat] Tool call: ${toolUse.name}`, toolUse.input);

        // Broadcast tool call to clients
        broadcastJSON(deckId, {
          type: 'chat:tool-call',
          sessionId,
          messageId,
          tool: toolUse.name,
          input: toolUse.input,
        });

        // capture_slide is async — requests screenshot from a connected client
        if (toolUse.name === 'capture_slide') {
          const { slideId } = toolUse.input as { slideId: string };
          try {
            const dataUrl = await requestCapture(deckId, slideId, userId);
            // Strip the data:image/jpeg;base64, prefix to get raw base64
            const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');

            toolResults.push({ tool: 'capture_slide', success: true });
            segments.push({ type: 'tool', tool: 'capture_slide', success: true });
            broadcastJSON(deckId, {
              type: 'chat:tool-result', sessionId, messageId, tool: 'capture_slide', success: true,
            });
            toolResultContents.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: [
                { type: 'text', text: `Screenshot of slide ${slideId}:` },
                { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Data } },
              ],
            });
          } catch (captureError) {
            const errorMsg = captureError instanceof Error ? captureError.message : 'Capture failed';
            toolResults.push({ tool: 'capture_slide', success: false, result: errorMsg });
            segments.push({ type: 'tool', tool: 'capture_slide', success: false, result: errorMsg });
            broadcastJSON(deckId, {
              type: 'chat:tool-result', sessionId, messageId, tool: 'capture_slide', success: false,
            });
            toolResultContents.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({ success: false, error: errorMsg }),
            });
          }
        } else {
          const currentDeck = yDocToDeck(session.ydoc);

          const result = executeToolCall(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            session.ydoc,
            currentDeck
          );

          toolResults.push({
            tool: toolUse.name,
            success: result.success,
            result: result.data,
          });
          segments.push({
            type: 'tool',
            tool: toolUse.name,
            success: result.success,
            result: result.data,
          });

          toolResultContents.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });

          // Broadcast tool result to clients
          broadcastJSON(deckId, {
            type: 'chat:tool-result',
            sessionId,
            messageId,
            tool: toolUse.name,
            success: result.success,
          });
        }
      }

      // Save changes and broadcast to connected clients
      debouncedSaveYDoc(deckId, session.ydoc);
      broadcastYDocState(deckId);

      // Check for client-side render errors after component-mutating tools
      const RENDER_RELEVANT_TOOLS = new Set(['add_component', 'update_component']);
      const hasRenderRelevantTool = toolUseBlocks.some(t => RENDER_RELEVANT_TOOLS.has(t.name));
      const renderErrors = hasRenderRelevantTool
        ? await waitForRenderErrors(deckId, 300)
        : drainRenderErrors(deckId);

      if (renderErrors.length > 0) {
        const errorSummary = renderErrors.map(e =>
          `RENDER ERROR in ${e.componentType} (${e.componentId}): ${e.error}`
        ).join('\n');
        toolResultContents.push({
          type: 'text' as const,
          text: `[CLIENT RENDER ERRORS — fix these components]\n${errorSummary}`,
        });
      }

      // Continue conversation with tool results
      messages.push({ role: 'assistant', content: assistantContent });
      messages.push({ role: 'user', content: toolResultContents });

      response = await streamOnce();
    }

    // Collect final text response and add to messages
    for (const block of response.content) {
      if (block.type === 'text') {
        assistantMessages.push(block.text);
        segments.push({ type: 'text', content: block.text });
      }
    }
    messages.push({ role: 'assistant', content: response.content });

    const responseText = assistantMessages.join('\n');

    const assistantMessageId = await saveMessage(
      sessionId,
      deckId,
      'assistant',
      responseText,
      {
        model: modelId,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        segments: segments.length > 0 ? segments : undefined,
      }
    );

    const undoState = getLlmUndoState(deckId, sessionId);

    // Broadcast completion with full data so observers can build the message
    broadcastJSON(deckId, {
      type: 'chat:complete',
      sessionId,
      messageId: assistantMessageId,
      userId,
      content: responseText,
      segments: segments.length > 0 ? segments : undefined,
      toolResults: toolResults.length > 0 ? toolResults : undefined,
      model: modelId,
      canUndo: undoState.canUndo,
      canRedo: undoState.canRedo,
    });

    // Save full API messages (with base64 images stripped) for proper history reconstruction
    const apiMessagesJson = JSON.stringify(messages, (_key, value) => {
      // Strip base64 image data to avoid bloating the DB
      if (value && typeof value === 'object' && value.type === 'image' && value.source?.type === 'base64') {
        return { type: 'text', text: '[screenshot captured]' };
      }
      return value;
    });
    await pool.query(
      'UPDATE chat_sessions SET api_messages = $1, model = $2, updated_at = NOW() WHERE id = $3',
      [apiMessagesJson, modelId, sessionId]
    );

    endChat(deckId, sessionId);

    res.json({
      id: assistantMessageId,
      sessionId,
      isNewSession,
      message: responseText,
      model: modelId,
      toolResults,
      segments,
      canUndo: undoState.canUndo,
      canRedo: undoState.canRedo,
    });

  } catch (error) {
    endChat(deckId, sessionId);
    console.error('[Chat] Error:', error);

    let errorMessage = 'Failed to process chat message';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      if (err.message) {
        errorMessage = String(err.message);
      } else if (err.error && typeof err.error === 'object') {
        const apiError = err.error as Record<string, unknown>;
        if (apiError.message) {
          errorMessage = String(apiError.message);
        }
      }
    }

    // Broadcast error to all connected clients
    broadcastJSON(deckId, {
      type: 'chat:error',
      sessionId: providedSessionId || '',
      messageId: '',
      error: errorMessage,
    });

    res.status(500).json({ error: errorMessage });
  }
});

export default router;
