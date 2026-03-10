import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useYDoc } from '../sync';
import type { Deck, Slide, TransitionType, Edge } from '@deckhand/schema';
import { DEFAULT_GRID_COLUMNS, SLIDE_WIDTH, getSlideHeight, themeToCssProperties, DEFAULT_TRANSITION_DURATION, resolveEdgeSource } from '@deckhand/schema';
import { renderComponent, getTopLevelComponents } from '../utils/renderComponent';
import { useAuthAssets } from '../hooks/useAuthAssets';
import './Presentation.css';

const RADIUS_MAP: Record<string, string> = {
  sm: '4px',
  md: '8px',
  lg: '16px',
  full: '50%',
  pill: '9999px',
};

/** Resolve effective border-radius for the link wrapper.
 *  Images default to 'md' (matches their Shadow DOM default). */
function componentBorderRadius(type: string, borderRadius: string | undefined): string | undefined {
  if (borderRadius && borderRadius !== 'none') return RADIUS_MAP[borderRadius];
  if (type === 'deck-image') return RADIUS_MAP.md;
  return undefined;
}

interface PresentationProps {
  deckId: string;
  startSlideId?: string;
  onExit: () => void;
}

/**
 * Play order entry - includes slide ID and the edge used to reach it
 */
interface PlayOrderEntry {
  slideId: string;
  /** The edge that leads TO this slide (null for first slide) */
  incomingEdgeId: string | null;
}

/**
 * Compute the play order by traversing edges from a starting slide.
 * Returns an array of entries with slide IDs and their incoming edges.
 * Slides not reachable from the start slide are excluded.
 */
function computePlayOrder(deck: Deck, startSlideId: string): PlayOrderEntry[] {
  const order: PlayOrderEntry[] = [];
  const visited = new Set<string>();
  
  let currentId: string | null = startSlideId;
  let incomingEdgeId: string | null = null;
  
  while (currentId && !visited.has(currentId)) {
    if (!deck.slides[currentId]) break;
    
    visited.add(currentId);
    order.push({ slideId: currentId, incomingEdgeId });
    
    // Find outgoing edge (take first one if multiple)
    const outgoingEdge = Object.values(deck.flow.edges).find(e => e.from === currentId);
    incomingEdgeId = outgoingEdge?.id ?? null;
    currentId = outgoingEdge?.to ?? null;
  }
  
  return order;
}

/**
 * Get transition info for navigating between slides
 */
function getTransitionInfo(
  deck: Deck,
  edgeId: string | null,
  direction: 'forward' | 'backward'
): { type: TransitionType; duration: number } {
  const defaultType = deck.flow.defaultTransition ?? 'instant';
  const defaultDuration = deck.flow.defaultTransitionDuration ?? DEFAULT_TRANSITION_DURATION;
  
  if (!edgeId) {
    return { type: defaultType, duration: defaultDuration };
  }
  
  const edge = deck.flow.edges[edgeId];
  if (!edge) {
    return { type: defaultType, duration: defaultDuration };
  }
  
  let type = edge.transition ?? defaultType;
  const duration = edge.transitionDuration ?? defaultDuration;
  
  // Reverse slide direction for backward navigation
  if (direction === 'backward') {
    if (type === 'slide-left') type = 'slide-right';
    else if (type === 'slide-right') type = 'slide-left';
    else if (type === 'slide-up') type = 'slide-down';
    else if (type === 'slide-down') type = 'slide-up';
  }
  
  return { type, duration };
}

/**
 * Render a single slide using web components.
 * Supports recursive backdrop slides that render behind the main content.
 * 
 * Rendering order:
 * 1. Current slide's background (color/image)
 * 2. Backdrop slides (each with their own backgrounds/content, rendered with transparent bg by default)
 * 3. Current slide's content (components)
 */
