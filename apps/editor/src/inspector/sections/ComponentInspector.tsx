/**
 * ComponentInspector - Auto-generates property editors from component metadata.
 * 
 * This replaces hand-coded component sections (like TitlePropertiesSection)
 * with a generic inspector that reads metadata from the component registry.
 */

import { useMemo } from 'react';
import type { InspectorSectionProps } from '../types';
import type { Component } from '@deckhand/schema';
import { registry } from '@deckhand/components';
import type { PropertyDescriptor } from '@deckhand/components';
import { PropertyEditor } from '../fields';
import { PropertyGroups } from '@deckhand/components';

export function ComponentInspector({ context }: InspectorSectionProps) {
  const { deck, selectedComponent, onUpdate, selection } = context;
  const assets = deck.assets ?? {};
  
  if (!selectedComponent || !selection.slideId || !selection.componentId) {
    return null;
  }

  const { slideId, componentId } = selection;
  const meta = registry.getMeta(selectedComponent.type);

  if (!meta) {
    return (
      <div className="inspector-section">
        <div className="inspector-section-header">Component</div>
        <div className="inspector-section-content">
          <div className="inspector-empty">
            Unknown component type: {selectedComponent.type}
          </div>
        </div>
      </div>
    );
  }

  const updateProp = (field: string, value: unknown) => {
    onUpdate({ type: 'component', slideId, componentId, field, value });
  };

  // Group properties by their group field
  const groupedProperties = useMemo(() => {
    const groups: Record<string, Array<[string, PropertyDescriptor]>> = {};
    
    for (const [key, prop] of Object.entries(meta.properties)) {
      const group = prop.group || PropertyGroups.CONTENT;
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push([key, prop]);
    }
    
    return groups;
  }, [meta.properties]);

  // Order groups: Content first, then Layout, Style, Advanced
  const groupOrder: string[] = [
    PropertyGroups.CONTENT,
    PropertyGroups.LAYOUT,
    PropertyGroups.STYLE,
    PropertyGroups.ADVANCED,
  ];

  const orderedGroups: Array<{ name: string; properties: Array<[string, PropertyDescriptor]> }> = groupOrder
    .filter((g) => groupedProperties[g]?.length > 0)
    .map((g) => ({ name: g, properties: groupedProperties[g] }));

  // Add any custom groups not in the standard order
  for (const [groupName, props] of Object.entries(groupedProperties)) {
    if (!groupOrder.includes(groupName) && props.length > 0) {
      orderedGroups.push({ name: groupName, properties: props });
    }
  }

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">{meta.name}</div>
      <div className="inspector-section-content">
        {orderedGroups.map(({ name, properties }) => (
          <div key={name} className="inspector-property-group">
            {orderedGroups.length > 1 && (
              <div className="inspector-group-label">{name}</div>
            )}
            {properties.map(([key, descriptor]) => (
              <PropertyEditor
                key={key}
                name={key}
                descriptor={descriptor}
                value={(selectedComponent.props as Record<string, unknown>)[key]}
                onChange={(value) => updateProp(key, value)}
                assets={assets}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
