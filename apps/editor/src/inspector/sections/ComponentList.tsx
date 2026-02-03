import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { InspectorSectionProps } from '../types';
import type { Component, Asset } from '@deckhand/schema';
import { registry } from '@deckhand/components';
import type { PropertyDescriptor } from '@deckhand/components';
import { PropertyGroups } from '@deckhand/components';
import { PropertyEditor } from '../fields';
import { useSelection } from '../../selection';
import { useInspectorExpansion } from '../context/InspectorExpansionContext';

interface ComponentCardProps {
  component: Component;
  slideId: string;
  index: number;
  totalCount: number;
  isExpanded: boolean;
  assets: Record<string, Asset>;
  onToggleExpand: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToRoot?: () => void;
  onUpdateProp: (field: string, value: unknown) => void;
  onDragStart: (e: React.DragEvent, componentId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
  isDragging: boolean;
  /** Nesting depth for indentation (0 = top level) */
  depth?: number;
  /** Children components (for containers) */
  children?: React.ReactNode;
  /** Whether this is a valid drop target for current drag */
  isDropTarget?: boolean;
}

function ComponentCard({
  component,
  index,
  totalCount,
  isExpanded,
  assets,
  onToggleExpand,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMoveToRoot,
  onUpdateProp,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
  isDragging,
  depth = 0,
  children,
  isDropTarget = false,
}: ComponentCardProps) {
  const meta = registry.getMeta(component.type);
  const componentName = meta?.name ?? component.type;
  const gridWidth = (component.props as Record<string, unknown>).gridWidth as number | undefined;

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
  const indentStyle = depth > 0 ? { marginLeft: `${depth * 16}px` } : undefined;

  const classNames = [
    'component-card',
    isExpanded && 'component-card-expanded',
    isDragging && 'component-card-dragging',
    isContainer && 'component-card-container',
    isDropTarget && 'component-card-drop-target',
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={classNames}
      style={indentStyle}
      draggable
      onDragStart={(e) => onDragStart(e, component.id)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="component-card-header">
        {/* Drag handle */}
        <div className="component-card-drag-handle" title="Drag to reorder">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="5" cy="4" r="1.5" fill="currentColor" />
            <circle cx="11" cy="4" r="1.5" fill="currentColor" />
            <circle cx="5" cy="8" r="1.5" fill="currentColor" />
            <circle cx="11" cy="8" r="1.5" fill="currentColor" />
            <circle cx="5" cy="12" r="1.5" fill="currentColor" />
            <circle cx="11" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </div>

        {/* Expand/collapse toggle */}
        <button 
          className="component-card-expand" 
          onClick={onToggleExpand}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 16 16" 
            fill="none"
            className={isExpanded ? 'component-card-chevron-expanded' : ''}
          >
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="component-card-title" onClick={onToggleExpand}>
          <span className="component-card-name">{componentName}</span>
          {gridWidth !== undefined && gridWidth > 0 && (
            <span className="component-card-meta">{gridWidth} col</span>
          )}
        </div>

        <div className="component-card-actions">
          {onMoveToRoot && (
            <button
              className="component-card-action"
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
            className="component-card-action"
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={index === 0}
            title="Move up"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 4l4 5H4l4-5z" fill="currentColor" />
            </svg>
          </button>
          <button
            className="component-card-action"
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={index === totalCount - 1}
            title="Move down"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 12l4-5H4l4 5z" fill="currentColor" />
            </svg>
          </button>
          <button
            className="component-card-action component-card-action-delete"
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
        <div className="component-card-body">
          <div className="component-card-content-wrapper">
            <div className="component-card-content">
              {orderedGroups.map(({ name, properties }) => (
                <div key={name} className="component-property-group">
                  {orderedGroups.length > 1 && (
                    <div className="component-group-label">{name}</div>
                  )}
                  {properties.map(([key, descriptor]) => (
                    <PropertyEditor
                      key={key}
                      name={key}
                      descriptor={descriptor}
                      value={(component.props as Record<string, unknown>)[key]}
                      onChange={(value) => onUpdateProp(key, value)}
                      assets={assets}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Render children for containers */}
      {children}
    </div>
  );
}

export function ComponentList({ context }: InspectorSectionProps) {
  const { deck, selectedSlide, selection, onUpdate, onDeleteComponent, onReorderComponent, onReorderComponents, onMoveComponentToContainer } = context;
  const assets = deck.assets ?? {};
  const { selectComponent } = useSelection();
  const { expandedComponentId, setExpandedComponentId } = useInspectorExpansion();
  
  // Drag and drop state - track by component ID
  const [draggedComponentId, setDraggedComponentId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null); // container ID or null for top-level
  
  // Refs for scrolling to expanded component
  const componentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Track previous selection to detect canvas-driven changes
  const prevSelectionRef = useRef<string | null>(null);

  // Derived values (safe to compute even when no slide selected)
  const slideId = selection.slideId ?? '';
  const components = selectedSlide?.components ?? [];
  
  // Get the dragged component
  const draggedComponent = draggedComponentId 
    ? components.find(c => c.id === draggedComponentId) 
    : null;
  
  // Auto-expand and scroll when a component is selected on the canvas
  useEffect(() => {
    if (!selectedSlide || !selection.slideId) return;
    
    const prevSelection = prevSelectionRef.current;
    prevSelectionRef.current = selection.componentId;
    
    if (selection.componentId && selection.componentId !== prevSelection) {
      setExpandedComponentId(selection.componentId);
      setTimeout(() => {
        const ref = componentRefs.current.get(selection.componentId!);
        if (ref) {
          ref.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  }, [selection.componentId, selection.slideId, selectedSlide, setExpandedComponentId]);

  const toggleExpanded = useCallback((componentId: string) => {
    if (expandedComponentId === componentId) {
      setExpandedComponentId(null);
    } else {
      setExpandedComponentId(componentId);
      if (slideId) selectComponent(slideId, componentId);
    }
  }, [expandedComponentId, setExpandedComponentId, slideId, selectComponent]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, componentId: string) => {
    e.stopPropagation(); // Prevent parent containers from capturing the drag
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
    
    // Check if this is a valid drop target
    const isSibling = draggedComponent?.parentId === targetComponent.parentId;
    const isContainer = targetComponent.type === 'deck-container';
    const canDropIntoContainer = isContainer && 
      draggedComponent?.type !== 'deck-container';
    
    if (isSibling || canDropIntoContainer) {
      e.dataTransfer.dropEffect = 'move';
      setDropTargetId(targetComponentId);
    }
  }, [draggedComponentId, draggedComponent, components]);

  const handleDrop = useCallback((e: React.DragEvent, targetComponentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedComponentId || !slideId) return;
    
    const targetComponent = components.find(c => c.id === targetComponentId);
    if (!targetComponent) return;
    
    const isSibling = draggedComponent?.parentId === targetComponent.parentId;
    const isContainer = targetComponent.type === 'deck-container';
    const canDropIntoContainer = isContainer && draggedComponent?.type !== 'deck-container';
    
    // Prioritize dropping into containers over sibling reordering
    if (canDropIntoContainer) {
      // Move into container
      onMoveComponentToContainer?.(slideId, draggedComponentId, targetComponentId);
    } else if (isSibling) {
      // Reorder among siblings - swap positions in the array
      const draggedIndex = components.findIndex(c => c.id === draggedComponentId);
      const targetIndex = components.findIndex(c => c.id === targetComponentId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newComponents = [...components];
        // Remove dragged component and insert at target position
        const [removed] = newComponents.splice(draggedIndex, 1);
        newComponents.splice(targetIndex, 0, removed);
        
        // Update via context
        onReorderComponents?.(slideId, newComponents);
      }
    }
    
    setDraggedComponentId(null);
    setDropTargetId(null);
  }, [draggedComponentId, draggedComponent, slideId, components, onMoveComponentToContainer, onReorderComponents]);

  const handleDragEnd = useCallback(() => {
    setDraggedComponentId(null);
    setDropTargetId(null);
  }, []);

  // Get top-level components (no parentId)
  const topLevelComponents = useMemo(() => {
    return components.filter(c => !c.parentId);
  }, [components]);

  // Get children of a container
  const getChildComponents = useCallback((parentId: string) => {
    return components.filter(c => c.parentId === parentId);
  }, [components]);

  // Recursive render function for components
  const renderComponentCard = useCallback((component: Component, depth: number = 0) => {
    const originalIndex = components.findIndex(c => c.id === component.id);
    const isDragging = draggedComponentId === component.id;
    const isContainer = component.type === 'deck-container';
    const childComponents = isContainer ? getChildComponents(component.id) : [];
    const siblingCount = depth === 0 
      ? topLevelComponents.length 
      : components.filter(c => c.parentId === component.parentId).length;
    
    // Is this component a valid drop target?
    const isValidDropTarget = isContainer && 
      draggedComponentId !== null && 
      draggedComponentId !== component.id &&
      draggedComponent?.type !== 'deck-container';
    const isDropTarget = dropTargetId === component.id;

    return (
      <div
        key={component.id}
        ref={(el) => {
          if (el) {
            componentRefs.current.set(component.id, el);
          } else {
            componentRefs.current.delete(component.id);
          }
        }}
      >
        <ComponentCard
          component={component}
          slideId={slideId}
          index={originalIndex}
          totalCount={siblingCount}
          isExpanded={expandedComponentId === component.id}
          assets={assets}
          onToggleExpand={() => toggleExpanded(component.id)}
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
          isDragOver={isValidDropTarget}
          isDragging={isDragging}
          depth={depth}
          isDropTarget={isDropTarget}
        >
          {/* Render children for containers */}
          {childComponents.length > 0 && (
            <div className="component-card-children">
              {childComponents.map(child => renderComponentCard(child, depth + 1))}
            </div>
          )}
        </ComponentCard>
      </div>
    );
  }, [
    components, draggedComponentId, draggedComponent, dropTargetId, slideId, expandedComponentId, assets,
    toggleExpanded, onDeleteComponent, onReorderComponent, onMoveComponentToContainer, onUpdate,
    handleDragStart, handleDragOver, handleDrop, handleDragEnd, getChildComponents, topLevelComponents
  ]);

  // Early returns AFTER all hooks
  if (!selectedSlide || !selection.slideId) return null;

  if (components.length === 0) {
    return (
      <div className="inspector-section">
        <div className="inspector-section-header">Components</div>
        <div className="inspector-section-content">
          <div className="component-list-empty">
            No components yet. Click "Add Component" below to get started.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">Components</div>
      <div className="inspector-section-content component-list">
        {topLevelComponents.map((component) => renderComponentCard(component, 0))}
      </div>
    </div>
  );
}
