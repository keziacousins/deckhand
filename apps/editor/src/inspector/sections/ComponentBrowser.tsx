import { useMemo } from 'react';
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
    <div className="component-browser-overlay" onClick={onClose}>
      <div className="component-browser" onClick={(e) => e.stopPropagation()}>
        <div className="component-browser-header">
          <div className="component-browser-title">Add Component</div>
          <button className="component-browser-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="component-browser-content">
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
        </div>
      </div>
    </div>
  );
}
