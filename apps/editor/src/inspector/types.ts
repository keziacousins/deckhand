import type { Deck, Slide, Component, AspectRatio } from '@deckhand/schema';
import type { Selection } from '../selection';

export type InspectorTab = 'selection' | 'theme' | 'assets' | 'chat';

export interface InspectorContext {
  deck: Deck;
  selection: Selection;
  selectedSlide: Slide | null;
  selectedComponent: Component | null;
  onUpdate: (update: InspectorUpdate) => void;
  onAddComponent?: (componentType: string, parentId?: string) => void;
  onDeleteComponent?: (slideId: string, componentId: string) => void;
  onReorderComponent?: (slideId: string, componentId: string, direction: 'up' | 'down') => void;
  onReorderComponents?: (slideId: string, components: Component[]) => void;
  onMoveComponentToContainer?: (slideId: string, componentId: string, newParentId: string | null) => void;
}

export type InspectorUpdate =
  | { type: 'slide'; slideId: string; field: 'title' | 'notes'; value: string }
  | { type: 'slide'; slideId: string; field: 'gridColumns'; value: number | undefined }
  | { type: 'slide'; slideId: string; field: 'style'; value: Record<string, string | number | boolean | undefined> }
  | { type: 'component'; slideId: string; componentId: string; field: string; value: unknown }
  | { type: 'deck'; field: 'title' | 'description'; value: string }
  | { type: 'deck'; field: 'aspectRatio'; value: AspectRatio }
  | { type: 'deck'; field: 'gridColumns'; value: number }
  | { type: 'deck'; field: 'defaultBackdropSlideId'; value: string | undefined }
  | { type: 'deck'; field: 'assets'; value: Record<string, unknown> }
  | { type: 'addAsset'; asset: unknown }
  | { type: 'theme'; field: string; value: string | number | undefined };

export interface InspectorSectionProps {
  context: InspectorContext;
}

export interface InspectorSectionConfig {
  id: string;
  label: string;
  isVisible: (context: InspectorContext) => boolean;
  component: React.ComponentType<InspectorSectionProps>;
}
