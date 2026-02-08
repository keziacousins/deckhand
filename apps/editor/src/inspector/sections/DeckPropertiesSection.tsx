import { useMemo, useRef } from 'react';
import type { InspectorSectionProps } from '../types';
import { scrollHeaderToSticky } from '../types';
import type { AspectRatio } from '@deckhand/schema';
import { DEFAULT_GRID_COLUMNS } from '@deckhand/schema';
import { TextField, SelectField, NumberField } from '../fields';
import { useInspectorExpansion } from '../context/InspectorExpansionContext';

const SECTION_ID = 'deck-properties';
const HEADER_HEIGHT = 37;

const aspectRatioOptions = [
  { value: '16:9', label: '16:9 (Widescreen)' },
  { value: '4:3', label: '4:3 (Standard)' },
  { value: '16:10', label: '16:10' },
];

export function DeckPropertiesSection({ context, stickyIndex = 0 }: InspectorSectionProps) {
  const { deck, onUpdate } = context;
  const { isExpanded, expand, toggle } = useInspectorExpansion();
  const headerRef = useRef<HTMLDivElement>(null);
  const expanded = isExpanded(SECTION_ID);

  // Build backdrop slide options
  const backdropOptions = useMemo(() => {
    const options = [{ value: '', label: 'None' }];
    
    Object.values(deck.slides).forEach(s => {
      options.push({ value: s.id, label: s.title || 'Untitled' });
    });
    
    return options;
  }, [deck.slides]);

  // Build start point options
  const startPointOptions = useMemo(() => {
    const options = [{ value: '', label: 'None' }];
    
    const startPoints = deck.flow.startPoints ?? {};
    Object.values(startPoints).forEach(sp => {
      options.push({ value: sp.id, label: sp.name });
    });
    
    return options;
  }, [deck.flow.startPoints]);

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
          <span className="section-header-name">Deck</span>
        </div>
      </div>

      <div className="section-body" data-expanded={expanded}>
        <div className="section-body-inner">
          <div className="section-body-overflow">
            <div className="section-body-content">
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
              {startPointOptions.length > 1 && (
                <SelectField
                  label="Default Start Point"
                  value={deck.defaultStartPointId ?? ''}
                  options={startPointOptions}
                  onChange={(value) => onUpdate({ type: 'deck', field: 'defaultStartPointId', value: value || undefined })}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
