import type { Deck, Slide, Component, AspectRatio } from '@deckhand/schema';
import type { Selection } from '../selection';

export type InspectorTab = 'selection' | 'theme' | 'assets';

export interface InspectorContext {
  deck: Deck;
  selection: Selection;
  selectedSlide: Slide | null;
  selectedComponent: Component | null;
  onUpdate: (update: InspectorUpdate) => void;
  onAddComponent?: (componentType: string) => void;
  onDeleteComponent?: (slideId: string, componentId: string) => void;
  onReorderComponent?: (slideId: string, componentId: string, direction: 'up' | 'down') => void;
}

export type InspectorUpdate =
  | { type: 'slide'; slideId: string; field: 'title' | 'notes'; value: string }
  | { type: 'slide'; slideId: string; field: 'gridColumns'; value: number | undefined }
  | { type: 'slide'; slideId: string; field: 'style'; value: Record<string, string | number | undefined> }
  | { type: 'component'; slideId: string; componentId: string; field: string; value: unknown }
  | { type: 'deck'; field: 'title' | 'description'; value: string }
  | { type: 'deck'; field: 'aspectRatio'; value: AspectRatio }
  | { type: 'deck'; field: 'gridColumns'; value: number }
  | { type: 'deck'; field: 'assets'; value: Record<string, unknown> }
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
