import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useYDoc } from '../sync';
import type { Deck, Slide, Component } from '@deckhand/schema';
import { DEFAULT_GRID_COLUMNS, SLIDE_WIDTH, getSlideHeight, themeToCssProperties } from '@deckhand/schema';
import './Presentation.css';

/**
 * Render a component as a web component element
 */
function renderComponent(component: Component): JSX.Element | null {
  const gridWidth = component.props.gridWidth?.toString();
  
  switch (component.type) {
    case 'deck-title':
      return (
        <deck-title
          key={component.id}
          text={component.props.text}
          level={component.props.level}
          align={component.props.align}
          grid-width={gridWidth}
        />
      );
    case 'deck-subtitle':
      return (
        <deck-subtitle
          key={component.id}
          text={component.props.text}
          align={component.props.align}
          grid-width={gridWidth}
        />
      );
    case 'deck-headline-subhead':
      return (
        <deck-headline-subhead
          key={component.id}
          headline={component.props.headline}
          subheading={component.props.subheading}
          category={component.props.category}
          is-hero={component.props.isHero ? 'true' : undefined}
          variant={component.props.variant}
          align={component.props.align}
          grid-width={gridWidth}
        />
      );
    case 'deck-text':
      return (
        <deck-text
          key={component.id}
          content={JSON.stringify(component.props.content)}
          align={component.props.align}
          grid-width={gridWidth}
        />
      );
    case 'deck-image':
      return (
        <deck-image
          key={component.id}
          asset-id={component.props.assetId}
          alt={component.props.alt}
          caption={component.props.caption}
          fit={component.props.fit}
          grid-width={gridWidth}
        />
      );
    case 'deck-list':
      return (
        <deck-list
          key={component.id}
          items={JSON.stringify(component.props.items)}
          ordered={component.props.ordered ? 'true' : undefined}
          grid-width={gridWidth}
        />
      );
    case 'deck-code':
      return (
        <deck-code
          key={component.id}
          code={component.props.code}
          language={component.props.language}
          show-line-numbers={component.props.showLineNumbers ? 'true' : undefined}
          grid-width={gridWidth}
        />
      );
    case 'deck-quote':
      return (
        <deck-quote
          key={component.id}
          text={component.props.text}
          attribution={component.props.attribution}
          grid-width={gridWidth}
        />
      );
    case 'deck-spacer':
      return (
        <deck-spacer
          key={component.id}
          height={component.props.height}
          grid-width={gridWidth}
        />
      );
    case 'deck-columns':
      // Columns are complex - for now just skip in presentation
      return null;
    default:
      return null;
  }
}

interface PresentationProps {
  deckId: string;
  startSlideId?: string;
  onExit: () => void;
}

/**
 * Compute the play order by traversing edges from a starting slide.
 * Returns an array of slide IDs in presentation order.
 * Slides not reachable from the start slide are excluded.
 */
function computePlayOrder(deck: Deck, startSlideId: string): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  
  let currentId: string | null = startSlideId;
  
  while (currentId && !visited.has(currentId)) {
    if (!deck.slides[currentId]) break;
    
    visited.add(currentId);
    order.push(currentId);
    
    // Find outgoing edge (take first one if multiple)
    const outgoingEdge = Object.values(deck.flow.edges).find(e => e.from === currentId);
    currentId = outgoingEdge?.to ?? null;
  }
  
  return order;
}

/**
 * Render a single slide using web components
 */
function SlideRenderer({ 
  slide, 
  deck,
}: { 
  slide: Slide; 
  deck: Deck;
}) {
  const gridColumns = slide.gridColumns ?? deck.gridColumns ?? DEFAULT_GRID_COLUMNS;
  const style = slide.style ?? {};
  const slideHeight = getSlideHeight(deck.aspectRatio);

  // Apply theme tokens as CSS custom properties (same as SlideNode in editor)
  const themeStyle = themeToCssProperties(deck.theme) as React.CSSProperties;

  const containerStyle: React.CSSProperties = {
    ...themeStyle,
    width: SLIDE_WIDTH,
    height: slideHeight,
  };

  return (
    <div className="presentation-slide-wrapper" style={containerStyle}>
      <deck-slide
        grid-columns={gridColumns.toString()}
        style-background={style.background}
        style-text-primary={style.textPrimary}
        style-text-secondary={style.textSecondary}
        style-accent={style.accent}
        background-image={style.backgroundImage}
        background-size={style.backgroundSize}
        background-darken={style.backgroundDarken?.toString()}
        background-blur={style.backgroundBlur?.toString()}
      >
        {slide.components.map((component) => renderComponent(component))}
      </deck-slide>
    </div>
  );
}

export function Presentation({ deckId, startSlideId, onExit }: PresentationProps) {
  const { deck, status, error } = useYDoc(deckId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Compute play order once deck is loaded
  const playOrder = useMemo(() => {
    if (!deck) return [];
    
    // Determine starting slide
    let start = startSlideId;
    if (!start || !deck.slides[start]) {
      // Fall back to entry slide or first slide
      start = deck.flow.entrySlide;
      if (!start || !deck.slides[start]) {
        const slideIds = Object.keys(deck.slides);
        start = slideIds[0];
      }
    }
    
    if (!start) return [];
    return computePlayOrder(deck, start);
  }, [deck, startSlideId]);

  const currentSlideId = playOrder[currentIndex];
  const currentSlide = deck?.slides[currentSlideId];
  
  const canGoNext = currentIndex < playOrder.length - 1;
  const canGoPrev = currentIndex > 0;

  const goNext = useCallback(() => {
    if (canGoNext) {
      setCurrentIndex(i => i + 1);
    }
  }, [canGoNext]);

  const goPrev = useCallback(() => {
    if (canGoPrev) {
      setCurrentIndex(i => i - 1);
    }
  }, [canGoPrev]);

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
          e.preventDefault();
          // If this is a popup window (opened via window.open), close it
          // Otherwise call onExit to navigate back
          if (window.opener) {
            window.close();
          } else {
            onExit();
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

  // Click to advance
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't advance if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('a, button, input, textarea')) return;
    
    goNext();
  }, [goNext]);

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

  return (
    <div className="presentation" ref={containerRef} onClick={handleClick}>
      <div className="presentation-viewport" style={viewportStyle}>
        <SlideRenderer slide={currentSlide} deck={deck} />
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

// JSX type declarations for web components
// Note: Some types are already declared in SlideNode.tsx, so we only add the missing ones
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'deck-subtitle': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          text?: string;
          align?: string;
          'grid-width'?: string;
        },
        HTMLElement
      >;
      'deck-text': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          content?: string;
          align?: string;
          'grid-width'?: string;
        },
        HTMLElement
      >;
      'deck-image': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'asset-id'?: string;
          alt?: string;
          caption?: string;
          fit?: string;
          'grid-width'?: string;
        },
        HTMLElement
      >;
      'deck-list': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          items?: string;
          ordered?: string;
          'grid-width'?: string;
        },
        HTMLElement
      >;
      'deck-code': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          code?: string;
          language?: string;
          'show-line-numbers'?: string;
          'grid-width'?: string;
        },
        HTMLElement
      >;
      'deck-quote': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          text?: string;
          attribution?: string;
          'grid-width'?: string;
        },
        HTMLElement
      >;
      'deck-spacer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          height?: string;
          'grid-width'?: string;
        },
        HTMLElement
      >;
    }
  }
}
