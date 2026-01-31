import { useState, useRef, useEffect } from 'react';
import './CanvasHeader.css';

interface CanvasHeaderProps {
  deckName: string;
  onBack: () => void;
  onNameChange: (name: string) => void;
  onAddSlide: () => void;
  inspectorVisible: boolean;
  onToggleInspector: () => void;
}

export function CanvasHeader({
  deckName,
  onBack,
  onNameChange,
  onAddSlide,
  inspectorVisible,
  onToggleInspector,
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
      </div>

      <div className="canvas-header-right">
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
