import { useState, useMemo, useCallback } from 'react';
import type { Deck, Component, AspectRatio } from '@deckhand/schema';
import { useSelection } from '../selection';
import { registry } from '@deckhand/components';
import type { InspectorContext, InspectorUpdate, InspectorTab } from './types';
import { InspectorExpansionProvider } from './context/InspectorExpansionContext';
import { SlidePropertiesSection } from './sections/SlidePropertiesSection';
import { BackgroundSection } from './sections/BackgroundSection';
import { ColorsSection } from './sections/ColorsSection';
import { ComponentList } from './sections/ComponentList';
import { ComponentBrowser } from './sections/ComponentBrowser';
import { ThemeSection } from './sections/ThemeSection';
import { DeckPropertiesSection } from './sections/DeckPropertiesSection';
import { AssetsSection } from './sections/AssetsSection';
import { ChatSection } from './sections/ChatSection';
import { EdgePropertiesSection } from './sections/EdgePropertiesSection';
import { StartPointPropertiesSection } from './sections/StartPointPropertiesSection';
import { isEdgeSelected, isStartPointSelected } from '../selection';
import './Inspector.css';

// Generate a simple unique ID
function generateId(): string {
  return `comp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface InspectorProps {
  visible: boolean;
  onClose: () => void;
  deck: Deck;
  deckId: string;
  onUpdateDeck: (updater: (deck: Deck) => Deck) => void;
  showGrid?: boolean;
  onToggleShowGrid?: () => void;
}

export function Inspector({ visible, onClose, deck, deckId, onUpdateDeck, showGrid, onToggleShowGrid }: InspectorProps) {
  const { selection, selectComponent, clearSelection } = useSelection();
  const [activeTab, setActiveTab] = useState<InspectorTab>('selection');
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

          // Handle style updates - merge with existing style
          if (update.field === 'style') {
            const newStyle = { ...slide.style, ...update.value };
            // Clean up undefined values
            for (const key of Object.keys(newStyle)) {
              if (newStyle[key as keyof typeof newStyle] === undefined) {
                delete newStyle[key as keyof typeof newStyle];
              }
            }
            return {
              ...d,
              slides: {
                ...d.slides,
                [update.slideId]: {
                  ...slide,
                  style: Object.keys(newStyle).length > 0 ? newStyle : undefined,
                },
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
          if (update.field === 'assets') {
            return {
              ...d,
              assets: update.value as typeof d.assets,
            };
          }
          if (update.field === 'defaultBackdropSlideId') {
            return {
              ...d,
              defaultBackdropSlideId: update.value as string | undefined,
            };
          }
          if (update.field === 'defaultStartPointId') {
            return {
              ...d,
              defaultStartPointId: update.value as string | undefined,
            };
          }
        }

        if (update.type === 'addAsset') {
          const asset = update.asset as { id: string };
          return {
            ...d,
            assets: {
              ...d.assets,
              [asset.id]: asset,
            },
          };
        }

        if (update.type === 'theme') {
          // Handle theme name separately
          if (update.field === 'name') {
            return {
              ...d,
              theme: {
                ...d.theme,
                name: update.value as string,
              },
            };
          }
          // Handle token updates
          return {
            ...d,
            theme: {
              ...d.theme,
              tokens: {
                ...d.theme.tokens,
                [update.field]: update.value,
              },
            },
          };
        }

        return d;
      });
    },
    [onUpdateDeck]
  );

  const handleAddComponent = useCallback(
    (componentType: string, parentId?: string) => {
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
        ...(parentId && { parentId }),
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
        const component = components.find((c) => c.id === componentId);
        if (!component) return d;

        // Get siblings (components with the same parentId)
        const parentId = component.parentId;
        const siblings = components.filter((c) => c.parentId === parentId);
        const siblingIndex = siblings.findIndex((c) => c.id === componentId);
        
        const newSiblingIndex = direction === 'up' ? siblingIndex - 1 : siblingIndex + 1;
        if (newSiblingIndex < 0 || newSiblingIndex >= siblings.length) return d;

        // Find the actual indices in the full array
        const targetSibling = siblings[newSiblingIndex];
        const currentIndex = components.findIndex((c) => c.id === componentId);
        const targetIndex = components.findIndex((c) => c.id === targetSibling.id);

        // Swap in the full array
        [components[currentIndex], components[targetIndex]] = [components[targetIndex], components[currentIndex]];

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

  const handleReorderComponents = useCallback(
    (slideId: string, components: Component[]) => {
      onUpdateDeck((d) => {
        const slide = d.slides[slideId];
        if (!slide) return d;

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

  const handleMoveComponentToContainer = useCallback(
    (slideId: string, componentId: string, newParentId: string | null) => {
      onUpdateDeck((d) => {
        const slide = d.slides[slideId];
        if (!slide) return d;

        const components = slide.components.map((c) => {
          if (c.id === componentId) {
            if (newParentId === null) {
              // Move to root - remove parentId
              const { parentId, ...rest } = c;
              return rest as Component;
            }
            return { ...c, parentId: newParentId };
          }
          return c;
        });

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

  const handleUpdateEdge = useCallback(
    (edgeId: string, updates: Partial<{ transition: string; transitionDuration: number }>) => {
      onUpdateDeck((d) => {
        const edge = d.flow.edges[edgeId];
        if (!edge) return d;

        const newEdge = { ...edge };
        
        // Handle transition update
        if ('transition' in updates) {
          if (updates.transition === undefined) {
            delete newEdge.transition;
          } else {
            newEdge.transition = updates.transition as typeof edge.transition;
          }
        }
        
        // Handle transitionDuration update
        if ('transitionDuration' in updates) {
          if (updates.transitionDuration === undefined) {
            delete newEdge.transitionDuration;
          } else {
            newEdge.transitionDuration = updates.transitionDuration;
          }
        }

        return {
          ...d,
          flow: {
            ...d.flow,
            edges: {
              ...d.flow.edges,
              [edgeId]: newEdge,
            },
          },
        };
      });
    },
    [onUpdateDeck]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      onUpdateDeck((d) => {
        const { [edgeId]: _, ...remainingEdges } = d.flow.edges;
        return {
          ...d,
          flow: {
            ...d.flow,
            edges: remainingEdges,
          },
        };
      });
      // Clear selection if we deleted the selected edge
      if (selection.edgeId === edgeId) {
        clearSelection();
      }
    },
    [onUpdateDeck, selection.edgeId, clearSelection]
  );

  const handleUpdateStartPoint = useCallback(
    (startPointId: string, updates: Partial<{ name: string }>) => {
      onUpdateDeck((d) => {
        const startPoints = d.flow.startPoints;
        if (!startPoints || !startPoints[startPointId]) return d;

        return {
          ...d,
          flow: {
            ...d.flow,
            startPoints: {
              ...startPoints,
              [startPointId]: {
                ...startPoints[startPointId],
                ...updates,
              },
            },
          },
        };
      });
    },
    [onUpdateDeck]
  );

  const handleDeleteStartPoint = useCallback(
    (startPointId: string) => {
      onUpdateDeck((d) => {
        const startPoints = d.flow.startPoints;
        if (!startPoints) return d;

        const { [startPointId]: _, ...remainingStartPoints } = startPoints;
        
        // Also delete any edges from this start point
        const remainingEdges = Object.fromEntries(
          Object.entries(d.flow.edges).filter(([, edge]) => edge.from !== startPointId)
        );

        return {
          ...d,
          flow: {
            ...d.flow,
            startPoints: Object.keys(remainingStartPoints).length > 0 ? remainingStartPoints : undefined,
            edges: remainingEdges,
          },
        };
      });
      // Clear selection if we deleted the selected start point
      if (selection.startPointId === startPointId) {
        clearSelection();
      }
    },
    [onUpdateDeck, selection.startPointId, clearSelection]
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
      onReorderComponents: handleReorderComponents,
      onMoveComponentToContainer: handleMoveComponentToContainer,
    };
  }, [deck, selection, handleUpdate, handleAddComponent, handleDeleteComponent, handleReorderComponent, handleReorderComponents, handleMoveComponentToContainer]);

  const hasSlideSelected = context.selectedSlide !== null;
  const selectedEdge = isEdgeSelected(selection) ? deck.flow.edges[selection.edgeId] : null;
  const selectedStartPoint = isStartPointSelected(selection) && deck.flow.startPoints 
    ? deck.flow.startPoints[selection.startPointId] 
    : null;

  return (
    <InspectorExpansionProvider>
      <div className={`inspector ${visible ? 'inspector-visible' : ''}`}>
        <div className="inspector-header">
          <div className="inspector-tabs">
            <button
              className={`inspector-tab ${activeTab === 'selection' ? 'inspector-tab-active' : ''}`}
              onClick={() => setActiveTab('selection')}
            >
              Selection
            </button>
            <button
              className={`inspector-tab ${activeTab === 'theme' ? 'inspector-tab-active' : ''}`}
              onClick={() => setActiveTab('theme')}
            >
              Deck
            </button>
            <button
              className={`inspector-tab ${activeTab === 'assets' ? 'inspector-tab-active' : ''}`}
              onClick={() => setActiveTab('assets')}
            >
              Assets
            </button>
            <button
              className={`inspector-tab ${activeTab === 'chat' ? 'inspector-tab-active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              Chat
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
          {activeTab === 'selection' && (
            <>
              {selectedEdge ? (
                <EdgePropertiesSection
                  edge={selectedEdge}
                  deckDefaultTransition={deck.flow.defaultTransition}
                  deckDefaultDuration={deck.flow.defaultTransitionDuration}
                  onUpdateEdge={handleUpdateEdge}
                  onDeleteEdge={handleDeleteEdge}
                />
              ) : selectedStartPoint ? (
                <StartPointPropertiesSection
                  startPoint={selectedStartPoint}
                  onUpdateStartPoint={handleUpdateStartPoint}
                  onDeleteStartPoint={handleDeleteStartPoint}
                />
              ) : !hasSlideSelected ? (
                <div className="inspector-empty">Select an object to edit</div>
              ) : (
                <>
                  <SlidePropertiesSection context={context} stickyIndex={0} />
                  <BackgroundSection context={context} stickyIndex={1} />
                  <ColorsSection context={context} stickyIndex={2} />
                  <ComponentList context={context} stickyIndex={3} />
                </>
              )}
            </>
          )}

          {activeTab === 'theme' && (
            <>
              <DeckPropertiesSection context={context} stickyIndex={0} />
              <ThemeSection context={context} stickyIndex={1} />
              {onToggleShowGrid && (
                <div className="section-header" style={{ '--sticky-top': `${6 * 37}px`, '--sticky-index': 6 } as React.CSSProperties}>
                  <label className="inspector-checkbox-label" style={{ flex: 1 }}>
                    <input
                      type="checkbox"
                      className="inspector-checkbox-input"
                      checked={showGrid ?? false}
                      onChange={onToggleShowGrid}
                    />
                    <span className="inspector-checkbox-text">Show Grid Overlay</span>
                  </label>
                </div>
              )}
            </>
          )}

          {activeTab === 'assets' && (
            <AssetsSection context={context} stickyIndex={0} />
          )}

          {activeTab === 'chat' && (
            <ChatSection context={context} deckId={deckId} />
          )}
        </div>

        {/* Add Component Button - only show on selection tab when slide is selected */}
        {activeTab === 'selection' && hasSlideSelected && !selectedEdge && !selectedStartPoint && (
          <button
            className="inspector-add-component"
            onClick={() => setShowComponentBrowser(true)}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span>Add Component</span>
          </button>
        )}

        {/* Component Browser Modal */}
        {showComponentBrowser && (
          <ComponentBrowser
            onSelect={handleAddComponent}
            onClose={() => setShowComponentBrowser(false)}
          />
        )}
      </div>
    </InspectorExpansionProvider>
  );
}
