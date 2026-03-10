import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  // Component IDs that are edge sources (component links)
  linkedComponentIds?: string[];
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
          renderComponent(c, { editorMode: false, assets, allComponents: slide.components })
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
  const { slide, theme, aspectRatio, gridColumns, assets, showGrid, selectedComponentId, allSlides, defaultBackdropSlideId, linkedComponentIds } = data;
  const slideHeight = getSlideHeight(aspectRatio);
  // Use slide-specific gridColumns if set, otherwise use deck default
  const effectiveGridColumns = slide.gridColumns ?? gridColumns;
  const { selectComponent, selectSlide } = useSelection();
  const assetsJson = JSON.stringify(assets);
  const nodeRef = useRef<HTMLDivElement>(null);

  // Measure linked component positions for per-component source handles
  // Position each handle at the link badge icon (.component-link-badge)
  const [compHandles, setCompHandles] = useState<Array<{ id: string; top: number; right: number }>>([]);
  useLayoutEffect(() => {
    if (!linkedComponentIds?.length || !nodeRef.current) {
      if (compHandles.length > 0) setCompHandles([]);
      return;
    }
    const nodeRect = nodeRef.current.getBoundingClientRect();
    const handles: typeof compHandles = [];
    // Query all badge elements and match them back to component IDs
    const badges = nodeRef.current.querySelectorAll('.component-link-badge');
    for (const badge of badges) {
      // The badge is inside a .component-link-wrapper with data-component-id
      const wrapper = badge.closest('[data-component-id]');
      if (!wrapper) continue;
      const wrapperId = wrapper.getAttribute('data-component-id')!;
      // Find which original linked component ID maps to this wrapper
      const compId = linkedComponentIds.find(id => {
        const comp = slide.components.find(c => c.id === id);
        if (!comp) return false;
        if (!comp.parentId) return comp.id === wrapperId;
        // Walk up to top-level ancestor
        let ancestor = slide.components.find(c => c.id === comp.parentId);
        while (ancestor?.parentId) {
          ancestor = slide.components.find(c => c.id === ancestor!.parentId);
        }
        return (ancestor?.id ?? id) === wrapperId;
      });
      if (!compId) continue;
      const badgeRect = badge.getBoundingClientRect();
      handles.push({
        id: compId,
        top: badgeRect.top - nodeRect.top + badgeRect.height / 2,
        right: badgeRect.left - nodeRect.left + badgeRect.width / 2,
      });
    }
    setCompHandles(handles);
  }, [linkedComponentIds, slide.components]);

  // Build the set of component IDs that should show a link badge.
  // If a linked component is nested inside a container, bubble the badge
  // up to the top-level ancestor so it doesn't get clipped.
  const linkedComponentIdSet = useMemo(() => {
    if (!linkedComponentIds?.length) return new Set<string>();
    const badgeIds = new Set<string>();
    for (const compId of linkedComponentIds) {
      const comp = slide.components.find(c => c.id === compId);
      if (!comp) continue;
      if (comp.parentId) {
        // Walk up to the top-level ancestor
        let ancestor = slide.components.find(c => c.id === comp.parentId);
        while (ancestor?.parentId) {
          ancestor = slide.components.find(c => c.id === ancestor!.parentId);
        }
        badgeIds.add(ancestor?.id ?? compId);
      } else {
        badgeIds.add(compId);
      }
    }
    return badgeIds;
  }, [linkedComponentIds, slide.components]);

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
      ref={nodeRef}
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
              linkedComponentIds: linkedComponentIdSet,
            })
          )}
        </deck-slide>
      </div>

      {/* Per-component source handles for linked components */}
      {/* Always render handles so React Flow can resolve edges immediately; */}
      {/* useLayoutEffect updates positions once badges are measured. */}
      {(linkedComponentIds ?? []).map(compId => {
        const measured = compHandles.find(h => h.id === compId);
        return (
          <Handle
            key={compId}
            type="source"
            position={Position.Right}
            id={`link-${compId}`}
            className="component-handle"
            style={measured ? { top: measured.top, left: measured.right } : undefined}
          />
        );
      })}

      {/* Source handles - outgoing connections */}
      <Handle type="source" position={Position.Right} id="source-right" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" />
    </div>
  );
});
