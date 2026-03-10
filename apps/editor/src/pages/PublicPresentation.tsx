/**
 * Public (unauthenticated) presentation viewer.
 * Fetches deck content via the public REST API and renders the presentation.
 * Assets use public URLs that don't require auth.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Deck, Edge, TransitionType } from '@deckhand/schema';
import { SLIDE_WIDTH, getSlideHeight, DEFAULT_TRANSITION_DURATION, resolveEdgeSource } from '@deckhand/schema';
import { computePlayOrder, getTransitionInfo, SlideRenderer, type TransitionState } from './presentationUtils';
import './Presentation.css';

interface PublicPresentationProps {
  deckId: string;
}

/**
 * Rewrite asset URLs from /api/decks/... to /api/public/decks/... so they
 * load without authentication.
 */
function rewriteAssetsToPublic(deck: Deck): Deck {
  const assets = deck.assets ?? {};
  const rewritten: typeof assets = {};
  for (const [id, asset] of Object.entries(assets)) {
    if ('url' in asset && asset.url) {
      rewritten[id] = {
        ...asset,
        url: asset.url.replace(/^\/api\/decks\//, '/api/public/decks/'),
      };
    } else {
      rewritten[id] = asset;
    }
  }
  return { ...deck, assets: rewritten };
}

export function PublicPresentation({ deckId }: PublicPresentationProps) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transition, setTransition] = useState<TransitionState | null>(null);
  const [playOrderStart, setPlayOrderStart] = useState<string | undefined>(undefined);
  const [navHistory, setNavHistory] = useState<Array<{ start: string | undefined; index: number }>>([]);

  // Fetch deck via public API
  useEffect(() => {
    let cancelled = false;
    async function fetchDeck() {
      try {
        const res = await fetch(`/api/public/decks/${deckId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Presentation not found or not publicly shared');
          } else {
            setError('Failed to load presentation');
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setDeck(rewriteAssetsToPublic(data.content));
        }
      } catch {
        if (!cancelled) setError('Failed to load presentation');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDeck();
    return () => { cancelled = true; };
  }, [deckId]);

  // Scale to fit viewport
  useEffect(() => {
    if (!deck) return;
    const slideHeight = getSlideHeight(deck.aspectRatio);
    const updateScale = () => {
      const scaleX = window.innerWidth / SLIDE_WIDTH;
      const scaleY = window.innerHeight / slideHeight;
      setScale(Math.min(scaleX, scaleY));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [deck]);

  // Find start slide by following edges from the default start point
  const startSlideId = useMemo(() => {
    if (!deck) return undefined;

    // Helper: find the slide a start point connects to via an edge
    const findTarget = (spId: string): string | undefined => {
      const edge = Object.values(deck.flow.edges).find(e => e.from === spId);
      return edge?.to && deck.slides[edge.to] ? edge.to : undefined;
    };

    // Try default start point
    if (deck.defaultStartPointId) {
      const target = findTarget(deck.defaultStartPointId);
      if (target) return target;
    }

    // Fallback: first start point with an edge to a slide
    for (const sp of Object.values(deck.flow.startPoints ?? {})) {
      const target = findTarget(sp.id);
      if (target) return target;
    }

    // Last resort: first slide
    return Object.keys(deck.slides)[0];
  }, [deck]);

  // Compute play order
  const playOrder = useMemo(() => {
    if (!deck) return [];
    const start = playOrderStart ?? startSlideId;
    if (!start || !deck.slides[start]) return [];
    return computePlayOrder(deck, start);
  }, [deck, startSlideId, playOrderStart]);

  const currentEntry = playOrder[currentIndex];
  const currentSlideId = currentEntry?.slideId;
  const currentSlide = deck?.slides[currentSlideId];

  const canGoNext = currentIndex < playOrder.length - 1 && !transition?.isTransitioning;
  const canGoPrev = (currentIndex > 0 || navHistory.length > 0) && !transition?.isTransitioning;

  // Component links for current slide
  const componentLinks = useMemo(() => {
    if (!deck || !currentSlideId) return new Map<string, Edge>();
    const slide = deck.slides[currentSlideId];
    if (!slide) return new Map<string, Edge>();

    const links = new Map<string, Edge>();
    for (const edge of Object.values(deck.flow.edges)) {
      const source = resolveEdgeSource(deck, edge.from);
      if (source?.type === 'component' && source.slideId === currentSlideId) {
        let comp = slide.components.find(c => c.id === source.componentId);
        while (comp?.parentId) {
          comp = slide.components.find(c => c.id === comp!.parentId);
        }
        const topLevelId = comp?.id ?? source.componentId;
        links.set(topLevelId, edge);
      }
    }
    return links;
  }, [deck, currentSlideId]);

  const navigateToSlide = useCallback((targetSlideId: string, edgeTransition?: TransitionType, edgeDuration?: number) => {
    if (!deck || transition?.isTransitioning || !currentSlideId) return;
    if (!deck.slides[targetSlideId]) return;

    setNavHistory(h => [...h, { start: playOrderStart, index: currentIndex }]);

    const targetIndex = playOrder.findIndex(e => e.slideId === targetSlideId);
    const type = edgeTransition ?? deck.flow.defaultTransition ?? 'instant';
    const duration = edgeDuration ?? deck.flow.defaultTransitionDuration ?? DEFAULT_TRANSITION_DURATION;

    const applyNav = () => {
      if (targetIndex !== -1) {
        setCurrentIndex(targetIndex);
      } else {
        setPlayOrderStart(targetSlideId);
        setCurrentIndex(0);
      }
    };

    if (type === 'instant' || duration === 0) {
      applyNav();
    } else {
      setTransition({
        isTransitioning: true, type, duration,
        fromSlideId: currentSlideId, toSlideId: targetSlideId, phase: 'enter',
      });
      requestAnimationFrame(() => {
        setTransition(t => t ? { ...t, phase: 'active' } : null);
      });
      setTimeout(() => { applyNav(); setTransition(null); }, duration * 1000);
    }
  }, [deck, transition, playOrder, currentIndex, currentSlideId, playOrderStart]);

  const handleComponentClick = useCallback((componentId: string) => {
    const edge = componentLinks.get(componentId);
    if (edge) navigateToSlide(edge.to, edge.transition, edge.transitionDuration);
  }, [componentLinks, navigateToSlide]);

  const goNext = useCallback(() => {
    if (!canGoNext || !deck || !currentSlideId) return;
    const nextIndex = currentIndex + 1;
    const nextEntry = playOrder[nextIndex];
    const { type, duration } = getTransitionInfo(deck, nextEntry.incomingEdgeId, 'forward');

    if (type === 'instant' || duration === 0) {
      setCurrentIndex(nextIndex);
    } else {
      setTransition({
        isTransitioning: true, type, duration,
        fromSlideId: currentSlideId, toSlideId: nextEntry.slideId, phase: 'enter',
      });
      requestAnimationFrame(() => setTransition(t => t ? { ...t, phase: 'active' } : null));
      setTimeout(() => { setCurrentIndex(nextIndex); setTransition(null); }, duration * 1000);
    }
  }, [canGoNext, currentIndex, currentSlideId, deck, playOrder]);

  const goPrev = useCallback(() => {
    if (!canGoPrev || !deck || !currentSlideId) return;

    if (currentIndex === 0 && navHistory.length > 0) {
      const prev = navHistory[navHistory.length - 1];
      setNavHistory(h => h.slice(0, -1));
      setPlayOrderStart(prev.start);
      setCurrentIndex(prev.index);
      return;
    }

    const prevIndex = currentIndex - 1;
    const prevEntry = playOrder[prevIndex];
    const { type, duration } = getTransitionInfo(deck, currentEntry.incomingEdgeId, 'backward');

    if (type === 'instant' || duration === 0) {
      setCurrentIndex(prevIndex);
    } else {
      setTransition({
        isTransitioning: true, type, duration,
        fromSlideId: currentSlideId, toSlideId: prevEntry.slideId, phase: 'enter',
      });
      requestAnimationFrame(() => setTransition(t => t ? { ...t, phase: 'active' } : null));
      setTimeout(() => { setCurrentIndex(prevIndex); setTransition(null); }, duration * 1000);
    }
  }, [canGoPrev, currentIndex, currentSlideId, currentEntry, deck, navHistory, playOrder]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'Enter':
          e.preventDefault(); goNext(); break;
        case 'ArrowLeft': case 'ArrowUp':
          e.preventDefault(); goPrev(); break;
        case 'f':
          e.preventDefault(); toggleFullscreen(); break;
        case 'Escape':
          if (document.fullscreenElement) break; // let browser handle
          break;
        case 'Home':
          e.preventDefault(); setCurrentIndex(0); break;
        case 'End':
          e.preventDefault(); setCurrentIndex(Math.max(0, playOrder.length - 1)); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, toggleFullscreen, playOrder.length]);

  // Click to advance
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, button, input, textarea')) return;

    const path = e.nativeEvent.composedPath();
    for (const el of path) {
      if (el instanceof HTMLElement && el.classList.contains('component-link')) {
        const compId = el.getAttribute('data-component-id');
        if (compId) { handleComponentClick(compId); return; }
      }
    }
    goNext();
  }, [goNext, handleComponentClick]);

  // Loading state
  if (loading) {
    return (
      <div className="presentation">
        <div className="presentation-loading">Loading presentation...</div>
      </div>
    );
  }

  // Error state
  if (error || !deck) {
    return (
      <div className="presentation">
        <div className="presentation-error">
          <p>{error || 'Failed to load presentation'}</p>
        </div>
      </div>
    );
  }

  // No slides
  if (playOrder.length === 0 || !currentSlide) {
    return (
      <div className="presentation">
        <div className="presentation-error">
          <p>No slides to present.</p>
        </div>
      </div>
    );
  }

  const slideHeight = getSlideHeight(deck.aspectRatio);
  const viewportStyle: React.CSSProperties = {
    transform: `scale(${scale})`,
    transformOrigin: 'center center',
    width: SLIDE_WIDTH,
    height: slideHeight,
  };

  const fromSlide = transition ? deck.slides[transition.fromSlideId] : null;
  const toSlide = transition ? deck.slides[transition.toSlideId] : null;
  const transitionDuration = transition ? `${transition.duration}s` : '0s';

  return (
    <div className="presentation" ref={containerRef} onClick={handleClick}>
      <div
        className="presentation-viewport"
        style={{ ...viewportStyle, '--transition-duration': transitionDuration } as React.CSSProperties}
      >
        {transition && fromSlide && toSlide ? (
          <div className={`presentation-transition transition-${transition.type} ${transition.phase}`}>
            <div className="transition-slide transition-from">
              <SlideRenderer slide={fromSlide} deck={deck} />
            </div>
            <div className="transition-slide transition-to">
              <SlideRenderer slide={toSlide} deck={deck} />
            </div>
          </div>
        ) : (
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

      {/* Navigation controls */}
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

      {/* Fullscreen button */}
      <button
        className="presentation-exit"
        onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
        title="Fullscreen (F)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}
