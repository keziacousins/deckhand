import { useRef, useCallback } from 'react';
import { scrollHeaderToSticky } from '../types';
import { useInspectorExpansion } from '../context/InspectorExpansionContext';

const HEADER_HEIGHT = 41; /* 8px padding + 24px content + 8px padding + 1px border */

interface SectionProps {
  id: string;
  name: string;
  stickyIndex: number;
  /** Shown in header when collapsed */
  meta?: string;
  children: React.ReactNode;
  /** Callback ref to expose the header element (for multi-section components) */
  headerRef?: (el: HTMLDivElement | null) => void;
}

export function Section({ id, name, stickyIndex, meta, children, headerRef: externalHeaderRef }: SectionProps) {
  const { isExpanded, expand, toggle } = useInspectorExpansion();
  const internalRef = useRef<HTMLDivElement>(null);
  const expanded = isExpanded(id);

  const handleHeaderClick = useCallback(() => {
    expand(id);
    const header = internalRef.current;
    if (header) setTimeout(() => scrollHeaderToSticky(header), 250);
  }, [expand, id]);

  const handleChevronClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggle(id);
  }, [toggle, id]);

  const setRef = useCallback((el: HTMLDivElement | null) => {
    (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    externalHeaderRef?.(el);
  }, [externalHeaderRef]);

  return (
    <>
      <div
        ref={setRef}
        className="section-header"
        data-expanded={expanded}
        style={{ '--sticky-top': `${stickyIndex * HEADER_HEIGHT}px`, '--sticky-index': stickyIndex } as React.CSSProperties}
        onClick={handleHeaderClick}
      >
        <button
          className="section-header-expand"
          onClick={handleChevronClick}
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
          <span className="section-header-name">{name}</span>
          {!expanded && meta && (
            <span className="section-header-meta">{meta}</span>
          )}
        </div>
      </div>

      <div className="section-body" data-expanded={expanded}>
        <div className="section-body-inner">
          <div className="section-body-overflow">
            <div className="section-body-content">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
