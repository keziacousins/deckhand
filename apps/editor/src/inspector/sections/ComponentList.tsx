import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { InspectorSectionProps } from '../types';
import { scrollHeaderToSticky } from '../types';
import type { Component, Asset, Edge, Slide } from '@deckhand/schema';
import { registry } from '@deckhand/components';
import type { PropertyDescriptor } from '@deckhand/components';
import { PropertyGroups } from '@deckhand/components';
import { PropertyEditor, SelectField } from '../fields';
import { useSelection } from '../../selection';
import { useInspectorExpansion } from '../context/InspectorExpansionContext';

const HEADER_HEIGHT = 41; /* 8px padding + 24px content + 8px padding + 1px border */

/** Get summary text shown in the collapsed header for a component */
function getSummaryMeta(component: Component): string | null {
  const props = component.props as Record<string, unknown>;

  switch (component.type) {
    case 'deck-text': {
      const content = props.content as string | undefined;
      if (content) {
        const truncated = content.length > 30 ? content.slice(0, 30) + '...' : content;
        return truncated;
      }
      return null;
    }
    case 'deck-container': {
      const gw = props.gridWidth as number | undefined;
      return gw ? `${gw} col` : null;
    }
    default: {
      const gw = props.gridWidth as number | undefined;
      return gw && gw > 0 ? `${gw} col` : null;
    }
  }
}