function SlideRenderer({ 
  slide, 
  deck,
  visitedSlideIds = new Set(),
  isBackdrop = false,
  componentLinks,
  onComponentClick,
}: { 
  slide: Slide; 
  deck: Deck;
  visitedSlideIds?: Set<string>;
  isBackdrop?: boolean;
  /** Map of componentId → edge for this slide's linked components */
  componentLinks?: Map<string, Edge>;
  onComponentClick?: (componentId: string) => void;
}) {
  const gridColumns = slide.gridColumns ?? deck.gridColumns ?? DEFAULT_GRID_COLUMNS;
  const style = slide.style ?? {};
  const slideHeight = getSlideHeight(deck.aspectRatio);
  const assets = deck.assets ?? {};
  const assetsJson = JSON.stringify(assets);

  // Apply theme tokens as CSS custom properties (same as SlideNode in editor)
  const themeStyle = themeToCssProperties(deck.theme) as React.CSSProperties;

  const containerStyle: React.CSSProperties = {
    ...themeStyle,
    width: SLIDE_WIDTH,
    height: slideHeight,
  };

  // Resolve backdrop slide (per-slide override or deck default)
  // '__none__' means explicitly no backdrop (override default)
  const backdropSlideId = style.backdropSlideId === '__none__' 
    ? undefined 
    : (style.backdropSlideId ?? deck.defaultBackdropSlideId);
  
  // Get backdrop slide if it exists, isn't self-reference, and hasn't been visited (cycle prevention)
  const backdropSlide = backdropSlideId && 
    backdropSlideId !== slide.id && 
    !visitedSlideIds.has(backdropSlideId) &&
    visitedSlideIds.size < 10 // Max depth safety limit
      ? deck.slides[backdropSlideId] 
      : null;

  // Track this slide as visited for cycle prevention
  const newVisitedIds = new Set(visitedSlideIds);
  newVisitedIds.add(slide.id);

  // When this slide has a backdrop, render with transparent background so backdrop shows through.
  // The background color/image is applied to the wrapper div instead.
  // Backdrop slides use transparent bg if:
  // 1. backgroundTransparent is explicitly true, OR
  // 2. backgroundTransparent is undefined AND no background color/image is set
  const hasBackdrop = !!backdropSlide;
  const backdropUsesTransparentBg = isBackdrop && (
    style.backgroundTransparent === true || 
    (style.backgroundTransparent === undefined && !style.background && !style.backgroundAssetId)
  );
  const useTransparentBg = hasBackdrop || backdropUsesTransparentBg;

  // Build wrapper style - includes background when we have a backdrop
  const wrapperStyle: React.CSSProperties = {
    ...containerStyle,
    backgroundColor: hasBackdrop ? (style.background || 'var(--deck-color-background)') : undefined,
  };

  // When there's a backdrop, we render background on wrapper so backdrop can overlay it
  // Otherwise, deck-slide handles its own background
  const bgAsset = style.backgroundAssetId ? assets[style.backgroundAssetId] : undefined;
  
  return (
    <div className="presentation-slide-wrapper" style={wrapperStyle}>
      {/* DEBUG: Background image layer */}
      {bgAsset && (
        <div 
          className="slide-background-image"
          style={{
            backgroundImage: `url(${bgAsset.url})`,
            backgroundSize: style.backgroundSize === 'fit-width' ? '100% auto' : 
                           style.backgroundSize === 'fit-height' ? 'auto 100%' : 'cover',
            backgroundPosition: 'center',
            filter: style.backgroundBlur ? `blur(${style.backgroundBlur}px)` : undefined,
          }}
        >
          {style.backgroundDarken && style.backgroundDarken > 0 && (
            <div 
              className="slide-background-darken"
              style={{ backgroundColor: `rgba(0,0,0,${style.backgroundDarken / 100})` }}
            />
          )}
        </div>
      )}
      
      {/* Backdrop slide layer - renders on top of this slide's bg, below content */}
      {backdropSlide && (
        <div className="slide-backdrop">
          <SlideRenderer 
            slide={backdropSlide} 
            deck={deck} 
            visitedSlideIds={newVisitedIds}
            isBackdrop={true}
          />
        </div>
      )}
      
      {/* Main slide content */}
      <deck-slide
        grid-columns={gridColumns.toString()}
        style-background={hasBackdrop ? undefined : style.background}
        style-text-primary={style.textPrimary}
        style-text-secondary={style.textSecondary}
        style-accent={style.accent}
        background-asset-id={hasBackdrop ? undefined : style.backgroundAssetId}
        assets={assetsJson}
        background-size={hasBackdrop ? undefined : style.backgroundSize}
        background-darken={hasBackdrop ? undefined : style.backgroundDarken?.toString()}
        background-blur={hasBackdrop ? undefined : style.backgroundBlur?.toString()}
        background-transparent={useTransparentBg ? 'true' : undefined}
      >
        {getTopLevelComponents(slide.components).map((component) => {
          const isLinked = componentLinks?.has(component.id);
          const rendered = renderComponent(component, {
            assets,
            allComponents: slide.components,
            linked: isLinked ? true : undefined,
          });
          
          if (isLinked && onComponentClick) {
            const props = component.props as Record<string, unknown>;
            const br = componentBorderRadius(component.type, props.borderRadius as string | undefined);
            return (
              <div
                key={component.id}
                className="component-link"
                data-component-id={component.id}
                style={{
                  gridColumn: props.gridWidth ? `span ${props.gridWidth}` : undefined,
                  borderRadius: br,
                  overflow: 'hidden',
                }}
              >
                {rendered}
              </div>
            );
          }
          
          return rendered;
        })}
      </deck-slide>
    </div>
  );
}

