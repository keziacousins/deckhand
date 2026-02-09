import { useMemo } from 'react';
import { registry } from '@deckhand/components';
import type { ComponentMeta, ComponentCategory } from '@deckhand/components';
import { Modal } from '../../components/Modal';

const categoryLabels: Record<ComponentCategory, string> = {
  content: 'Content',
  layout: 'Layout',
  media: 'Media',
  interactive: 'Interactive',
  data: 'Data',
};

const categoryOrder: ComponentCategory[] = ['content', 'layout', 'media', 'data', 'interactive'];

interface ComponentBrowserProps {
  onSelect: (componentType: string) => void;
  onClose: () => void;
}

export function ComponentBrowser({ onSelect, onClose }: ComponentBrowserProps) {
  const grouped = useMemo(() => {
    const allMeta = registry.getAllMeta();
    // Filter out deck-slide since it's not a content component
    const contentComponents = allMeta.filter((m) => m.type !== 'deck-slide');

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

  // Only show categories that have components
  const visibleCategories = categoryOrder.filter((cat) => grouped[cat].length > 0);

  return (
    <Modal title="Add Component" onClose={onClose}>
      {visibleCategories.map((category) => (
        <div key={category} className="component-browser-category">
          <div className="component-browser-category-label">{categoryLabels[category]}</div>
          <div className="component-browser-list">
            {grouped[category].map((meta) => (
              <button
                key={meta.type}
                className="component-browser-item"
                onClick={() => onSelect(meta.type)}
                title={meta.description}
              >
                <span className="component-browser-item-name">{meta.name}</span>
                {meta.description && (
                  <span className="component-browser-item-desc">{meta.description}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}
