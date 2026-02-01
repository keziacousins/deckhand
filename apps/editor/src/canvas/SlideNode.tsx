import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Slide, Theme, Component, AspectRatio } from '@deckhand/schema';
import { SLIDE_WIDTH, getSlideHeight, themeToCssProperties } from '@deckhand/schema';
import { useSelection } from '../selection';
import './SlideNode.css';

type SlideNodeData = {
  slide: Slide;
  theme: Theme;
  aspectRatio: AspectRatio;
  gridColumns: number;
  showGrid?: boolean;
  selectedComponentId?: string | null;
};

export type SlideNodeType = Node<SlideNodeData, 'slide'>;

function renderComponent(component: Component, isSelected: boolean): JSX.Element | null {
  const selectedClass = isSelected ? 'component-selected' : '';
  // Convert gridWidth number to string attribute, undefined if not set
  const gridWidth = component.props.gridWidth?.toString();
  
  switch (component.type) {
    case 'deck-title':
      return (
        <deck-title
          key={component.id}
          data-component-id={component.id}
          class={selectedClass}
          text={component.props.text}
          level={component.props.level}
          align={component.props.align}
          grid-width={gridWidth}
        />
      );
    case 'deck-headline-subhead':
      return (
        <deck-headline-subhead
          key={component.id}
          data-component-id={component.id}
          class={selectedClass}
          headline={component.props.headline}
          subheading={component.props.subheading}
          category={component.props.category}
          is-hero={component.props.isHero ? 'true' : undefined}
          variant={component.props.variant}
          align={component.props.align}
          grid-width={gridWidth}
        />
      );
    default:
      return null;
  }
}

export const SlideNode = memo(function SlideNode({
  data,
  selected,
  id,
}: NodeProps<SlideNodeType>) {
  const { slide, theme, aspectRatio, gridColumns, showGrid, selectedComponentId } = data;
  const slideHeight = getSlideHeight(aspectRatio);
  // Use slide-specific gridColumns if set, otherwise use deck default
  const effectiveGridColumns = slide.gridColumns ?? gridColumns;
  const { selectComponent, selectSlide } = useSelection();

  // Handle clicks on the slide content to select components
  const handleDetailClick = useCallback((e: React.MouseEvent) => {
    // Find the closest element with data-component-id
    const target = e.target as HTMLElement;
    const componentEl = target.closest('[data-component-id]');
    
    if (componentEl) {
      const componentId = componentEl.getAttribute('data-component-id');
      if (componentId) {
        e.stopPropagation();
        selectComponent(id, componentId);
        return;
      }
    }
    
    // Clicked on slide background, select the slide
    selectSlide(id);
  }, [id, selectComponent, selectSlide]);

  // Convert theme tokens to CSS custom properties (includes computed scales)
  const themeStyle = themeToCssProperties(theme) as React.CSSProperties;

  return (
    <div
      className={`slide-node ${selected ? 'selected' : ''}`}
      style={{ width: SLIDE_WIDTH, height: slideHeight }}
    >
      {/* Target handles - incoming connections */}
      <Handle type="target" position={Position.Left} id="target-left" />
      <Handle type="target" position={Position.Top} id="target-top" />

      {/* Slide content */}
      <div className="slide-node-detail" style={themeStyle} onClick={handleDetailClick}>
        <deck-slide
          grid-columns={effectiveGridColumns.toString()}
          show-grid={showGrid ? 'true' : undefined}
          style-background={slide.style?.background}
          style-text-primary={slide.style?.textPrimary}
          style-text-secondary={slide.style?.textSecondary}
          style-accent={slide.style?.accent}
          background-image={slide.style?.backgroundImage}
          background-size={slide.style?.backgroundSize}
          background-darken={slide.style?.backgroundDarken?.toString()}
          background-blur={slide.style?.backgroundBlur?.toString()}
        >
          {slide.components.map((c) => renderComponent(c, c.id === selectedComponentId))}
        </deck-slide>
      </div>

      {/* Source handles - outgoing connections */}
      <Handle type="source" position={Position.Right} id="source-right" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" />
    </div>
  );
});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'deck-slide': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'grid-columns'?: string;
          'show-grid'?: string;
          'style-background'?: string;
          'style-text-primary'?: string;
          'style-text-secondary'?: string;
          'style-accent'?: string;
          'background-image'?: string;
          'background-size'?: string;
          'background-darken'?: string;
          'background-blur'?: string;
        },
        HTMLElement
      >;
      'deck-title': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'data-component-id'?: string;
          class?: string;
          text?: string;
          level?: string;
          align?: string;
          'grid-width'?: string;
        },
        HTMLElement
      >;
      'deck-headline-subhead': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'data-component-id'?: string;
          class?: string;
          headline?: string;
          subheading?: string;
          category?: string;
          'is-hero'?: string;
          variant?: string;
          align?: string;
          'grid-width'?: string;
        },
        HTMLElement
      >;
    }
  }
}
