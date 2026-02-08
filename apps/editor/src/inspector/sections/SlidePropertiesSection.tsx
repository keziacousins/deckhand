import { useMemo } from 'react';
import type { InspectorSectionProps } from '../types';
import { DEFAULT_GRID_COLUMNS } from '@deckhand/schema';
import { TextField, NumberField, CheckboxField, SelectField } from '../fields';
import { Section } from '../components/Section';

const SECTION_ID = 'slide-properties';

export function SlidePropertiesSection({ context, stickyIndex = 0 }: InspectorSectionProps) {
  const { deck, selectedSlide, onUpdate, selection } = context;
  if (!selectedSlide || !selection.slideId) return null;

  const slideId = selection.slideId;
  const hasCustomGrid = selectedSlide.gridColumns !== undefined;
  const effectiveGridColumns = selectedSlide.gridColumns ?? deck.gridColumns ?? DEFAULT_GRID_COLUMNS;

  // Build backdrop slide options (all slides except the current one)
  const backdropOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    
    if (deck.defaultBackdropSlideId && deck.defaultBackdropSlideId !== slideId) {
      const defaultSlide = deck.slides[deck.defaultBackdropSlideId];
      options.push({ 
        value: '', 
        label: `Use default (${defaultSlide?.title || 'Untitled'})` 
      });
    } else {
      options.push({ value: '', label: 'Use default (none)' });
    }
    
    options.push({ value: '__none__', label: 'None (override)' });
    
    Object.values(deck.slides)
      .filter(s => s.id !== slideId)
      .forEach(s => {
        options.push({ value: s.id, label: s.title || 'Untitled' });
      });
    
    return options;
  }, [deck.slides, deck.defaultBackdropSlideId, slideId]);

  const currentBackdropValue = selectedSlide.style?.backdropSlideId ?? '';

  return (
    <Section id={SECTION_ID} name="Slide" stickyIndex={stickyIndex}>
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
      <SelectField
        label="Backdrop Slide"
        value={currentBackdropValue}
        options={backdropOptions}
        onChange={(value) => {
          const newValue = value === '' ? undefined : value;
          onUpdate({ 
            type: 'slide', 
            slideId, 
            field: 'style', 
            value: { backdropSlideId: newValue } 
          });
        }}
      />
      <CheckboxField
        label="Override grid columns"
        value={hasCustomGrid}
        onChange={(value) => {
          if (value) {
            onUpdate({ type: 'slide', slideId, field: 'gridColumns', value: deck.gridColumns ?? DEFAULT_GRID_COLUMNS });
          } else {
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
    </Section>
  );
}
