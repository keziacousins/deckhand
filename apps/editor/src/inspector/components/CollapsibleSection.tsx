import { useRef, useEffect, useCallback } from 'react';
import './CollapsibleSection.css';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  subtitle?: string; // Shown in header when collapsed (e.g., asset filename)
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  scrollOnExpand?: boolean;
}

export function CollapsibleSection({
  id,
  title,
  subtitle,
  isExpanded,
  onToggle,
  children,
  scrollOnExpand = true,
}: CollapsibleSectionProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const wasExpanded = useRef(isExpanded);

  // Scroll header into view when section is expanded
  useEffect(() => {
    if (scrollOnExpand && isExpanded && !wasExpanded.current && headerRef.current) {
      headerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    wasExpanded.current = isExpanded;
  }, [isExpanded, scrollOnExpand]);

  return (
    <div className={`collapsible-section ${isExpanded ? 'collapsible-section-expanded' : ''}`} data-section-id={id}>
      <div 
        ref={headerRef}
        className="collapsible-section-header" 
        onClick={onToggle}
      >
        <button className="collapsible-section-toggle" type="button">
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 16 16" 
            fill="none"
            className={isExpanded ? 'collapsible-section-chevron-expanded' : ''}
          >
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="collapsible-section-title">{title}</span>
        {!isExpanded && subtitle && (
          <span className="collapsible-section-subtitle">{subtitle}</span>
        )}
      </div>
      <div className="collapsible-section-body">
        <div className="collapsible-section-content-wrapper">
          <div className="collapsible-section-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
