import { useRef } from 'react';
import type { InspectorSectionProps } from '../types';
import { scrollHeaderToSticky } from '../types';
import { ColorField } from '../fields/ColorField';
import { useInspectorExpansion } from '../context/InspectorExpansionContext';

const SECTION_ID = 'colors';
const HEADER_HEIGHT = 37;

export function ColorsSection({ context, stickyIndex = 0 }: InspectorSectionProps) {
  const { selectedSlide, onUpdate, selection } = context;
  const { isExpanded, expand, toggle } = useInspectorExpansion();
  const headerRef = useRef<HTMLDivElement>(null);
  
  if (!selectedSlide || !selection.slideId) return null;

  const slideId = selection.slideId;
  const style = selectedSlide.style ?? {};
  const expanded = isExpanded(SECTION_ID);
  
  const colorCount = [style.background, style.textPrimary, style.textSecondary, style.accent]
    .filter(Boolean).length;
  const subtitle = colorCount > 0 ? `${colorCount} override${colorCount > 1 ? 's' : ''}` : undefined;

  const handleStyleChange = (field: string, value: string) => {
    onUpdate({
      type: 'slide',
      slideId,
      field: 'style',
      value: { [field]: value || undefined },
    });
  };

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
          <span className="section-header-name">Colors</span>
          {!expanded && subtitle && (
            <span className="section-header-meta">{subtitle}</span>
          )}
        </div>
      </div>

      <div className="section-body" data-expanded={expanded}>
        <div className="section-body-inner">
          <div className="section-body-overflow">
            <div className="section-body-content">
              <ColorField
                label="Background"
                value={style.background ?? ''}
                onChange={(value) => handleStyleChange('background', value)}
                placeholder="Inherited"
              />
              <ColorField
                label="Text Primary"
                value={style.textPrimary ?? ''}
                onChange={(value) => handleStyleChange('textPrimary', value)}
                placeholder="Inherited"
              />
              <ColorField
                label="Text Secondary"
                value={style.textSecondary ?? ''}
                onChange={(value) => handleStyleChange('textSecondary', value)}
                placeholder="Inherited"
              />
              <ColorField
                label="Accent"
                value={style.accent ?? ''}
                onChange={(value) => handleStyleChange('accent', value)}
                placeholder="Inherited"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
