import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Slide, Theme, AspectRatio, Asset } from '@deckhand/schema';
import { SLIDE_WIDTH, getSlideHeight, themeToCssProperties } from '@deckhand/schema';
import { useSelection } from '../selection';
import { renderComponent } from '../utils/renderComponent';
import './SlideNode.css';

type SlideNodeData = {
  slide: Slide;
  theme: Theme;
  aspectRatio: AspectRatio;
  gridColumns: number;
  assets: Record<string, Asset>;
  showGrid?: boolean;
  selectedComponentId?: string | null;
};

export type SlideNodeType = Node<SlideNodeData, 'slide'>;

export const SlideNode = memo(function SlideNode({
  data,
  selected,
  id,
}: NodeProps<SlideNodeType>) {
  const { slide, theme, aspectRatio, gridColumns, assets, showGrid, selectedComponentId } = data;
  const slideHeight = getSlideHeight(aspectRatio);
  // Use slide-specific gridColumns if set, otherwise use deck default
  const effectiveGridColumns = slide.gridColumns ?? gridColumns;
  const { selectComponent, selectSlide } = useSelection();
  const assetsJson = JSON.stringify(assets);

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
          background-asset-id={slide.style?.backgroundAssetId}
          assets={assetsJson}
          background-size={slide.style?.backgroundSize}
          background-darken={slide.style?.backgroundDarken?.toString()}
          background-blur={slide.style?.backgroundBlur?.toString()}
        >
          {slide.components.map((c) => 
            renderComponent(c, { 
              editorMode: true, 
              selectedComponentId: selectedComponentId ?? undefined,
              assets,
            })
          )}
        </deck-slide>
      </div>

      {/* Source handles - outgoing connections */}
      <Handle type="source" position={Position.Right} id="source-right" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" />
    </div>
  );
});
