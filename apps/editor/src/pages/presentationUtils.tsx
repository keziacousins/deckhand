/**
 * Shared presentation logic used by both Presentation (authenticated)
 * and PublicPresentation (anonymous) components.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Deck, Slide, TransitionType, Edge } from '@deckhand/schema';
import { DEFAULT_GRID_COLUMNS, SLIDE_WIDTH, getSlideHeight, themeToCssProperties, DEFAULT_TRANSITION_DURATION, resolveEdgeSource } from '@deckhand/schema';
import { renderComponent, getTopLevelComponents } from '../utils/renderComponent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayOrderEntry {
  slideId: string;
  /** The edge that leads TO this slide (null for first slide) */
  incomingEdgeId: string | null;
}

export interface TransitionState {
  isTransitioning: boolean;
  type: TransitionType;
  duration: number;
  fromSlideId: string;
  toSlideId: string;
  phase: 'enter' | 'active' | 'done';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Compute the play order by traversing edges from a starting slide.
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

    const outgoingEdge = Object.values(deck.flow.edges).find(e => e.from === currentId);
    incomingEdgeId = outgoingEdge?.id ?? null;
    currentId = outgoingEdge?.to ?? null;
  }

  return order;
}

/**
 * Get transition info for navigating between slides.
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

  if (direction === 'backward') {
    if (type === 'slide-left') type = 'slide-right';
    else if (type === 'slide-right') type = 'slide-left';
    else if (type === 'slide-up') type = 'slide-down';
    else if (type === 'slide-down') type = 'slide-up';
  }

  return { type, duration };
}

// ---------------------------------------------------------------------------
// SlideRenderer
// ---------------------------------------------------------------------------

interface SlideRendererProps {
  slide: Slide;
  deck: Deck;
  visitedSlideIds?: Set<string>;
  isBackdrop?: boolean;
  /** Map of componentId → edge for this slide's linked components */
  componentLinks?: Map<string, Edge>;
  onComponentClick?: (componentId: string) => void;
}

export function SlideRenderer({
  slide,
  deck,
  visitedSlideIds = new Set(),
  isBackdrop = false,
  componentLinks,
  onComponentClick,
}: SlideRendererProps) {
  const gridColumns = slide.gridColumns ?? deck.gridColumns ?? DEFAULT_GRID_COLUMNS;
  const style = slide.style ?? {};
  const slideHeight = getSlideHeight(deck.aspectRatio);
  const assets = deck.assets ?? {};
  const assetsJson = JSON.stringify(assets);

  const themeStyle = themeToCssProperties(deck.theme) as React.CSSProperties;

  const containerStyle: React.CSSProperties = {
    ...themeStyle,
    width: SLIDE_WIDTH,
    height: slideHeight,
  };

  const backdropSlideId = style.backdropSlideId === '__none__'
    ? undefined
    : (style.backdropSlideId ?? deck.defaultBackdropSlideId);

  const backdropSlide = backdropSlideId &&
    backdropSlideId !== slide.id &&
    !visitedSlideIds.has(backdropSlideId) &&
    visitedSlideIds.size < 10
      ? deck.slides[backdropSlideId]
      : null;

  const newVisitedIds = new Set(visitedSlideIds);
  newVisitedIds.add(slide.id);

  const hasBackdrop = !!backdropSlide;
  const backdropUsesTransparentBg = isBackdrop && (
    style.backgroundTransparent === true ||
    (style.backgroundTransparent === undefined && !style.background && !style.backgroundAssetId)
  );
  const useTransparentBg = hasBackdrop || backdropUsesTransparentBg;

  const wrapperStyle: React.CSSProperties = {
    ...containerStyle,
    backgroundColor: hasBackdrop ? (style.background || 'var(--deck-color-background)') : undefined,
  };

  const bgAsset = style.backgroundAssetId ? assets[style.backgroundAssetId] : undefined;

  return (
    <div className="presentation-slide-wrapper" style={wrapperStyle}>
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

// ---------------------------------------------------------------------------
// usePresentationPlayer hook
// ---------------------------------------------------------------------------

export interface UsePresentationPlayerOptions {
  deck: Deck | null;
  startSlideId?: string;
}

export interface PresentationPlayer {
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  scale: number;
  containerRef: React.RefObject<HTMLDivElement>;
  transition: TransitionState | null;
  playOrder: PlayOrderEntry[];
  currentSlideId: string | undefined;
  currentSlide: Slide | undefined;
  canGoNext: boolean;
  canGoPrev: boolean;
  componentLinks: Map<string, Edge>;
  goNext: () => void;
  goPrev: () => void;
  handleComponentClick: (componentId: string) => void;
  handleClick: (e: React.MouseEvent) => void;
}

/**
 * Encapsulates the presentation navigation state machine:
 * play-order computation, slide transitions, component links,
 * scale-to-fit, and forward/back navigation with history.
 *
 * Data loading and asset resolution remain the caller's responsibility.
 */
export function usePresentationPlayer({
  deck,
  startSlideId,
}: UsePresentationPlayerOptions): PresentationPlayer {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const [transition, setTransition] = useState<TransitionState | null>(null);
  const [playOrderStart, setPlayOrderStart] = useState<string | undefined>(undefined);
  const [navHistory, setNavHistory] = useState<Array<{ start: string | undefined; index: number }>>([]);

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
    if (edge) {
      navigateToSlide(edge.to, edge.transition, edge.transitionDuration);
    }
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
      requestAnimationFrame(() => {
        setTransition(t => t ? { ...t, phase: 'active' } : null);
      });
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setTransition(null);
      }, duration * 1000);
    }
  }, [canGoNext, currentIndex, currentSlideId, deck, playOrder]);

  const goPrev = useCallback(() => {
    if (!canGoPrev || !deck || !currentSlideId) return;

    // If at the start of current play order and there's history, pop back
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
      requestAnimationFrame(() => {
        setTransition(t => t ? { ...t, phase: 'active' } : null);
      });
      setTimeout(() => {
        setCurrentIndex(prevIndex);
        setTransition(null);
      }, duration * 1000);
    }
  }, [canGoPrev, currentIndex, currentSlideId, currentEntry, deck, navHistory, playOrder]);

  // Click to advance (or follow component link)
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
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
  }, [goNext, handleComponentClick]);

  return {
    currentIndex,
    setCurrentIndex,
    scale,
    containerRef,
    transition,
    playOrder,
    currentSlideId,
    currentSlide,
    canGoNext,
    canGoPrev,
    componentLinks,
    goNext,
    goPrev,
    handleComponentClick,
    handleClick,
  };
}
