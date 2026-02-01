import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { InspectorSectionProps } from '../types';
import type { Component } from '@deckhand/schema';
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
  onToggleExpand: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateProp: (field: string, value: unknown) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
  isDragging: boolean;
}

function ComponentCard({
  component,
  index,
  totalCount,
  isExpanded,
  onToggleExpand,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUpdateProp,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragOver,
  isDragging,
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

  return (
    <div 
      className={`component-card ${isExpanded ? 'component-card-expanded' : ''} ${isDragging ? 'component-card-dragging' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
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
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ComponentList({ context }: InspectorSectionProps) {
  const { selectedSlide, selection, onUpdate, onDeleteComponent, onReorderComponent } = context;
  const { selectComponent } = useSelection();
  const { expandedComponentId, setExpandedComponentId } = useInspectorExpansion();
  
  // Drag and drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Refs for scrolling to expanded component
  const componentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Track previous selection to detect canvas-driven changes
  const prevSelectionRef = useRef<string | null>(null);

  // Derived values (safe to compute even when no slide selected)
  const slideId = selection.slideId ?? '';
  const components = selectedSlide?.components ?? [];
  
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

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    setTimeout(() => {
      (e.target as HTMLElement).classList.add('component-card-dragging');
    }, 0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, displayIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== null && dragOverIndex !== displayIndex) {
      setDragOverIndex(displayIndex);
    }
  }, [dragIndex, dragOverIndex]);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const component = components[dragIndex];
      if (component && slideId) {
        const diff = dragOverIndex - dragIndex;
        if (diff > 0) {
          for (let i = 0; i < diff; i++) {
            onReorderComponent?.(slideId, component.id, 'down');
          }
        } else {
          for (let i = 0; i < Math.abs(diff); i++) {
            onReorderComponent?.(slideId, component.id, 'up');
          }
        }
      }
    }
    setDragIndex(null);
    setDragOverIndex(null);
    document.querySelectorAll('.component-card-dragging').forEach((el) => {
      el.classList.remove('component-card-dragging');
    });
  }, [dragIndex, dragOverIndex, components, slideId, onReorderComponent]);

  // Compute the display order during drag
  const displayComponents = useMemo(() => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      return components;
    }
    const result = [...components];
    const [draggedItem] = result.splice(dragIndex, 1);
    result.splice(dragOverIndex, 0, draggedItem);
    return result;
  }, [components, dragIndex, dragOverIndex]);

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
        {displayComponents.map((component, displayIndex) => {
          // Find the original index for this component
          const originalIndex = components.findIndex(c => c.id === component.id);
          const isDragging = originalIndex === dragIndex;
          
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
                totalCount={components.length}
                isExpanded={expandedComponentId === component.id}
                onToggleExpand={() => toggleExpanded(component.id)}
                onDelete={() => onDeleteComponent?.(slideId, component.id)}
                onMoveUp={() => onReorderComponent?.(slideId, component.id, 'up')}
                onMoveDown={() => onReorderComponent?.(slideId, component.id, 'down')}
                onUpdateProp={(field, value) =>
                  onUpdate({ type: 'component', slideId, componentId: component.id, field, value })
                }
                onDragStart={handleDragStart}
                onDragOver={(e) => handleDragOver(e, displayIndex)}
                onDragEnd={handleDragEnd}
                isDragOver={false}
                isDragging={isDragging}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
