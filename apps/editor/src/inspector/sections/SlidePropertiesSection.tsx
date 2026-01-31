import type { InspectorSectionProps } from '../types';
import { DEFAULT_GRID_COLUMNS } from '@deckhand/schema';
import { TextField, NumberField, CheckboxField } from '../fields';

export function SlidePropertiesSection({ context }: InspectorSectionProps) {
  const { deck, selectedSlide, onUpdate, selection } = context;
  if (!selectedSlide || !selection.slideId) return null;

  const slideId = selection.slideId;
  const hasCustomGrid = selectedSlide.gridColumns !== undefined;
  const effectiveGridColumns = selectedSlide.gridColumns ?? deck.gridColumns ?? DEFAULT_GRID_COLUMNS;

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">Slide</div>
      <div className="inspector-section-content">
        <TextField
          label="Title"
          value={selectedSlide.title}
          onChange={(value) => onUpdate({ type: 'slide', slideId, field: 'title', value })}
        />
        <TextField
          label="Speaker Notes"
          value={selectedSlide.notes ?? ''}
          onChange={(value) => onUpdate({ type: 'slide', slideId, field: 'notes', value })}
          multiline
          placeholder="Add speaker notes..."
        />
        <CheckboxField
          label="Override grid columns"
          value={hasCustomGrid}
          onChange={(value) => {
            if (value) {
              // Set to deck default when enabling override
              onUpdate({ type: 'slide', slideId, field: 'gridColumns', value: deck.gridColumns ?? DEFAULT_GRID_COLUMNS });
            } else {
              // Clear override to use deck default
              onUpdate({ type: 'slide', slideId, field: 'gridColumns', value: undefined });
            }
          }}
        />
        {hasCustomGrid && (
          <NumberField
            label="Grid Columns"
            value={effectiveGridColumns}
            onChange={(value) => onUpdate({ type: 'slide', slideId, field: 'gridColumns', value })}
            min={1}
            max={12}
            step={1}
          />
        )}
      </div>
    </div>
  );
}
