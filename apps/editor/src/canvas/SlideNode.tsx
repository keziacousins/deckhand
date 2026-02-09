import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Slide, Theme, AspectRatio, Asset, SlidesMap } from '@deckhand/schema';
import { SLIDE_WIDTH, getSlideHeight, themeToCssProperties } from '@deckhand/schema';
import { useSelection } from '../selection';
import { renderComponent, getTopLevelComponents } from '../utils/renderComponent';
import './SlideNode.css';

type SlideNodeData = {
  slide: Slide;
  theme: Theme;
  aspectRatio: AspectRatio;
  gridColumns: number;
  assets: Record<string, Asset>;
  showGrid?: boolean;
  selectedComponentId?: string | null;
  // For backdrop slide rendering
  allSlides: SlidesMap;
  defaultBackdropSlideId?: string;
};

export type SlideNodeType = Node<SlideNodeData, 'slide'>;

/**
 * Render a backdrop slide (non-interactive, behind main content)
 */
function BackdropSlideRenderer({
  slide,
  allSlides,
  defaultBackdropSlideId,
  theme,
  aspectRatio,
  gridColumns,
  assets,
  visitedSlideIds = new Set(),
}: {
  slide: Slide;
  allSlides: SlidesMap;
  defaultBackdropSlideId?: string;
  theme: Theme;
  aspectRatio: AspectRatio;
  gridColumns: number;
  assets: Record<string, Asset>;
  visitedSlideIds?: Set<string>;
}) {
  const effectiveGridColumns = slide.gridColumns ?? gridColumns;
  const assetsJson = JSON.stringify(assets);
  const themeStyle = themeToCssProperties(theme) as React.CSSProperties;

  // Resolve this slide's backdrop
  // '__none__' means explicitly no backdrop (override default)
  const backdropSlideId = slide.style?.backdropSlideId === '__none__'
    ? undefined
    : (slide.style?.backdropSlideId ?? defaultBackdropSlideId);
  
  // Get backdrop slide if valid and not causing a cycle
  const backdropSlide = backdropSlideId && 
    backdropSlideId !== slide.id && 
    !visitedSlideIds.has(backdropSlideId) &&
    visitedSlideIds.size < 10
      ? allSlides[backdropSlideId] 
      : null;

  const newVisitedIds = new Set(visitedSlideIds);
  newVisitedIds.add(slide.id);

  // Backdrop slides use transparent background if:
  // 1. backgroundTransparent is explicitly true, OR
  // 2. backgroundTransparent is undefined AND no background color/image is set
  const style = slide.style ?? {};
  const useTransparentBg = style.backgroundTransparent === true || 
    (style.backgroundTransparent === undefined && !style.background && !style.backgroundAssetId);

  return (
    <div className="slide-backdrop-layer" style={themeStyle}>
      {backdropSlide && (
        <BackdropSlideRenderer
          slide={backdropSlide}
          allSlides={allSlides}
          defaultBackdropSlideId={defaultBackdropSlideId}
          theme={theme}
          aspectRatio={aspectRatio}
          gridColumns={gridColumns}
          assets={assets}
          visitedSlideIds={newVisitedIds}
        />
      )}
      <deck-slide
        grid-columns={effectiveGridColumns.toString()}
        style-background={style.background}
        style-text-primary={style.textPrimary}
        style-text-secondary={style.textSecondary}
        style-accent={style.accent}
        background-asset-id={style.backgroundAssetId}
        assets={assetsJson}
        background-size={style.backgroundSize}
        background-darken={style.backgroundDarken?.toString()}
        background-blur={style.backgroundBlur?.toString()}
        background-transparent={useTransparentBg ? 'true' : undefined}
      >
        {getTopLevelComponents(slide.components).map((c) => 
          renderComponent(c, { editorMode: false, assets, allComponents: slide.components, slideTitle: slide.title })
        )}
      </deck-slide>
    </div>
  );
}

export const SlideNode = memo(function SlideNode({
  data,
  selected,
  id,
}: NodeProps<SlideNodeType>) {
  const { slide, theme, aspectRatio, gridColumns, assets, showGrid, selectedComponentId, allSlides, defaultBackdropSlideId } = data;
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

  // Resolve backdrop slide
  // '__none__' means explicitly no backdrop (override default)
  const backdropSlideId = slide.style?.backdropSlideId === '__none__'
    ? undefined
    : (slide.style?.backdropSlideId ?? defaultBackdropSlideId);
  const backdropSlide = backdropSlideId && backdropSlideId !== slide.id 
    ? allSlides[backdropSlideId] 
    : null;
  
  const hasBackdrop = !!backdropSlide;
  const style = slide.style ?? {};

  // Build detail style - includes background when we have a backdrop
  const detailStyle: React.CSSProperties = {
    ...themeStyle,
    backgroundColor: hasBackdrop ? (style.background || 'var(--deck-color-background)') : undefined,
  };

  return (
    <div
      className={`slide-node ${selected ? 'selected' : ''}`}
      style={{ width: SLIDE_WIDTH, height: slideHeight }}
    >
      {/* Target handles - incoming connections */}
      <Handle type="target" position={Position.Left} id="target-left" />
      <Handle type="target" position={Position.Top} id="target-top" />

      {/* Slide content */}
      <div className="slide-node-detail" style={detailStyle} onClick={handleDetailClick}>
        {/* Background image layer (when slide has backdrop) */}
        {hasBackdrop && style.backgroundAssetId && assets[style.backgroundAssetId] && (
          <div 
            className="slide-background-image"
            style={{
              backgroundImage: `url(${assets[style.backgroundAssetId].url})`,
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
        
        {/* Backdrop slide layer */}
        {backdropSlide && (
          <BackdropSlideRenderer
            slide={backdropSlide}
            allSlides={allSlides}
            defaultBackdropSlideId={defaultBackdropSlideId}
            theme={theme}
            aspectRatio={aspectRatio}
            gridColumns={gridColumns}
            assets={assets}
          />
        )}
        
        {/* Main slide content */}
        <deck-slide
          grid-columns={effectiveGridColumns.toString()}
          show-grid={showGrid ? 'true' : undefined}
          style-background={hasBackdrop ? undefined : style.background}
          style-text-primary={style.textPrimary}
          style-text-secondary={style.textSecondary}
          style-accent={style.accent}
          background-asset-id={hasBackdrop ? undefined : style.backgroundAssetId}
          assets={assetsJson}
          background-size={hasBackdrop ? undefined : style.backgroundSize}
          background-darken={hasBackdrop ? undefined : style.backgroundDarken?.toString()}
          background-blur={hasBackdrop ? undefined : style.backgroundBlur?.toString()}
          background-transparent={hasBackdrop ? 'true' : undefined}
        >
          {getTopLevelComponents(slide.components).map((c) => 
            renderComponent(c, { 
              editorMode: true, 
              selectedComponentId: selectedComponentId ?? undefined,
              assets,
              allComponents: slide.components,
              slideTitle: slide.title,
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