interface ComponentCardProps {
  component: Component;
  slideId: string;
  index: number;
  totalCount: number;
  isExpanded: boolean;
  assets: Record<string, Asset>;
  onExpand: () => void;
  onCollapse: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToRoot?: () => void;
  onUpdateProp: (field: string, value: unknown) => void;
  onDragStart: (e: React.DragEvent, componentId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  /** Whether this component is a child of a container */
  isChild?: boolean;
  /** Visual drop indicator: top border, bottom border, or container highlight */
  dropIndicator?: 'top' | 'bottom' | 'into' | null;
  /** Index for sticky header stacking */
  stickyIndex?: number;
  /** Ref forwarded to the header element for scroll-into-view */
  headerRef?: React.Ref<HTMLDivElement>;
  /** Existing edge from this component (if linked) */
  linkEdge?: Edge;
  /** Slides available as link targets */
  linkTargetSlides?: Slide[];
  /** Callback to add/update/remove a component link */
  onLinkChange?: (componentId: string, targetSlideId: string | null) => void;
}

function ComponentCard({
  component,
  index,
  totalCount,
  isExpanded,
  assets,
  onExpand,
  onCollapse,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMoveToRoot,
  onUpdateProp,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isChild = false,
  dropIndicator = null,
  stickyIndex = 0,
  headerRef,
  linkEdge,
  linkTargetSlides,
  onLinkChange,
}: ComponentCardProps) {
  const meta = registry.getMeta(component.type);
  const componentName = meta?.name ?? component.type;
  const gridWidth = (component.props as Record<string, unknown>).gridWidth as number | undefined;

  // Track whether a drag happened so we can suppress click
  const didDragRef = useRef(false);

  // Group properties by their group field
  const groupedProperties = useMemo(() => {
    if (!meta) return {};
    const groups: Record<string, Array<[string, PropertyDescriptor]>> = {};
    
    for (const [key, prop] of Object.entries(meta.properties)) {
      const group = prop.group || PropertyGroups.CONTENT;
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push([key, prop]);
    }
    
    return groups;
  }, [meta]);

  // Order groups: Content first, then Layout, Style, Advanced
  const groupOrder: string[] = [
    PropertyGroups.CONTENT,
    PropertyGroups.LAYOUT,
    PropertyGroups.STYLE,
    PropertyGroups.ADVANCED,
  ];

  const orderedGroups = useMemo(() => {
    const result: Array<{ name: string; properties: Array<[string, PropertyDescriptor]> }> = [];
    
    for (const g of groupOrder) {
      if (groupedProperties[g]?.length > 0) {
        result.push({ name: g, properties: groupedProperties[g] });
      }
    }
    
    // Add any custom groups not in the standard order
    for (const [groupName, props] of Object.entries(groupedProperties)) {
      if (!groupOrder.includes(groupName) && props.length > 0) {
        result.push({ name: groupName, properties: props });
      }
    }
    
    return result;
  }, [groupedProperties]);

  const isContainer = component.type === 'deck-container';

  return (
    <>
      <div
        ref={headerRef}
        className="section-header"
        data-expanded={isExpanded}
        data-container={isContainer || undefined}
        data-child={isChild || undefined}
        data-dragging={isDragging || undefined}
        data-drop-indicator={dropIndicator || undefined}
        style={{ '--sticky-top': `${stickyIndex * HEADER_HEIGHT}px`, '--sticky-index': stickyIndex } as React.CSSProperties}
        draggable
        onDragStart={(e) => { didDragRef.current = true; onDragStart(e, component.id); }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={(e) => { onDragEnd(); /* reset after a short delay so click doesn't fire */ setTimeout(() => { didDragRef.current = false; }, 0); }}
        onClick={() => { if (didDragRef.current) return; onExpand(); }}
      >
        {/* Drag handle */}
        <div className="section-header-drag-handle" title="Drag to reorder">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="5" cy="4" r="1.5" fill="currentColor" />
            <circle cx="11" cy="4" r="1.5" fill="currentColor" />
            <circle cx="5" cy="8" r="1.5" fill="currentColor" />
            <circle cx="11" cy="8" r="1.5" fill="currentColor" />
            <circle cx="5" cy="12" r="1.5" fill="currentColor" />
            <circle cx="11" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </div>

        {/* Expand/collapse chevron — only way to collapse */}
        <button 
          className="section-header-expand" 
          onClick={(e) => { e.stopPropagation(); if (isExpanded) onCollapse(); else onExpand(); }}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 16 16" 
            fill="none"
            className={isExpanded ? 'section-header-chevron-expanded' : ''}
          >
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="section-header-title">
          <span className="section-header-name">{componentName}</span>
          {!isExpanded && (() => {
            const meta = getSummaryMeta(component);
            return meta ? <span className="section-header-meta">{meta}</span> : null;
          })()}
        </div>

        <div className="section-header-actions">
          {onMoveToRoot && (
            <button
              className="section-header-action"
              onClick={(e) => { e.stopPropagation(); onMoveToRoot(); }}
              title="Move out of container"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 2l4 4H9v6H7V6H4l4-4z" fill="currentColor" />
                <path d="M3 12h10v2H3v-2z" fill="currentColor" />
              </svg>
            </button>
          )}
          <button
            className="section-header-action"
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={index === 0}
            title="Move up"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 4l4 5H4l4-5z" fill="currentColor" />
            </svg>
          </button>
          <button
            className="section-header-action"
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={index === totalCount - 1}
            title="Move down"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 12l4-5H4l4 5z" fill="currentColor" />
            </svg>
          </button>
          <button
            className="section-header-action section-header-action-delete"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete component"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {meta && (
        <div className="section-body" data-expanded={isExpanded} data-child={isChild || undefined}>
          <div className="section-body-inner">
            <div className="section-body-overflow">
              <div className="section-body-content">
                {orderedGroups.map(({ name, properties }) => (
                  <div key={name} className="component-property-group">
                    {orderedGroups.length > 1 && name !== PropertyGroups.CONTENT && properties.length > 1 && (
                      <div className="component-group-label">{name}</div>
                    )}
                    {properties.map(([key, descriptor]) => {
                      const currentValue = (component.props as Record<string, unknown>)[key];
                      return (
                        <PropertyEditor
                          key={key}
                          name={key}
                          descriptor={descriptor}
                          value={currentValue}
                          onChange={(value) => onUpdateProp(key, value)}
                          assets={assets}
                        />
                      );
                    })}
                  </div>
                ))}
                {onLinkChange && linkTargetSlides && (
                  <div className="component-property-group">
                    <div className="component-group-label">Link</div>
                    <SelectField
                      label="Navigate to"
                      value={linkEdge?.to ?? ''}
                      options={[
                        { value: '', label: 'None' },
                        ...linkTargetSlides.map(s => ({ value: s.id, label: s.title || 'Untitled' })),
                      ]}
                      onChange={(value) => onLinkChange(component.id, value || null)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ComponentList({ context, stickyIndex = 0 }: InspectorSectionProps) {
  const { deck, selectedSlide, selection, onUpdate, onDeleteComponent, onReorderComponent, onReorderComponents, onMoveComponentToContainer } = context;
  const assets = deck.assets ?? {};
  const { selectComponent } = useSelection();

  // Component link data
  const componentEdgeMap = useMemo(() => {
    const map = new Map<string, Edge>();
    for (const edge of Object.values(deck.flow.edges)) {
      // Check if this edge's source is a component (not a slide or start point)
      if (!deck.slides[edge.from] && !deck.flow.startPoints?.[edge.from]) {
        map.set(edge.from, edge);
      }
    }
    return map;
  }, [deck.flow.edges, deck.slides, deck.flow.startPoints]);

  const linkTargetSlides = useMemo(() => {
    if (!selection.slideId) return [];
    return Object.values(deck.slides).filter(s => s.id !== selection.slideId);
  }, [deck.slides, selection.slideId]);
  const { onComponentLinkChange } = context;
  const { isComponentExpanded, expandComponent, collapseComponent, resetComponents } = useInspectorExpansion();
  
  // Drag and drop state - track by component ID
  const [draggedComponentId, setDraggedComponentId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<'top' | 'bottom' | 'into' | null>(null);
  
  // Refs for scrolling to selected component header
  const headerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Track previous selection to detect canvas-driven changes
  const prevSelectionRef = useRef<string | null>(null);
  const prevSlideIdRef = useRef<string | null>(null);

  // Derived values (safe to compute even when no slide selected)
  const slideId = selection.slideId ?? '';
  const components = selectedSlide?.components ?? [];
  
  const draggedComponent = draggedComponentId 
    ? components.find(c => c.id === draggedComponentId) 
    : null;

  const scrollToHeader = useCallback((componentId: string) => {
    setTimeout(() => {
      const header = headerRefs.current.get(componentId);
      if (header) scrollHeaderToSticky(header);
    }, 250);
  }, []);
  
  // Reset component-level state when switching slides
  useEffect(() => {
    if (slideId !== prevSlideIdRef.current) {
      prevSlideIdRef.current = slideId;
      resetComponents();
      setDraggedComponentId(null);
      setDropTargetId(null);
      setDropIndicator(null);
    }
  }, [slideId, resetComponents]);

  // Auto-expand and scroll when a component is selected on the canvas
  useEffect(() => {
    if (!selectedSlide || !selection.slideId) return;
    
    const prevSelection = prevSelectionRef.current;
    prevSelectionRef.current = selection.componentId;
    
    if (selection.componentId && selection.componentId !== prevSelection) {
      expandComponent(selection.componentId);
      scrollToHeader(selection.componentId);
    }
  }, [selection.componentId, selection.slideId, selectedSlide, expandComponent, scrollToHeader]);

  const handleExpand = useCallback((componentId: string) => {
    expandComponent(componentId);
    if (slideId) selectComponent(slideId, componentId);
    scrollToHeader(componentId);
  }, [expandComponent, slideId, selectComponent, scrollToHeader]);

  const handleCollapse = useCallback((componentId: string) => {
    const component = components.find(c => c.id === componentId);
    const childIds = component?.type === 'deck-container'
      ? components.filter(c => c.parentId === componentId).map(c => c.id)
      : undefined;
    collapseComponent(componentId, childIds);
  }, [collapseComponent, components]);

  // Safety net: document-level dragend clears stale drag state.
  // When a drop triggers a reorder, the dragged element may be removed from the DOM
  // before its onDragEnd fires, leaving draggedComponentId/dropIndicator stale.
  useEffect(() => {
    const cleanup = () => {
      setDraggedComponentId(null);
      setDropTargetId(null);
      setDropIndicator(null);
    };
    document.addEventListener('dragend', cleanup);
    document.addEventListener('drop', cleanup);
    return () => {
      document.removeEventListener('dragend', cleanup);
      document.removeEventListener('drop', cleanup);
    };
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, componentId: string) => {
    e.stopPropagation();
    setDraggedComponentId(componentId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', componentId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetComponentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedComponentId || draggedComponentId === targetComponentId) return;
    
    const targetComponent = components.find(c => c.id === targetComponentId);
    if (!targetComponent) return;
    
    const isContainer = targetComponent.type === 'deck-container';
    // Don't allow dropping a container into another container
    if (isContainer && draggedComponent?.type === 'deck-container') return;
    
    // Detect top/bottom half of header
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isTopHalf = (e.clientY - rect.top) < rect.height / 2;
    
    let indicator: 'top' | 'bottom' | 'into';
    if (isTopHalf) {
      indicator = 'top'; // insert before
    } else if (isContainer && draggedComponent?.type !== 'deck-container') {
      indicator = 'into'; // drop into container
    } else {
      indicator = 'bottom'; // insert after
    }
    
    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(targetComponentId);
    setDropIndicator(indicator);
  }, [draggedComponentId, draggedComponent, components]);

  const handleDrop = useCallback((e: React.DragEvent, targetComponentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedComponentId || !slideId || !dropIndicator) return;
    
    const targetComponent = components.find(c => c.id === targetComponentId);
    if (!targetComponent) return;
    
    // Capture values and clear state before triggering reorder
    // (reorder causes re-render; if state lingers, moved component shows stale indicator)
    const action = dropIndicator;
    setDraggedComponentId(null);
    setDropTargetId(null);
    setDropIndicator(null);
    
    if (action === 'into') {
      // Drop into container
      onMoveComponentToContainer?.(slideId, draggedComponentId, targetComponentId);
    } else {
      // Insert before (top) or after (bottom) the target
      const draggedIndex = components.findIndex(c => c.id === draggedComponentId);
      const targetIndex = components.findIndex(c => c.id === targetComponentId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newComponents = [...components];
        const [removed] = newComponents.splice(draggedIndex, 1);
        // Strip parentId if moving to a different parent level
        const targetParentId = targetComponent.parentId ?? null;
        const draggedParentId = removed.parentId ?? null;
        const movedComponent = draggedParentId !== targetParentId
          ? targetParentId === null
            ? (() => { const { parentId, ...rest } = removed; return rest as Component; })()
            : { ...removed, parentId: targetParentId }
          : removed;
        // Calculate insert position (adjusted for removal)
        let insertAt = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;
        if (action === 'bottom') insertAt += 1;
        newComponents.splice(insertAt, 0, movedComponent);
        onReorderComponents?.(slideId, newComponents);
      }
    }
  }, [draggedComponentId, slideId, dropIndicator, components, onMoveComponentToContainer, onReorderComponents]);

  const handleDragEnd = useCallback(() => {
    setDraggedComponentId(null);
    setDropTargetId(null);
    setDropIndicator(null);
  }, []);

  // Get top-level components (no parentId)
  const topLevelComponents = useMemo(() => {
    return components.filter(c => !c.parentId);
  }, [components]);

  // Get children of a container
  const getChildComponents = useCallback((parentId: string) => {
    return components.filter(c => c.parentId === parentId);
  }, [components]);

  // Flat render: returns an array of header+body elements for a component
  // and recursively for its children (all as flat siblings)
  const renderComponentFlat = useCallback((component: Component, isChild: boolean, cardStickyIndex: number): React.ReactNode[] => {
    const originalIndex = components.findIndex(c => c.id === component.id);
    const isDragging = draggedComponentId === component.id;
    const isContainer = component.type === 'deck-container';
    const childComponents = isContainer ? getChildComponents(component.id) : [];
    const siblingCount = !isChild
      ? topLevelComponents.length 
      : components.filter(c => c.parentId === component.parentId).length;
    
    const cardDropIndicator = dropTargetId === component.id ? dropIndicator : null;

    const elements: React.ReactNode[] = [];

    const refCallback = (el: HTMLDivElement | null) => {
      if (el) {
        headerRefs.current.set(component.id, el);
      } else {
        headerRefs.current.delete(component.id);
      }
    };

    elements.push(
      <ComponentCard
        key={component.id}
        component={component}
        slideId={slideId}
        index={originalIndex}
        totalCount={siblingCount}
        isExpanded={isComponentExpanded(component.id)}
        assets={assets}
        onExpand={() => handleExpand(component.id)}
        onCollapse={() => handleCollapse(component.id)}
        onDelete={() => onDeleteComponent?.(slideId, component.id)}
        onMoveUp={() => onReorderComponent?.(slideId, component.id, 'up')}
        onMoveDown={() => onReorderComponent?.(slideId, component.id, 'down')}
        onMoveToRoot={component.parentId ? () => onMoveComponentToContainer?.(slideId, component.id, null) : undefined}
        onUpdateProp={(field, value) =>
          onUpdate({ type: 'component', slideId, componentId: component.id, field, value })
        }
        onDragStart={handleDragStart}
        onDragOver={(e) => handleDragOver(e, component.id)}
        onDrop={(e) => handleDrop(e, component.id)}
        onDragEnd={handleDragEnd}
        isDragging={isDragging}
        isChild={isChild}
        dropIndicator={cardDropIndicator}
        stickyIndex={cardStickyIndex}
        headerRef={refCallback}
        linkEdge={componentEdgeMap.get(component.id)}
        linkTargetSlides={linkTargetSlides}
        onLinkChange={onComponentLinkChange}
      />
    );

    // Flatten children into the same level
    if (childComponents.length > 0) {
      for (const child of childComponents) {
        elements.push(...renderComponentFlat(child, true, cardStickyIndex + 1));
      }
    }

    return elements;
  }, [
    components, draggedComponentId, dropTargetId, dropIndicator, slideId, isComponentExpanded, assets,
    handleExpand, handleCollapse, onDeleteComponent, onReorderComponent, onMoveComponentToContainer, onUpdate,
    handleDragStart, handleDragOver, handleDrop, handleDragEnd, getChildComponents, topLevelComponents,
    componentEdgeMap, linkTargetSlides, onComponentLinkChange,
  ]);

  // Early returns AFTER all hooks
  if (!selectedSlide || !selection.slideId) return null;

  if (components.length === 0) {
    return (
      <div className="component-list-empty">
        No components yet. Click "Add Component" below to get started.
      </div>
    );
  }

  return (
    <>
      {topLevelComponents.map((component, i) => renderComponentFlat(component, false, stickyIndex + i))}
    </>
  );
}
