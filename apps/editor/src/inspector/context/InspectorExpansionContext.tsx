import { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface InspectorExpansionContextValue {
  expandedSections: Set<string>;
  isExpanded: (sectionId: string) => boolean;
  toggle: (sectionId: string) => void;
  expand: (sectionId: string) => void;
  collapse: (sectionId: string) => void;
  collapseAll: () => void;
  // For components - track which component cards are expanded (supports multiple)
  expandedComponentIds: Set<string>;
  isComponentExpanded: (id: string) => boolean;
  toggleComponentExpanded: (id: string) => void;
  expandComponent: (id: string) => void;
  collapseComponent: (id: string, childIds?: string[]) => void;
}

const InspectorExpansionContext = createContext<InspectorExpansionContextValue | null>(null);

interface InspectorExpansionProviderProps {
  children: React.ReactNode;
}

export function InspectorExpansionProvider({ children }: InspectorExpansionProviderProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['assets-upload', 'assets-library']));
  const [expandedComponentIds, setExpandedComponentIds] = useState<Set<string>>(new Set());

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

  const isComponentExpanded = useCallback((id: string) => {
    return expandedComponentIds.has(id);
  }, [expandedComponentIds]);

  const toggleComponentExpanded = useCallback((id: string) => {
    setExpandedComponentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandComponent = useCallback((id: string) => {
    setExpandedComponentIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // When collapsing a container, also collapse its children to avoid orphaned expanded states
  const collapseComponent = useCallback((id: string, childIds?: string[]) => {
    setExpandedComponentIds((prev) => {
      if (!prev.has(id) && (!childIds || childIds.every(cid => !prev.has(cid)))) return prev;
      const next = new Set(prev);
      next.delete(id);
      if (childIds) {
        for (const childId of childIds) {
          next.delete(childId);
        }
      }
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
    setExpandedComponentIds(new Set());
  }, []);

  const value = useMemo(() => ({
    expandedSections,
    isExpanded,
    toggle,
    expand,
    collapse,
    collapseAll,
    expandedComponentIds,
    isComponentExpanded,
    toggleComponentExpanded,
    expandComponent,
    collapseComponent,
  }), [expandedSections, isExpanded, toggle, expand, collapse, collapseAll, expandedComponentIds, isComponentExpanded, toggleComponentExpanded, expandComponent, collapseComponent]);

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
