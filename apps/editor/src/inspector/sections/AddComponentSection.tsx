import { useMemo } from 'react';
import type { InspectorSectionProps } from '../types';
import { registry } from '@deckhand/components';
import type { ComponentMeta, ComponentCategory } from '@deckhand/components';

const categoryLabels: Record<ComponentCategory, string> = {
  content: 'Content',
  layout: 'Layout',
  media: 'Media',
  interactive: 'Interactive',
  data: 'Data',
};

const categoryOrder: ComponentCategory[] = ['content', 'layout', 'media', 'data', 'interactive'];

interface ComponentButtonProps {
  meta: ComponentMeta;
  onClick: () => void;
  disabled?: boolean;
}

function ComponentButton({ meta, onClick, disabled }: ComponentButtonProps) {
  return (
    <button
      className="add-component-button"
      onClick={onClick}
      title={meta.description}
      disabled={disabled}
    >
      <span className="add-component-name">{meta.name}</span>
    </button>
  );
}

export function AddComponentSection({ context }: InspectorSectionProps) {
  const { selectedSlide, selectedComponent, onAddComponent } = context;
  
  if (!selectedSlide || !onAddComponent) return null;

  // Check if selected component is a container - if so, new components go inside it
  const selectedContainer = selectedComponent?.type === 'deck-container' ? selectedComponent : null;
  const parentId = selectedContainer?.id;

  const grouped = useMemo(() => {
    const allMeta = registry.getAllMeta();
    // Filter out deck-slide since it's not a content component
    const contentComponents = allMeta.filter(m => m.type !== 'deck-slide');
    
    const result: Record<ComponentCategory, ComponentMeta[]> = {
      content: [],
      layout: [],
      media: [],
      interactive: [],
      data: [],
    };
    
    for (const meta of contentComponents) {
      if (result[meta.category]) {
        result[meta.category].push(meta);
      }
    }
    
    return result;
  }, []);

  const handleAdd = (meta: ComponentMeta) => {
    // Don't allow adding containers inside containers
    if (parentId && meta.type === 'deck-container') {
      return;
    }
    onAddComponent(meta.type, parentId);
  };

  // Only show categories that have components
  const visibleCategories = categoryOrder.filter(cat => grouped[cat].length > 0);

  if (visibleCategories.length === 0) {
    return null;
  }

  const headerText = selectedContainer 
    ? `Add to Container` 
    : 'Add Component';

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">{headerText}</div>
      {selectedContainer && (
        <div className="add-component-context">
          Adding inside: Container ({(selectedContainer.props as Record<string, unknown>).gridWidth} col)
        </div>
      )}
      <div className="inspector-section-content add-component-section">
        {visibleCategories.map(category => (
          <div key={category} className="add-component-category">
            <div className="add-component-category-label">{categoryLabels[category]}</div>
            <div className="add-component-grid">
              {grouped[category].map(meta => (
                <ComponentButton
                  key={meta.type}
                  meta={meta}
                  onClick={() => handleAdd(meta)}
                  disabled={parentId !== undefined && meta.type === 'deck-container'}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
