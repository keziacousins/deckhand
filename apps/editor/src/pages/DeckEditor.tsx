import { useState, useEffect, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from '../canvas/Canvas';
import { Inspector } from '../inspector/Inspector';
import { SelectionProvider, useSelection } from '../selection';
import { useYDoc } from '../sync';
import type { Deck } from '@deckhand/schema';
import '../styles/layout.css';

interface DeckEditorProps {
  deckId: string;
  onBack: () => void;
}

function DeckEditorInner({ deckId, onBack }: DeckEditorProps) {
  const { deck, status, error, updateDeck } = useYDoc(deckId);
  const [inspectorVisible, setInspectorVisible] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const { selectSlide } = useSelection();
  const [initialSelectionDone, setInitialSelectionDone] = useState(false);

  // Select first slide when deck loads
  useEffect(() => {
    if (deck && !initialSelectionDone) {
      const slideIds = Object.keys(deck.slides);
      if (slideIds.length > 0) {
        selectSlide(slideIds[0]);
        setInitialSelectionDone(true);
      }
    }
  }, [deck, selectSlide, initialSelectionDone]);

  // Reset initial selection flag when deckId changes
  useEffect(() => {
    setInitialSelectionDone(false);
  }, [deckId]);

  const handleUpdateDeck = useCallback((updater: (deck: Deck) => Deck) => {
    updateDeck((current) => {
      const updated = updater(current);
      return {
        ...updated,
        meta: {
          ...updated.meta,
          updated: new Date().toISOString(),
        },
      };
    });
  }, [updateDeck]);

  const handleNameChange = useCallback((name: string) => {
    handleUpdateDeck((d) => ({
      ...d,
      meta: {
        ...d.meta,
        title: name,
      },
    }));
  }, [handleUpdateDeck]);

  const toggleInspector = useCallback(() => {
    setInspectorVisible((v) => !v);
  }, []);

  // Show loading while connecting or waiting for initial data
  if (status === 'connecting' || (status === 'connected' && !deck)) {
    return (
      <div className="editor-container">
        <div className="loading-state">
          {status === 'connecting' ? 'Connecting...' : 'Loading deck...'}
        </div>
      </div>
    );
  }

  if (status === 'error' || status === 'disconnected' || !deck) {
    return (
      <div className="editor-container">
        <div className="error-state">
          <p>{error || (status === 'disconnected' ? 'Disconnected from server' : 'Deck not found')}</p>
          <button onClick={onBack}>Back to Decks</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <ReactFlowProvider>
        <Canvas
          deck={deck}
          onUpdateDeck={handleUpdateDeck}
          onBack={onBack}
          onNameChange={handleNameChange}
          inspectorVisible={inspectorVisible}
          onToggleInspector={toggleInspector}
          showGrid={showGrid}
        />
      </ReactFlowProvider>
      <Inspector
        visible={inspectorVisible}
        onClose={toggleInspector}
        deck={deck}
        onUpdateDeck={handleUpdateDeck}
        showGrid={showGrid}
        onToggleShowGrid={() => setShowGrid((v) => !v)}
      />
    </div>
  );
}

export function DeckEditor(props: DeckEditorProps) {
  return (
    <SelectionProvider>
      <DeckEditorInner {...props} />
    </SelectionProvider>
  );
}
