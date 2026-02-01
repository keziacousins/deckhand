import { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface InspectorExpansionContextValue {
  expandedSections: Set<string>;
  isExpanded: (sectionId: string) => boolean;
  toggle: (sectionId: string) => void;
  expand: (sectionId: string) => void;
  collapse: (sectionId: string) => void;
  collapseAll: () => void;
  // For components - track which component card is expanded
  expandedComponentId: string | null;
  setExpandedComponentId: (id: string | null) => void;
}

const InspectorExpansionContext = createContext<InspectorExpansionContextValue | null>(null);

interface InspectorExpansionProviderProps {
  children: React.ReactNode;
}

export function InspectorExpansionProvider({ children }: InspectorExpansionProviderProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedComponentId, setExpandedComponentId] = useState<string | null>(null);

  const isExpanded = useCallback((sectionId: string) => {
    return expandedSections.has(sectionId);
  }, [expandedSections]);

  const toggle = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const expand = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      if (prev.has(sectionId)) return prev;
      const next = new Set(prev);
      next.add(sectionId);
      return next;
    });
  }, []);

  const collapse = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      if (!prev.has(sectionId)) return prev;
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
    setExpandedComponentId(null);
  }, []);

  const value = useMemo(() => ({
    expandedSections,
    isExpanded,
    toggle,
    expand,
    collapse,
    collapseAll,
    expandedComponentId,
    setExpandedComponentId,
  }), [expandedSections, isExpanded, toggle, expand, collapse, collapseAll, expandedComponentId]);

  return (
    <InspectorExpansionContext.Provider value={value}>
      {children}
    </InspectorExpansionContext.Provider>
  );
}

export function useInspectorExpansion() {
  const context = useContext(InspectorExpansionContext);
  if (!context) {
    throw new Error('useInspectorExpansion must be used within InspectorExpansionProvider');
  }
  return context;
}
