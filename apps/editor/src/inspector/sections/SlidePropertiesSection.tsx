import { useMemo, useRef } from 'react';
import type { InspectorSectionProps } from '../types';
import { scrollHeaderToSticky } from '../types';
import { DEFAULT_GRID_COLUMNS } from '@deckhand/schema';
import { TextField, NumberField, CheckboxField, SelectField } from '../fields';
import { useInspectorExpansion } from '../context/InspectorExpansionContext';

const SECTION_ID = 'slide-properties';
const HEADER_HEIGHT = 37;

export function SlidePropertiesSection({ context, stickyIndex = 0 }: InspectorSectionProps) {
  const { deck, selectedSlide, onUpdate, selection } = context;
  const { isExpanded, expand, toggle } = useInspectorExpansion();
  const headerRef = useRef<HTMLDivElement>(null);
  if (!selectedSlide || !selection.slideId) return null;

  const slideId = selection.slideId;
  const hasCustomGrid = selectedSlide.gridColumns !== undefined;
  const effectiveGridColumns = selectedSlide.gridColumns ?? deck.gridColumns ?? DEFAULT_GRID_COLUMNS;
  const expanded = isExpanded(SECTION_ID);

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
    <>
      <div
        ref={headerRef}
        className="section-header"
        data-expanded={expanded}
        style={{ '--sticky-top': `${stickyIndex * HEADER_HEIGHT}px`, '--sticky-index': stickyIndex } as React.CSSProperties}
        onClick={() => { expand(SECTION_ID); if (headerRef.current) setTimeout(() => scrollHeaderToSticky(headerRef.current!), 250); }}
      >
        <button
          className="section-header-expand"
          onClick={(e) => { e.stopPropagation(); toggle(SECTION_ID); }}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            className={expanded ? 'section-header-chevron-expanded' : ''}
          >
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="section-header-title">
          <span className="section-header-name">Slide</span>
        </div>
      </div>

      <div className="section-body" data-expanded={expanded}>
        <div className="section-body-inner">
          <div className="section-body-overflow">
            <div className="section-body-content">
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
