import { useMemo } from 'react';
import type { InspectorSectionProps } from '../types';
import type { AspectRatio } from '@deckhand/schema';
import { DEFAULT_GRID_COLUMNS } from '@deckhand/schema';
import { TextField, SelectField, NumberField } from '../fields';

const aspectRatioOptions = [
  { value: '16:9', label: '16:9 (Widescreen)' },
  { value: '4:3', label: '4:3 (Standard)' },
  { value: '16:10', label: '16:10' },
];

export function DeckPropertiesSection({ context }: InspectorSectionProps) {
  const { deck, onUpdate } = context;

  // Build backdrop slide options
  const backdropOptions = useMemo(() => {
    const options = [{ value: '', label: 'None' }];
    
    Object.values(deck.slides).forEach(s => {
      options.push({ value: s.id, label: s.title || 'Untitled' });
    });
    
    return options;
  }, [deck.slides]);

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">Deck Properties</div>
      <div className="inspector-section-content">
        <TextField
          label="Title"
          value={deck.meta.title}
          onChange={(value) => onUpdate({ type: 'deck', field: 'title', value })}
        />
        <TextField
          label="Description"
          value={deck.meta.description ?? ''}
          onChange={(value) => onUpdate({ type: 'deck', field: 'description', value })}
          multiline
          placeholder="Add a description..."
        />
        <SelectField
          label="Aspect Ratio"
          value={deck.aspectRatio}
          options={aspectRatioOptions}
          onChange={(value) => onUpdate({ type: 'deck', field: 'aspectRatio', value: value as AspectRatio })}
        />
        <NumberField
          label="Grid Columns"
          value={deck.gridColumns ?? DEFAULT_GRID_COLUMNS}
          onChange={(value) => onUpdate({ type: 'deck', field: 'gridColumns', value })}
          min={1}
          max={12}
          step={1}
        />
        <SelectField
          label="Default Backdrop"
          value={deck.defaultBackdropSlideId ?? ''}
          options={backdropOptions}
          onChange={(value) => onUpdate({ type: 'deck', field: 'defaultBackdropSlideId', value: value || undefined })}
        />
      </div>
    </div>
  );
}
