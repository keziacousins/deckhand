import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { apiFetch } from '../../api/decks';
import type { InspectorContext } from '../types';
import './ChatSection.css';

type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'tool'; tool: string; success?: boolean; result?: unknown };

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  segments?: MessageSegment[];
  toolResults?: Array<{ tool: string; success: boolean; result?: unknown }>;
}

/** Build interleaved segments from flat content + toolResults (for history messages) */
function buildSegments(content: string, toolResults?: Array<{ tool: string; success: boolean; result?: unknown }>): MessageSegment[] {
  const segs: MessageSegment[] = [];
  if (content) segs.push({ type: 'text', content });
  if (toolResults) {
    for (const tr of toolResults) {
      segs.push({ type: 'tool', tool: tr.tool, success: tr.success, result: tr.result });
    }
  }
  return segs;
}

type StreamingSegment = MessageSegment;

interface ChatSession {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Model {
  id: string;
  name: string;
}

type MessageHandler = (msg: { type: string; [key: string]: unknown }) => void;

interface ChatSectionProps {
  context: InspectorContext;
  deckId: string;
  onMessage: (type: string, handler: MessageHandler) => () => void;
  sendMessage: (msg: { type: string; [key: string]: unknown }) => void;
}

export function ChatSection({ context, deckId, onMessage }: ChatSectionProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamingSegments, setStreamingSegments] = useState<StreamingSegment[]>([]);
  const streamingSegmentsRef = useRef<StreamingSegment[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [modelsLoading, setModelsLoading] = useState(true);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [expandedToolResult, setExpandedToolResult] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const shouldFollowRef = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInitialScrollRef = useRef(true);

  // Load sessions on mount
  useEffect(() => {
    async function loadSessions() {
      try {
        const response = await apiFetch(`/api/decks/${deckId}/chat/sessions`);
        if (response.ok) {
          const data = await response.json();
          setSessions(data.sessions || []);
          // Auto-select most recent session
          if (data.sessions?.length > 0) {
            setCurrentSessionId(data.sessions[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    }
    loadSessions();
  }, [deckId]);

  // Load messages when session changes
  useEffect(() => {
    async function loadMessages() {
      if (!currentSessionId) {
        setMessages([]);
        setHistoryLoading(false);
        return;
      }

      setHistoryLoading(true);
      try {
        const response = await apiFetch(`/api/decks/${deckId}/chat/sessions/${currentSessionId}/messages`);
        if (response.ok) {
          const data = await response.json();
          const msgs = (data.messages || []).map((m: Message) => ({
            ...m,
            segments: m.segments || (m.role === 'assistant' ? buildSegments(m.content, m.toolResults) : undefined),
          }));
          setMessages(msgs);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setHistoryLoading(false);
      }
    }
    loadMessages();
  }, [deckId, currentSessionId]);

  // Load available models on mount
  useEffect(() => {
    async function loadModels() {
      try {
        const response = await apiFetch('/api/models');
        if (response.ok) {
          const data = await response.json();
          setModels(data.models || []);
          // Select default model from API, or first model as fallback
          if (!selectedModel) {
            const defaultId = data.defaultModel || data.models?.[0]?.id;
            if (defaultId) {
              setSelectedModel(defaultId);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load models:', err);
      } finally {
        setModelsLoading(false);
      }
    }
    loadModels();
  }, []);

  // Subscribe to streaming chat messages via WebSocket
  useEffect(() => {
    const updateSegments = (updater: (prev: StreamingSegment[]) => StreamingSegment[]) => {
      setStreamingSegments(prev => {
        const next = updater(prev);
        streamingSegmentsRef.current = next;
        return next;
      });
    };

    const unsubs = [
      onMessage('chat:start', () => {
        updateSegments(() => []);
      }),
      onMessage('chat:chunk', (msg) => {
        const delta = msg.delta as string;
        updateSegments(prev => {
          const last = prev[prev.length - 1];
          if (last?.type === 'text') {
            return [...prev.slice(0, -1), { type: 'text', content: last.content + delta }];
          }
          return [...prev, { type: 'text', content: delta }];
        });
      }),
      onMessage('chat:tool-call', (msg) => {
        updateSegments(prev => [...prev, { type: 'tool', tool: msg.tool as string }]);
      }),
      onMessage('chat:tool-result', (msg) => {
        updateSegments(prev =>
          prev.map(seg =>
            seg.type === 'tool' && seg.tool === (msg.tool as string) && seg.success === undefined
              ? { ...seg, success: msg.success as boolean }
              : seg
          )
        );
      }),
      onMessage('chat:complete', () => {
        // Don't clear — sendMessage handler will snapshot segments into the message
      }),
      onMessage('chat:error', (msg) => {
        updateSegments(() => []);
        setError(msg.error as string);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [onMessage]);

  // Track scroll position to decide auto-scroll.
  // shouldFollowRef is the source of truth for follow mode — only user actions change it.
  // isAtBottom state is derived from it for rendering the scroll-to-bottom button.
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 40;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    // Only allow the user to break out of follow mode by scrolling up.
    // Never re-enable follow mode from scroll events (only from explicit user actions).
    if (!atBottom && shouldFollowRef.current) {
      shouldFollowRef.current = false;
    }
    setIsAtBottom(atBottom);
  }, []);

  // Scroll helpers
  const doScroll = useCallback((behavior: ScrollBehavior) => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Scroll to bottom: instant on session switch, smooth for new content
  useEffect(() => {
    if (isInitialScrollRef.current) {
      doScroll('instant');
      isInitialScrollRef.current = false;
    }
  }, [messages, doScroll]);

  useEffect(() => {
    if (shouldFollowRef.current) {
      doScroll('smooth');
    }
  }, [messages, streamingSegments, doScroll]);

  // Mark next scroll as instant when session changes
  useEffect(() => {
    isInitialScrollRef.current = true;
  }, [currentSessionId]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Restore focus to textarea if it was focused before re-render
  useEffect(() => {
    if (isFocused && textareaRef.current && document.activeElement !== textareaRef.current) {
      textareaRef.current.focus();
    }
  });

  const scrollToBottom = useCallback(() => {
    shouldFollowRef.current = true;
    setIsAtBottom(true);
    doScroll('smooth');
  }, [doScroll]);

  const startNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    setShowSessionList(false);
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    setShowSessionList(false);
  }, []);

  const deleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await apiFetch(`/api/decks/${deckId}/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, [deckId, currentSessionId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    // Re-enable auto-scroll when user sends a message
    shouldFollowRef.current = true;
    setIsAtBottom(true);
    
    // Restore focus to input after sending
    setTimeout(() => textareaRef.current?.focus(), 0);

    try {
      const response = await apiFetch(`/api/decks/${deckId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: currentSessionId || undefined,
          model: selectedModel || undefined,
          context: {
            selectedSlideId: context.selection.slideId,
            selectedComponentId: context.selection.componentId,
          },
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // If this was a new session, update state
      if (data.isNewSession && data.sessionId) {
        setCurrentSessionId(data.sessionId);
        // Add new session to the list
        const newSession: ChatSession = {
          id: data.sessionId,
          title: userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? '...' : ''),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setSessions(prev => [newSession, ...prev]);
      }

      // Prefer: streaming segments (live interleaved) > server segments > fallback
      const segments = streamingSegmentsRef.current.length > 0
        ? streamingSegmentsRef.current
        : data.segments?.length > 0
          ? data.segments
          : buildSegments(data.message, data.toolResults);

      const assistantMessage: Message = {
        id: data.id || `msg-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        segments,
        toolResults: data.toolResults,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingSegments([]);
      streamingSegmentsRef.current = [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, deckId, currentSessionId, selectedModel, context.selection]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentModelName = models.find(m => m.id === selectedModel)?.name || 'Select model';
  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="chat-section">
      {/* Header with session selector and model selector */}
      <div className="chat-header">
        <div className="chat-header-row">
          {/* Session selector */}
          <button 
            className="chat-session-selector"
            onClick={() => setShowSessionList(!showSessionList)}
          >
            <span className="chat-session-title">
              {currentSession?.title || 'New Chat'}
            </span>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* New chat button */}
          <button 
            className="chat-new-button"
            onClick={startNewChat}
            title="New chat"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          
          {/* Model selector */}
          <button 
            className="chat-model-selector"
            onClick={() => setShowModelSelector(!showModelSelector)}
            disabled={modelsLoading}
          >
            <span className="chat-model-name">
              {modelsLoading ? '...' : currentModelName.split('-').slice(-1)[0]}
            </span>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Session dropdown */}
        {showSessionList && (
          <div className="chat-session-dropdown">
            {sessions.length === 0 ? (
              <div className="chat-session-empty">No previous chats</div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`chat-session-option ${session.id === currentSessionId ? 'selected' : ''}`}
                  onClick={() => selectSession(session.id)}
                >
                  <span className="chat-session-option-title">
                    {session.title || 'Untitled'}
                  </span>
                  <button
                    className="chat-session-delete"
                    onClick={(e) => deleteSession(session.id, e)}
                    title="Delete chat"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        
        {/* Model dropdown */}
        {showModelSelector && models.length > 0 && (
          <div className="chat-model-dropdown">
            {models.map((model) => (
              <button
                key={model.id}
                className={`chat-model-option ${model.id === selectedModel ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedModel(model.id);
                  setShowModelSelector(false);
                }}
              >
                {model.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="chat-messages" ref={messagesContainerRef} onScroll={handleScroll}>
        {historyLoading && (
          <div className="chat-empty">
            <p>Loading...</p>
          </div>
        )}

        {!historyLoading && messages.length === 0 && !isLoading && (
          <div className="chat-empty">
            <p>Ask me to edit your deck.</p>
            <p className="chat-empty-hint">
              Try: "Add a title slide" or "Change the background to blue"
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`chat-message chat-message-${message.role}`}>
            {message.role === 'user' ? (
              <div className="chat-message-content">
                <p>{message.content}</p>
              </div>
            ) : (
              /* Assistant messages render interleaved segments */
              (message.segments || buildSegments(message.content, message.toolResults)).map((seg, i) =>
                seg.type === 'text' ? (
                  <div key={i} className="chat-message-content">
                    <ReactMarkdown>{seg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div key={i} className="chat-tool-call">
                    <button
                      className={`chat-tool-call-header ${seg.success ? 'success' : 'error'}`}
                      onClick={() => setExpandedToolResult(
                        expandedToolResult === `${message.id}-${i}` ? null : `${message.id}-${i}`
                      )}
                    >
                      <span className="chat-tool-call-name">{seg.tool}</span>
                      <svg
                        className={`chat-tool-call-chevron ${expandedToolResult === `${message.id}-${i}` ? 'expanded' : ''}`}
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {expandedToolResult === `${message.id}-${i}` && seg.result != null && (
                      <div className="chat-tool-call-details">
                        <div className="chat-tool-call-section">
                          <span className="chat-tool-call-label">
                            Result: {seg.success ? '✓' : '✗'}
                          </span>
                          <pre className="chat-tool-call-json">
                            {JSON.stringify(seg.result, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )
              )
            )}
          </div>
        ))}

        {isLoading && (
          <div className="chat-message chat-message-assistant">
            {streamingSegments.length === 0 && (
              <div className="chat-loading">
                <span className="chat-loading-dot" />
                <span className="chat-loading-dot" />
                <span className="chat-loading-dot" />
              </div>
            )}
            {streamingSegments.map((seg, i) =>
              seg.type === 'text' ? (
                <div key={i} className="chat-message-content">
                  <ReactMarkdown>{seg.content}</ReactMarkdown>
                </div>
              ) : (
                <div key={i} className="chat-tool-call">
                  <div className={`chat-tool-call-header ${seg.success === undefined ? 'pending' : seg.success ? 'success' : 'error'}`}>
                    <span className="chat-tool-call-name">{seg.tool}</span>
                    {seg.success === undefined && (
                      <span className="chat-tool-call-spinner" />
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {error && (
          <div className="chat-error">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />

        {!isAtBottom && (
          <button className="chat-scroll-to-bottom" onClick={scrollToBottom} title="Scroll to bottom">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="chat-input-container">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={context.readOnly ? 'View only' : 'Describe changes...'}
          rows={1}
          disabled={isLoading || context.readOnly}
        />
        <button
          className="chat-send"
          onClick={sendMessage}
          disabled={!input.trim() || isLoading || context.readOnly}
          title="Send (Enter)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M14 8L2 2l2 6-2 6 12-6z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
