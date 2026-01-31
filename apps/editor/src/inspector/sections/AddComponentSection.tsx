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
}

function ComponentButton({ meta, onClick }: ComponentButtonProps) {
  return (
    <button
      className="add-component-button"
      onClick={onClick}
      title={meta.description}
    >
      <span className="add-component-name">{meta.name}</span>
    </button>
  );
}

export function AddComponentSection({ context }: InspectorSectionProps) {
  const { selectedSlide, onAddComponent } = context;
  
  if (!selectedSlide || !onAddComponent) return null;

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
    onAddComponent(meta.type);
  };

  // Only show categories that have components
  const visibleCategories = categoryOrder.filter(cat => grouped[cat].length > 0);

  if (visibleCategories.length === 0) {
    return null;
  }

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">Add Component</div>
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
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
