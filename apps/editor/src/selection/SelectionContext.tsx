import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Selection } from './types';

interface SelectionContextValue {
  selection: Selection;
  selectSlide: (slideId: string | null) => void;
  selectComponent: (slideId: string, componentId: string) => void;
  clearSelection: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

const emptySelection: Selection = {
  type: 'none',
  slideId: null,
  componentId: null,
};

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>(emptySelection);

  const selectSlide = useCallback((slideId: string | null) => {
    setSelection(
      slideId
        ? { type: 'slide', slideId, componentId: null }
        : emptySelection
    );
  }, []);

  const selectComponent = useCallback((slideId: string, componentId: string) => {
    setSelection({ type: 'component', slideId, componentId });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(emptySelection);
  }, []);

  return (
    <SelectionContext.Provider
      value={{ selection, selectSlide, selectComponent, clearSelection }}
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
