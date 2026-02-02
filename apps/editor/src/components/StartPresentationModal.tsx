import type { Deck } from '@deckhand/schema';
import './StartPresentationModal.css';

interface StartPresentationModalProps {
  deck: Deck;
  currentSlideId: string | null;
  onStart: (slideId: string | undefined) => void;
  onClose: () => void;
}

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2.5v11l9-5.5-9-5.5z" />
  </svg>
);

export function StartPresentationModal({
  deck,
  currentSlideId,
  onStart,
  onClose,
}: StartPresentationModalProps) {
  const startPoints = deck.flow.startPoints ? Object.values(deck.flow.startPoints) : [];
  const hasCurrentSlide = currentSlideId && deck.slides[currentSlideId];
  
  // Find the slide connected to a start point
  const getStartPointTargetSlide = (startPointId: string): string | undefined => {
    const edge = Object.values(deck.flow.edges).find(e => e.from === startPointId);
    return edge?.to;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="start-modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="start-modal" onClick={e => e.stopPropagation()}>
        <div className="start-modal-header">
          <h2 className="start-modal-title">Start Presentation</h2>
          <button className="start-modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        
        <div className="start-modal-content">
          <div className="start-modal-section">
            <button 
              className="start-modal-row"
              onClick={() => onStart(currentSlideId || undefined)}
            >
              <PlayIcon />
              <span className="start-modal-row-text">
                <span className="start-modal-row-label">Current slide</span>
                {hasCurrentSlide && (
                  <span className="start-modal-row-desc">{deck.slides[currentSlideId].title}</span>
                )}
              </span>
            </button>
          </div>
          
          {startPoints.length > 0 && (
            <div className="start-modal-section">
              <div className="start-modal-section-label">Start Points</div>
              {startPoints.map(sp => (
                <button 
                  key={sp.id} 
                  className="start-modal-row"
                  onClick={() => onStart(getStartPointTargetSlide(sp.id))}
                >
                  <PlayIcon />
                  <span className="start-modal-row-text">
                    <span className="start-modal-row-label">{sp.name}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="start-modal-footer">
          <button className="start-modal-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
