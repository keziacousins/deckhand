import { useState, useRef, useEffect } from 'react';
import { ConnectionStatus } from '../components/ConnectionStatus';
import './CanvasHeader.css';

type ConnectionStatusType = 'connecting' | 'connected' | 'disconnected' | 'error';

interface CanvasHeaderProps {
  deckName: string;
  onBack: () => void;
  onNameChange: (name: string) => void;
  onAddSlide: () => void;
  onPlayFullscreen: () => void;
  onPlayWindow: () => void;
  inspectorVisible: boolean;
  onToggleInspector: () => void;
  onShare?: () => void;
  connectionStatus: ConnectionStatusType;
  connectionError?: string | null;
}

export function CanvasHeader({
  deckName,
  onBack,
  onNameChange,
  onAddSlide,
  onPlayFullscreen,
  onPlayWindow,
  inspectorVisible,
  onToggleInspector,
  onShare,
  connectionStatus,
  connectionError,
}: CanvasHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(deckName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(deckName);
  }, [deckName]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleNameClick = () => {
    setIsEditing(true);
  };

  const handleCommit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== deckName) {
      onNameChange(trimmed);
    } else {
      setEditValue(deckName);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommit();
    } else if (e.key === 'Escape') {
      setEditValue(deckName);
      setIsEditing(false);
    }
  };

  return (
    <div className="canvas-header">
      <div className="canvas-header-left">
        {/* Back button */}
        <button
          className="header-button"
          onClick={onBack}
          title="Back to Decks"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 4L6 8l4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="header-separator" />

        {/* Deck name */}
        <div className="deck-pill">
          <div className="deck-icon">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className="name-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleCommit}
            />
          ) : (
            <button
              className="name-button"
              onClick={handleNameClick}
              title="Click to edit name"
            >
              {deckName}
            </button>
          )}
        </div>

        <div className="header-separator" />

        {/* Add slide button */}
        <button
          className="header-button"
          onClick={onAddSlide}
          title="Add Slide (⌘N)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="header-separator" />

        {/* Play fullscreen button */}
        <button
          className="header-button"
          onClick={onPlayFullscreen}
          title="Present Fullscreen"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M5 3L11 8L5 13V3Z"
              fill="currentColor"
            />
          </svg>
        </button>

        {/* Play in window button */}
        <button
          className="header-button"
          onClick={onPlayWindow}
          title="Present in Window"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6.5 6L10 8L6.5 10V6Z" fill="currentColor" />
          </svg>
        </button>

        {/* Share button (owner only) */}
        {onShare && (
          <>
            <div className="header-separator" />
            <button
              className="header-button"
              onClick={onShare}
              title="Share Deck"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M6 7l4-2M6 9l4 2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </>
        )}
      </div>

      <div className="canvas-header-right">
        {/* Connection status */}
        <ConnectionStatus status={connectionStatus} error={connectionError} />

        {/* Inspector toggle */}
        <button
          className={`header-button ${inspectorVisible ? 'active' : ''}`}
          onClick={onToggleInspector}
          title={inspectorVisible ? 'Hide Inspector' : 'Show Inspector'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="2" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 2v12" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
