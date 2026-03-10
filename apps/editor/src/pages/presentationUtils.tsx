/**
 * Shared presentation logic used by both Presentation (authenticated)
 * and PublicPresentation (anonymous) components.
 */

import type { Deck, Slide, TransitionType, Edge } from '@deckhand/schema';
import { DEFAULT_GRID_COLUMNS, SLIDE_WIDTH, getSlideHeight, themeToCssProperties, DEFAULT_TRANSITION_DURATION } from '@deckhand/schema';
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
export function computePlayOrder(deck: Deck, startSlideId: string): PlayOrderEntry[] {
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
export function getTransitionInfo(
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
