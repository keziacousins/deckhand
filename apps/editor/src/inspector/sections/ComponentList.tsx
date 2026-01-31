import { useMemo } from 'react';
import type { InspectorSectionProps } from '../types';
import type { Component } from '@deckhand/schema';
import { registry } from '@deckhand/components';
import type { PropertyDescriptor } from '@deckhand/components';
import { PropertyGroups } from '@deckhand/components';
import { PropertyEditor } from '../fields';
import { useSelection } from '../../selection';

interface ComponentCardProps {
  component: Component;
  slideId: string;
  index: number;
  totalCount: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateProp: (field: string, value: unknown) => void;
}

function ComponentCard({
  component,
  index,
  totalCount,
  isSelected,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUpdateProp,
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
    <div className={`component-card ${isSelected ? 'component-card-selected' : ''}`}>
      <div className="component-card-header" onClick={onSelect}>
        <div className="component-card-title">
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

      {isSelected && meta && (
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
      )}
    </div>
  );
}

export function ComponentList({ context }: InspectorSectionProps) {
  const { selectedSlide, selection, onUpdate, onDeleteComponent, onReorderComponent } = context;
  const { selectComponent, clearSelection } = useSelection();

  if (!selectedSlide || !selection.slideId) return null;

  const slideId = selection.slideId;
  const components = selectedSlide.components;

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

  const handleSelect = (componentId: string) => {
    if (selection.componentId === componentId) {
      // Clicking selected component clears selection (collapse)
      clearSelection();
    } else {
      selectComponent(slideId, componentId);
    }
  };

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">Components</div>
      <div className="inspector-section-content component-list">
        {components.map((component, index) => (
          <ComponentCard
            key={component.id}
            component={component}
            slideId={slideId}
            index={index}
            totalCount={components.length}
            isSelected={selection.componentId === component.id}
            onSelect={() => handleSelect(component.id)}
            onDelete={() => onDeleteComponent?.(slideId, component.id)}
            onMoveUp={() => onReorderComponent?.(slideId, component.id, 'up')}
            onMoveDown={() => onReorderComponent?.(slideId, component.id, 'down')}
            onUpdateProp={(field, value) =>
              onUpdate({ type: 'component', slideId, componentId: component.id, field, value })
            }
          />
        ))}
      </div>
    </div>
  );
}
