/**
 * Chat API route for LLM-powered deck editing.
 * 
 * Uses Claude with tool use to understand natural language commands
 * and apply changes to the deck via YDoc.
 */

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { config, isLLMEnabled } from '../config.js';
import { getOrCreateSession, broadcastYDocState } from '../sessions.js';
import { loadYDoc, debouncedSaveYDoc } from '../persistence.js';
import { yDocToDeck } from '@deckhand/sync';
import { db, type ChatMessageRow, type ChatSessionRow } from '../db/schema.js';
import * as Y from 'yjs';
import type { Deck } from '@deckhand/schema';
import { tools, executeToolCall } from '../llm/tools.js';
import { buildSystemPrompt, buildContinuationPrompt } from '../llm/prompts.js';

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
function createSession(deckId: string, title?: string): string {
  const id = generateId('chat');
  const stmt = db.prepare(`
    INSERT INTO chat_sessions (id, deck_id, title)
    VALUES (?, ?, ?)
  `);
  stmt.run(id, deckId, title || null);
  return id;
}

/**
 * Update session timestamp and optionally title
 */
function updateSession(sessionId: string, title?: string): void {
  if (title) {
    const stmt = db.prepare(`
      UPDATE chat_sessions 
      SET updated_at = datetime('now'), title = ?
      WHERE id = ?
    `);
    stmt.run(title, sessionId);
  } else {
    const stmt = db.prepare(`
      UPDATE chat_sessions 
      SET updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(sessionId);
  }
}

/**
 * Save a chat message to the database
 */
function saveMessage(
  sessionId: string,
  deckId: string,
  role: 'user' | 'assistant',
  content: string,
  model?: string,
  toolResults?: Array<{ tool: string; success: boolean }>
): string {
  const id = generateId('msg');
  const stmt = db.prepare(`
    INSERT INTO chat_messages (id, session_id, deck_id, role, content, model, tool_results)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    sessionId,
    deckId,
    role,
    content,
    model || null,
    toolResults ? JSON.stringify(toolResults) : null
  );
  return id;
}

/**
 * Generate a session title from the first user message
 */
function generateSessionTitle(message: string): string {
  // Take first 50 chars, truncate at word boundary
  const maxLen = 50;
  if (message.length <= maxLen) return message;
  const truncated = message.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

interface ChatRequest {
  message: string;
  sessionId?: string;  // If not provided, creates new session
  model?: string;
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
 * 
 * List all chat sessions for a deck.
 */
router.get('/:deckId/chat/sessions', (req, res) => {
  const { deckId } = req.params;

  try {
    const stmt = db.prepare(`
      SELECT * FROM chat_sessions 
      WHERE deck_id = ? 
      ORDER BY updated_at DESC
    `);
    const rows = stmt.all(deckId) as ChatSessionRow[];

    const sessions = rows.map(row => ({
      id: row.id,
      title: row.title,
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
 * 
 * Create a new chat session.
 */
router.post('/:deckId/chat/sessions', (req, res) => {
  const { deckId } = req.params;
  const { title } = req.body as { title?: string };

  try {
    const sessionId = createSession(deckId, title);
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
 * 
 * Delete a chat session and all its messages.
 */
router.delete('/:deckId/chat/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  try {
    // Messages are deleted via CASCADE
    const stmt = db.prepare('DELETE FROM chat_sessions WHERE id = ?');
    stmt.run(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Chat] Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete chat session' });
  }
});

/**
 * PATCH /api/decks/:deckId/chat/sessions/:sessionId
 * 
 * Update a chat session (e.g., rename).
 */
router.patch('/:deckId/chat/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { title } = req.body as { title?: string };

  try {
    if (title !== undefined) {
      const stmt = db.prepare('UPDATE chat_sessions SET title = ? WHERE id = ?');
      stmt.run(title, sessionId);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[Chat] Error updating session:', error);
    res.status(500).json({ error: 'Failed to update chat session' });
  }
});

// ============================================================================
// Message Endpoints
// ============================================================================

/**
 * GET /api/decks/:deckId/chat/sessions/:sessionId/messages
 * 
 * Get messages for a specific session.
 */
router.get('/:deckId/chat/sessions/:sessionId/messages', (req, res) => {
  const { sessionId } = req.params;

  try {
    const stmt = db.prepare(`
      SELECT * FROM chat_messages 
      WHERE session_id = ? 
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(sessionId) as ChatMessageRow[];

    const messages = rows
      .filter(row => row.content && row.content.trim() !== '') // Skip empty messages
      .map(row => ({
        id: row.id,
        role: row.role,
        content: row.content,
        model: row.model,
        toolResults: row.tool_results ? JSON.parse(row.tool_results) : undefined,
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
 * 
 * Get chat history for a deck (returns most recent session).
 */
router.get('/:deckId/chat/history', (req, res) => {
  const { deckId } = req.params;

  try {
    // Get most recent session
    const sessionStmt = db.prepare(`
      SELECT id FROM chat_sessions 
      WHERE deck_id = ? 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);
    const session = sessionStmt.get(deckId) as { id: string } | undefined;

    if (!session) {
      return res.json({ messages: [], sessionId: null });
    }

    const stmt = db.prepare(`
      SELECT * FROM chat_messages 
      WHERE session_id = ? 
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(session.id) as ChatMessageRow[];

    const messages = rows.map(row => ({
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
 * 
 * Clear all chat sessions for a deck.
 */
router.delete('/:deckId/chat/history', (req, res) => {
  const { deckId } = req.params;

  try {
    // Delete all sessions (messages deleted via CASCADE)
    const stmt = db.prepare('DELETE FROM chat_sessions WHERE deck_id = ?');
    stmt.run(deckId);
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
 * 
 * Send a message to the LLM assistant for deck editing.
 */
router.post('/:deckId/chat', async (req, res) => {
  if (!isLLMEnabled()) {
    return res.status(503).json({ 
      error: 'LLM features not available. Set ANTHROPIC_API_KEY in server environment.' 
    });
  }

  const { deckId } = req.params;
  const { message, sessionId: providedSessionId, model, context } = req.body as ChatRequest;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Use specified model or default
  const modelId = model || DEFAULT_MODEL;

  // Get or create session
  let sessionId = providedSessionId;
  let isNewSession = false;
  
  if (!sessionId) {
    // Create new session with title from first message
    const title = generateSessionTitle(message);
    sessionId = createSession(deckId, title);
    isNewSession = true;
  }

  // Save user message
  const userMessageId = saveMessage(sessionId, deckId, 'user', message);

  // Update session timestamp
  updateSession(sessionId);

  try {
    // Get current deck state
    console.log(`[Chat] Processing request for deckId: ${deckId}`);
    const session = getOrCreateSession(deckId);
    console.log(`[Chat] Session clients: ${session.clients.size}`);
    
    // Load from DB if no active clients
    if (session.clients.size === 0) {
      console.log(`[Chat] No clients, loading from DB...`);
      const loadedDoc = loadYDoc(deckId);
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
    
    if (!deck || !deck.meta) {
      console.log(`[Chat] Deck not found or no meta - returning 404`);
      return res.status(404).json({ error: 'Deck not found' });
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    // Load chat history for this session
    const historyStmt = db.prepare(`
      SELECT role, content FROM chat_messages 
      WHERE session_id = ? 
      ORDER BY created_at ASC
    `);
    const historyRows = historyStmt.all(sessionId) as { role: string; content: string }[];
    
    // Build messages array from history (excluding the message we just saved)
    // Note: We only store plain text, not tool_use blocks. The deck state is the source of truth.
    const messages: Anthropic.MessageParam[] = [];
    
    // Add previous messages from history (skip the last one which is the current user message)
    for (let i = 0; i < historyRows.length - 1; i++) {
      const row = historyRows[i];
      if (row.role === 'user' || row.role === 'assistant') {
        // Skip empty messages
        if (!row.content || row.content.trim() === '') continue;
        
        messages.push({
          role: row.role as 'user' | 'assistant',
          content: row.content,
        });
      }
    }
    
    // Add current user message with tool reminder
    const toolReminder = '\n\n[Remember: You MUST call tools to make any changes. Describe your plan briefly, then call the necessary tools.]';
    messages.push({ role: 'user', content: message + toolReminder });

    // Use full prompt for first message in session, lighter prompt for continuation
    const hasHistory = historyRows.length > 1;
    const systemPrompt = hasHistory 
      ? buildContinuationPrompt(deck, context)
      : buildSystemPrompt(deck, context);

    // Agent loop - keep calling until no more tool use
    let response = await anthropic.messages.create({
      model: modelId,
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    console.log(`[Chat] Response stop_reason: ${response.stop_reason}`);
    console.log(`[Chat] Response content types:`, response.content.map(b => b.type));

    const assistantMessages: string[] = [];
    const toolResults: Array<{ tool: string; success: boolean; result?: unknown }> = [];

    // Process tool calls in a loop
    while (response.stop_reason === 'tool_use') {
      const assistantContent = response.content;
      
      // Collect any text responses
      for (const block of assistantContent) {
        if (block.type === 'text') {
          assistantMessages.push(block.text);
        }
      }

      // Process tool calls
      const toolUseBlocks = assistantContent.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        console.log(`[Chat] Tool call: ${toolUse.name}`, toolUse.input);
        
        // Re-fetch deck state for each tool call (it may have changed)
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

        toolResultContents.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Save changes and broadcast to connected clients
      debouncedSaveYDoc(deckId, session.ydoc);
      broadcastYDocState(deckId);

      // Continue conversation with tool results
      messages.push({ role: 'assistant', content: assistantContent });
      messages.push({ role: 'user', content: toolResultContents });

      response = await anthropic.messages.create({
        model: modelId,
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages,
      });
    }

    // Collect final text response
    for (const block of response.content) {
      if (block.type === 'text') {
        assistantMessages.push(block.text);
      }
    }

    const responseText = assistantMessages.join('\n');

    // Save final assistant message as plain text (for simpler history)
    // Tool results are stored separately for UI display
    const assistantMessageId = saveMessage(
      sessionId,
      deckId,
      'assistant',
      responseText,
      modelId,
      toolResults.length > 0 ? toolResults : undefined
    );

    // Update session timestamp
    updateSession(sessionId);

    res.json({
      id: assistantMessageId,
      sessionId,
      isNewSession,
      message: responseText,
      model: modelId,
      toolResults,
    });

  } catch (error) {
    console.error('[Chat] Error:', error);
    
    // Extract meaningful error message from various error formats
    let errorMessage = 'Failed to process chat message';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      // Anthropic SDK error structure
      if (err.message) {
        errorMessage = String(err.message);
      } else if (err.error && typeof err.error === 'object') {
        const apiError = err.error as Record<string, unknown>;
        if (apiError.message) {
          errorMessage = String(apiError.message);
        }
      }
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
