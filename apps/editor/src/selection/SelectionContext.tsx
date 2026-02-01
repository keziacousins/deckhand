import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Selection } from './types';

interface SelectionContextValue {
  selection: Selection;
  selectSlide: (slideId: string | null) => void;
  selectComponent: (slideId: string, componentId: string) => void;
  selectEdge: (edgeId: string | null) => void;
  selectStartPoint: (startPointId: string | null) => void;
  clearSelection: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

const emptySelection: Selection = {
  type: 'none',
  slideId: null,
  componentId: null,
  edgeId: null,
  startPointId: null,
};

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>(emptySelection);

  const selectSlide = useCallback((slideId: string | null) => {
    setSelection(
      slideId
        ? { type: 'slide', slideId, componentId: null, edgeId: null, startPointId: null }
        : emptySelection
    );
  }, []);

  const selectComponent = useCallback((slideId: string, componentId: string) => {
    setSelection({ type: 'component', slideId, componentId, edgeId: null, startPointId: null });
  }, []);

  const selectEdge = useCallback((edgeId: string | null) => {
    setSelection(
      edgeId
        ? { type: 'edge', slideId: null, componentId: null, edgeId, startPointId: null }
        : emptySelection
    );
  }, []);

  const selectStartPoint = useCallback((startPointId: string | null) => {
    setSelection(
      startPointId
        ? { type: 'startPoint', slideId: null, componentId: null, edgeId: null, startPointId }
        : emptySelection
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(emptySelection);
  }, []);

  return (
    <SelectionContext.Provider
      value={{ selection, selectSlide, selectComponent, selectEdge, selectStartPoint, clearSelection }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    throw new Error('useSelection must be used within SelectionProvider');
  }
  return ctx;
}
