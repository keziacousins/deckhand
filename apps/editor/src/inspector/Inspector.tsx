import { useState, useMemo, useCallback } from 'react';
import type { Deck, Component, AspectRatio } from '@deckhand/schema';
import { useSelection } from '../selection';
import { registry } from '@deckhand/components';
import type { InspectorContext, InspectorUpdate, InspectorTab } from './types';
import { SlidePropertiesSection } from './sections/SlidePropertiesSection';
import { DeckPropertiesSection } from './sections/DeckPropertiesSection';
import { ComponentList } from './sections/ComponentList';
import { ComponentBrowser } from './sections/ComponentBrowser';
import './Inspector.css';

// Generate a simple unique ID
function generateId(): string {
  return `comp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface InspectorProps {
  visible: boolean;
  onClose: () => void;
  deck: Deck;
  onUpdateDeck: (updater: (deck: Deck) => Deck) => void;
  showGrid?: boolean;
  onToggleShowGrid?: () => void;
}

export function Inspector({ visible, onClose, deck, onUpdateDeck, showGrid, onToggleShowGrid }: InspectorProps) {
  const { selection, selectComponent, clearSelection } = useSelection();
  const [activeTab, setActiveTab] = useState<InspectorTab>('slide');
  const [showComponentBrowser, setShowComponentBrowser] = useState(false);

  const handleUpdate = useCallback(
    (update: InspectorUpdate) => {
      onUpdateDeck((d) => {
        if (update.type === 'slide') {
          const slide = d.slides[update.slideId];
          if (!slide) return d;
          
          // Handle gridColumns specially - undefined means "use deck default"
          if (update.field === 'gridColumns') {
            const newSlide = { ...slide };
            if (update.value === undefined) {
              delete newSlide.gridColumns;
            } else {
              newSlide.gridColumns = update.value as number;
            }
            return {
              ...d,
              slides: {
                ...d.slides,
                [update.slideId]: newSlide,
              },
            };
          }
          
          return {
            ...d,
            slides: {
              ...d.slides,
              [update.slideId]: {
                ...slide,
                [update.field]: update.value,
              },
            },
          };
        }

        if (update.type === 'component') {
          const slide = d.slides[update.slideId];
          if (!slide) return d;
          return {
            ...d,
            slides: {
              ...d.slides,
              [update.slideId]: {
                ...slide,
                components: slide.components.map((c) => {
                  if (c.id !== update.componentId) return c;
                  return {
                    ...c,
                    props: { ...c.props, [update.field]: update.value },
                  } as typeof c;
                }),
              },
            },
          };
        }

        if (update.type === 'deck') {
          if (update.field === 'title' || update.field === 'description') {
            return {
              ...d,
              meta: {
                ...d.meta,
                [update.field]: update.value,
              },
            };
          }
          if (update.field === 'aspectRatio') {
            return {
              ...d,
              aspectRatio: update.value as AspectRatio,
            };
          }
          if (update.field === 'gridColumns') {
            return {
              ...d,
              gridColumns: update.value as number,
            };
          }
        }

        return d;
      });
    },
    [onUpdateDeck]
  );

  const handleAddComponent = useCallback(
    (componentType: string) => {
      const slideId = selection.slideId;
      if (!slideId) return;

      const meta = registry.getMeta(componentType);
      if (!meta) {
        console.warn(`Unknown component type: ${componentType}`);
        return;
      }

      // Build props from metadata defaults and preview sample props
      const props: Record<string, unknown> = {};
      for (const [key, descriptor] of Object.entries(meta.properties)) {
        const sampleValue = meta.preview?.sampleProps?.[key];
        if (sampleValue !== undefined) {
          props[key] = sampleValue;
        } else if (descriptor.default !== undefined) {
          props[key] = descriptor.default;
        } else if (descriptor.required) {
          props[key] = descriptor.type === 'string' ? '' : null;
        }
      }

      const newComponent = {
        id: generateId(),
        type: componentType,
        props,
      } as Component;

      onUpdateDeck((d) => {
        const slide = d.slides[slideId];
        if (!slide) return d;

        return {
          ...d,
          slides: {
            ...d.slides,
            [slideId]: {
              ...slide,
              components: [...slide.components, newComponent],
            },
          },
        };
      });

      // Select the newly added component and close browser
      selectComponent(slideId, newComponent.id);
      setShowComponentBrowser(false);
    },
    [selection.slideId, onUpdateDeck, selectComponent]
  );

  const handleDeleteComponent = useCallback(
    (slideId: string, componentId: string) => {
      onUpdateDeck((d) => {
        const slide = d.slides[slideId];
        if (!slide) return d;

        return {
          ...d,
          slides: {
            ...d.slides,
            [slideId]: {
              ...slide,
              components: slide.components.filter((c) => c.id !== componentId),
            },
          },
        };
      });

      // Clear selection if we deleted the selected component
      if (selection.componentId === componentId) {
        clearSelection();
      }
    },
    [onUpdateDeck, selection.componentId, clearSelection]
  );

  const handleReorderComponent = useCallback(
    (slideId: string, componentId: string, direction: 'up' | 'down') => {
      onUpdateDeck((d) => {
        const slide = d.slides[slideId];
        if (!slide) return d;

        const components = [...slide.components];
        const index = components.findIndex((c) => c.id === componentId);
        if (index === -1) return d;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= components.length) return d;

        // Swap
        [components[index], components[newIndex]] = [components[newIndex], components[index]];

        return {
          ...d,
          slides: {
            ...d.slides,
            [slideId]: {
              ...slide,
              components,
            },
          },
        };
      });
    },
    [onUpdateDeck]
  );

  const context: InspectorContext = useMemo(() => {
    const selectedSlide = selection.slideId ? deck.slides[selection.slideId] : null;
    const selectedComponent =
      selectedSlide && selection.componentId
        ? selectedSlide.components.find((c) => c.id === selection.componentId) ?? null
        : null;

    return {
      deck,
      selection,
      selectedSlide,
      selectedComponent,
      onUpdate: handleUpdate,
      onAddComponent: handleAddComponent,
      onDeleteComponent: handleDeleteComponent,
      onReorderComponent: handleReorderComponent,
    };
  }, [deck, selection, handleUpdate, handleAddComponent, handleDeleteComponent, handleReorderComponent]);

  const hasSlideSelected = context.selectedSlide !== null;

  return (
    <div className={`inspector ${visible ? 'inspector-visible' : ''}`}>
      <div className="inspector-header">
        <div className="inspector-tabs">
          <button
            className={`inspector-tab ${activeTab === 'slide' ? 'inspector-tab-active' : ''}`}
            onClick={() => setActiveTab('slide')}
          >
            Slide
          </button>
          <button
            className={`inspector-tab ${activeTab === 'deck' ? 'inspector-tab-active' : ''}`}
            onClick={() => setActiveTab('deck')}
          >
            Deck
          </button>
          <button
            className={`inspector-tab ${activeTab === 'json' ? 'inspector-tab-active' : ''}`}
            onClick={() => setActiveTab('json')}
          >
            JSON
          </button>
        </div>
        <button className="inspector-close" onClick={onClose} title="Close Inspector">
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

      <div className="inspector-content">
        {activeTab === 'slide' && (
          <>
            {!hasSlideSelected ? (
              <div className="inspector-empty">Select a slide to edit</div>
            ) : (
              <>
                <SlidePropertiesSection context={context} />
                <ComponentList context={context} />
              </>
            )}
          </>
        )}

        {activeTab === 'deck' && (
          <>
            <DeckPropertiesSection context={context} />
            {onToggleShowGrid && (
              <div className="inspector-section">
                <div className="inspector-section-header">Debug</div>
                <div className="inspector-section-content">
                  <div className="inspector-field inspector-field-checkbox">
                    <label className="inspector-checkbox-label">
                      <input
                        type="checkbox"
                        className="inspector-checkbox-input"
                        checked={showGrid ?? false}
                        onChange={onToggleShowGrid}
                      />
                      <span className="inspector-checkbox-text">Show Grid Overlay</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'json' && (
          <div className="inspector-json">
            <pre className="inspector-json-content">
              {JSON.stringify(deck, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Add Component Button - only show on slide tab when slide is selected */}
      {activeTab === 'slide' && hasSlideSelected && (
        <div className="inspector-footer">
          <button
            className="inspector-add-button"
            onClick={() => setShowComponentBrowser(true)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Add Component
          </button>
        </div>
      )}

      {/* Component Browser Modal */}
      {showComponentBrowser && (
        <ComponentBrowser
          onSelect={handleAddComponent}
          onClose={() => setShowComponentBrowser(false)}
        />
      )}
    </div>
  );
}
