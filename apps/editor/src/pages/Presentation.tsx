import { useEffect, useMemo, useRef } from 'react';
import { useYDoc } from '../sync';
import { SLIDE_WIDTH, getSlideHeight } from '@deckhand/schema';
import { useAuthAssets } from '../hooks/useAuthAssets';
import { usePresentationPlayer, SlideRenderer } from './presentationUtils';
import './Presentation.css';

interface PresentationProps {
  deckId: string;
  startSlideId?: string;
  onExit: () => void;
}

export function Presentation({ deckId, startSlideId, onExit }: PresentationProps) {
  const { deck: rawDeck, status, error } = useYDoc(deckId);
  const rawAssets = useMemo(() => rawDeck?.assets ?? {}, [rawDeck?.assets]);
  const resolvedAssets = useAuthAssets(rawAssets);
  // Replace assets with blob URLs so web components can load them
  const deck = useMemo(() => rawDeck ? { ...rawDeck, assets: resolvedAssets } : null, [rawDeck, resolvedAssets]);

  const player = usePresentationPlayer({ deck, startSlideId });

  const {
    currentIndex, setCurrentIndex, scale, containerRef, transition,
    playOrder, currentSlide,
    canGoNext, canGoPrev, componentLinks,
    goNext, goPrev, handleComponentClick, handleClick,
  } = player;

  // Track if we were ever in fullscreen (to know if exiting fullscreen should exit presentation)
  const wasInFullscreen = useRef(false);

  // Detect initial fullscreen state after mount
  useEffect(() => {
    if (document.fullscreenElement) {
      wasInFullscreen.current = true;
    }
  }, []);

  // Exit presentation when fullscreen is exited (if we were in fullscreen)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        // Entered fullscreen
        wasInFullscreen.current = true;
      } else if (wasInFullscreen.current) {
        // Exited fullscreen after being in it - also exit presentation
        if (window.opener) {
          window.close();
        } else {
          onExit();
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [onExit]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'Enter':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          goPrev();
          break;
        case 'Escape':
          // If in fullscreen, let browser handle it - fullscreenchange will exit presentation
          // If not in fullscreen, exit presentation directly
          if (!document.fullscreenElement) {
            e.preventDefault();
            if (window.opener) {
              window.close();
            } else {
              onExit();
            }
          }
          break;
        case 'Home':
          e.preventDefault();
          setCurrentIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setCurrentIndex(Math.max(0, playOrder.length - 1));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, onExit, playOrder.length]);

  // Show loading state
  if (status === 'connecting' || (status === 'connected' && !deck)) {
    return (
      <div className="presentation">
        <div className="presentation-loading">Loading presentation...</div>
      </div>
    );
  }

  // Show error state
  if (status === 'error' || status === 'disconnected' || !deck) {
    return (
      <div className="presentation">
        <div className="presentation-error">
          <p>{error || 'Failed to load presentation'}</p>
          <button onClick={onExit}>Exit</button>
        </div>
      </div>
    );
  }

  // No slides to present
  if (playOrder.length === 0 || !currentSlide) {
    return (
      <div className="presentation">
        <div className="presentation-error">
          <p>No slides to present. Add slides and connect them with edges.</p>
          <button onClick={onExit}>Exit</button>
        </div>
      </div>
    );
  }

  const slideHeight = getSlideHeight(deck.aspectRatio);

  // Scale the entire slide viewport like React Flow does
  const viewportStyle: React.CSSProperties = {
    transform: `scale(${scale})`,
    transformOrigin: 'center center',
    width: SLIDE_WIDTH,
    height: slideHeight,
  };

  // Get slides for transition rendering
  const fromSlide = transition ? deck.slides[transition.fromSlideId] : null;
  const toSlide = transition ? deck.slides[transition.toSlideId] : null;

  // CSS custom properties for transition duration
  const transitionDuration = transition ? `${transition.duration}s` : '0s';

  return (
    <div className="presentation" ref={containerRef} onClick={handleClick}>
      <div
        className="presentation-viewport"
        style={{ ...viewportStyle, '--transition-duration': transitionDuration } as React.CSSProperties}
      >
        {transition && fromSlide && toSlide ? (
          // During transition: show both slides with animation
          <div className={`presentation-transition transition-${transition.type} ${transition.phase}`}>
            <div className="transition-slide transition-from">
              <SlideRenderer slide={fromSlide} deck={deck} />
            </div>
            <div className="transition-slide transition-to">
              <SlideRenderer slide={toSlide} deck={deck} />
            </div>
          </div>
        ) : (
          // Normal: show current slide
          <SlideRenderer
            slide={currentSlide}
            deck={deck}
            componentLinks={componentLinks}
            onComponentClick={handleComponentClick}
          />
        )}
      </div>

      {/* Progress indicator */}
      <div className="presentation-progress">
        <span className="presentation-progress-text">
          {currentIndex + 1} / {playOrder.length}
        </span>
      </div>

      {/* Navigation controls (visible on hover) */}
      <div className="presentation-controls">
        <button
          className="presentation-nav presentation-nav-prev"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          disabled={!canGoPrev}
          title="Previous (←)"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          className="presentation-nav presentation-nav-next"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          disabled={!canGoNext}
          title="Next (→)"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Exit button */}
      <button
        className="presentation-exit"
        onClick={(e) => {
          e.stopPropagation();
          if (window.opener) {
            window.close();
          } else {
            onExit();
          }
        }}
        title="Exit (Esc)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