interface TransitionState {
  isTransitioning: boolean;
  type: TransitionType;
  duration: number;
  fromIndex: number;
  toIndex: number;
  phase: 'enter' | 'active' | 'done';
}

export function Presentation({ deckId, startSlideId, onExit }: PresentationProps) {
  const { deck: rawDeck, status, error } = useYDoc(deckId);
  const rawAssets = useMemo(() => rawDeck?.assets ?? {}, [rawDeck?.assets]);
  const resolvedAssets = useAuthAssets(rawAssets);
  // Replace assets with blob URLs so web components can load them
  const deck = useMemo(() => rawDeck ? { ...rawDeck, assets: resolvedAssets } : null, [rawDeck, resolvedAssets]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transition, setTransition] = useState<TransitionState | null>(null);
  // Play order start slide — changes when a component link jumps outside
  // the current linear order.
  const [playOrderStart, setPlayOrderStart] = useState<string | undefined>(undefined);
  // Navigation history stack — tracks positions before component link jumps
  // so "back" returns to the jump origin rather than the linear predecessor.
  const [navHistory, setNavHistory] = useState<Array<{ start: string | undefined; index: number }>>([]);

  // Calculate scale to fit slide in viewport while maintaining aspect ratio
  useEffect(() => {
    if (!deck) return;

    const slideHeight = getSlideHeight(deck.aspectRatio);

    const updateScale = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate scale to fit slide in viewport (letterbox/pillarbox)
      const scaleX = viewportWidth / SLIDE_WIDTH;
      const scaleY = viewportHeight / slideHeight;
      const newScale = Math.min(scaleX, scaleY);

      setScale(newScale);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [deck]);

  // Compute play order — recomputes when a component link jumps to a new start
  const playOrder = useMemo(() => {
    if (!deck) return [];
    
    let start = playOrderStart ?? startSlideId;
    if (!start || !deck.slides[start]) {
      const slideIds = Object.keys(deck.slides);
      start = slideIds[0];
    }
    
    if (!start) return [];
    return computePlayOrder(deck, start);
  }, [deck, startSlideId, playOrderStart]);

  const currentEntry = playOrder[currentIndex];
  const currentSlideId = currentEntry?.slideId;
  const currentSlide = deck?.slides[currentSlideId];
  
  const canGoNext = currentIndex < playOrder.length - 1 && !transition?.isTransitioning;
  const canGoPrev = (currentIndex > 0 || navHistory.length > 0) && !transition?.isTransitioning;

  // Component links for the current slide.
  // If a linked component is nested inside a container, bubble the link
  // up to the top-level ancestor (same logic as the editor badge).
  const componentLinks = useMemo(() => {
    if (!deck || !currentSlideId) return new Map<string, Edge>();
    const slide = deck.slides[currentSlideId];
    if (!slide) return new Map<string, Edge>();
    
    const links = new Map<string, Edge>();
    for (const edge of Object.values(deck.flow.edges)) {
      const source = resolveEdgeSource(deck, edge.from);
      if (source?.type === 'component' && source.slideId === currentSlideId) {
        // Walk up to top-level ancestor
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

  // Navigate to a slide by ID (for component links).
  // Pushes current position onto navHistory so "back" returns here.
  const navigateToSlide = useCallback((targetSlideId: string, edgeTransition?: TransitionType, edgeDuration?: number) => {
    if (!deck || transition?.isTransitioning) return;
    if (!deck.slides[targetSlideId]) return;

    // Save current position so back returns here
    setNavHistory(h => [...h, { start: playOrderStart, index: currentIndex }]);

    const targetIndex = playOrder.findIndex(e => e.slideId === targetSlideId);
    const toIndex = targetIndex !== -1 ? targetIndex : 0;

    // Determine transition to use
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
      // Start transition animation
      setTransition({
        isTransitioning: true,
        type,
        duration,
        fromIndex: currentIndex,
        toIndex,
        phase: 'enter',
      });

      requestAnimationFrame(() => {
        setTransition(t => t ? { ...t, phase: 'active' } : null);
      });

      setTimeout(() => {
        applyNav();
        setTransition(null);
      }, duration * 1000);
    }
  }, [deck, transition, playOrder, currentIndex, playOrderStart]);

  const handleComponentClick = useCallback((componentId: string) => {
    const edge = componentLinks.get(componentId);
    if (edge) {
      navigateToSlide(edge.to, edge.transition, edge.transitionDuration);
    }
  }, [componentLinks, navigateToSlide]);

  const goNext = useCallback(() => {
    if (!canGoNext || !deck) return;
    
    const nextIndex = currentIndex + 1;
    const nextEntry = playOrder[nextIndex];
    const { type, duration } = getTransitionInfo(deck, nextEntry.incomingEdgeId, 'forward');
    
    if (type === 'instant' || duration === 0) {
      setCurrentIndex(nextIndex);
    } else {
      // Start transition
      setTransition({
        isTransitioning: true,
        type,
        duration,
        fromIndex: currentIndex,
        toIndex: nextIndex,
        phase: 'enter',
      });
      
      // Trigger animation after a frame
      requestAnimationFrame(() => {
        setTransition(t => t ? { ...t, phase: 'active' } : null);
      });
      
      // Complete transition after duration
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setTransition(null);
      }, duration * 1000);
    }
  }, [canGoNext, currentIndex, deck, playOrder]);

  const goPrev = useCallback(() => {
    if (!canGoPrev || !deck) return;
    
    // If at the start of current play order and there's history, pop back
    if (currentIndex === 0 && navHistory.length > 0) {
      const prev = navHistory[navHistory.length - 1];
      setNavHistory(h => h.slice(0, -1));
      setPlayOrderStart(prev.start);
      setCurrentIndex(prev.index);
      return;
    }
    
    const prevIndex = currentIndex - 1;
    // Use the edge that led to the current slide, but reverse direction
    const { type, duration } = getTransitionInfo(deck, currentEntry.incomingEdgeId, 'backward');
    
    if (type === 'instant' || duration === 0) {
      setCurrentIndex(prevIndex);
    } else {
      // Start transition
      setTransition({
        isTransitioning: true,
        type,
        duration,
        fromIndex: currentIndex,
        toIndex: prevIndex,
        phase: 'enter',
      });
      
      // Trigger animation after a frame
      requestAnimationFrame(() => {
        setTransition(t => t ? { ...t, phase: 'active' } : null);
      });
      
      // Complete transition after duration
      setTimeout(() => {
        setCurrentIndex(prevIndex);
        setTransition(null);
      }, duration * 1000);
    }
  }, [canGoPrev, currentIndex, currentEntry, deck, navHistory]);

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

  // Click to advance (or follow component link)
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Don't advance if clicking on interactive elements
    if (target.closest('a, button, input, textarea')) return;

    // Check if click is inside a component link.
    // Use composedPath to pierce Shadow DOM boundaries.
    const path = e.nativeEvent.composedPath();
    for (const el of path) {
      if (el instanceof HTMLElement && el.classList.contains('component-link')) {
        const compId = el.getAttribute('data-component-id');
        if (compId) {
          handleComponentClick(compId);
          return;
        }
      }
    }

    goNext();
  }, [goNext, handleComponentClick, componentLinks]);

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
  const fromSlide = transition ? deck.slides[playOrder[transition.fromIndex]?.slideId] : null;
  const toSlide = transition ? deck.slides[playOrder[transition.toIndex]?.slideId] : null;

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


