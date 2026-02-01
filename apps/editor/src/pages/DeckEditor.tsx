import { useState, useEffect, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from '../canvas/Canvas';
import { Inspector } from '../inspector/Inspector';
import { StartPresentationModal } from '../components/StartPresentationModal';
import { SelectionProvider, useSelection } from '../selection';
import { useYDoc } from '../sync';
import { useUndoRedoShortcuts } from '../hooks/useUndoRedoShortcuts';
import type { Deck } from '@deckhand/schema';
import '../styles/layout.css';

interface DeckEditorProps {
  deckId: string;
  onBack: () => void;
}

// Window reference for presentation tab reuse
let presentationWindow: Window | null = null;

function DeckEditorInner({ deckId, onBack }: DeckEditorProps) {
  const { deck, status, error, updateDeck, undo, redo, canUndo, canRedo } = useYDoc(deckId);
  const [inspectorVisible, setInspectorVisible] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const { selectSlide } = useSelection();
  const [initialSelectionDone, setInitialSelectionDone] = useState(false);

  // Register undo/redo keyboard shortcuts
  useUndoRedoShortcuts({ undo, redo, canUndo, canRedo });

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

  // Get current selection for presentation start slide
  const { selection } = useSelection();

  // Modal state for start presentation
  const [showStartModal, setShowStartModal] = useState(false);
  const [pendingPlayMode, setPendingPlayMode] = useState<'fullscreen' | 'window' | null>(null);

  const hasStartPoints = deck && deck.flow.startPoints && Object.keys(deck.flow.startPoints).length > 0;

  const startPresentation = useCallback((slideId: string | undefined, mode: 'fullscreen' | 'window') => {
    if (!deck) return;

    const startSlide = slideId || '';
    
    if (mode === 'fullscreen') {
      const presentUrl = `/deck/${deckId}/present${startSlide ? `/${startSlide}` : ''}`;
      
      // Navigate to presentation route
      window.location.hash = presentUrl;
      
      // Request fullscreen on document element after a short delay to let React render
      setTimeout(() => {
        document.documentElement.requestFullscreen?.().catch(() => {
          // Fullscreen request failed (e.g., not triggered by user gesture)
          // Presentation still works, just not in fullscreen
        });
      }, 100);
    } else {
      const presentUrl = `${window.location.origin}${window.location.pathname}#/deck/${deckId}/present${startSlide ? `/${startSlide}` : ''}`;
      
      // Calculate window size based on aspect ratio
      const screenHeight = window.screen.availHeight;
      const screenWidth = window.screen.availWidth;
      
      // Parse aspect ratio (e.g., "16:9" -> 16/9)
      const [w, h] = deck.aspectRatio.split(':').map(Number);
      const aspectRatio = w / h;
      
      // Size to 80% of available screen height
      const windowHeight = Math.floor(screenHeight * 0.8);
      const windowWidth = Math.floor(windowHeight * aspectRatio);
      
      // Center on screen
      const left = Math.floor((screenWidth - windowWidth) / 2);
      const top = Math.floor((screenHeight - windowHeight) / 2);
      
      // Chromeless popup features
      const features = [
        `width=${windowWidth}`,
        `height=${windowHeight}`,
        `left=${left}`,
        `top=${top}`,
        'menubar=no',
        'toolbar=no',
        'location=no',
        'status=no',
        'resizable=yes',
      ].join(',');
      
      // Reuse existing presentation window or open new one
      if (presentationWindow && !presentationWindow.closed) {
        presentationWindow.location.href = presentUrl;
        presentationWindow.focus();
      } else {
        presentationWindow = window.open(presentUrl, 'deckhand-presentation', features);
      }
    }
  }, [deck, deckId]);

  const handlePlayFullscreen = useCallback(() => {
    if (hasStartPoints) {
      setPendingPlayMode('fullscreen');
      setShowStartModal(true);
    } else {
      startPresentation(selection.slideId || undefined, 'fullscreen');
    }
  }, [hasStartPoints, selection.slideId, startPresentation]);

  const handlePlayWindow = useCallback(() => {
    if (hasStartPoints) {
      setPendingPlayMode('window');
      setShowStartModal(true);
    } else {
      startPresentation(selection.slideId || undefined, 'window');
    }
  }, [hasStartPoints, selection.slideId, startPresentation]);

  const handleModalStart = useCallback((slideId: string | undefined) => {
    setShowStartModal(false);
    if (pendingPlayMode) {
      startPresentation(slideId, pendingPlayMode);
    }
    setPendingPlayMode(null);
  }, [pendingPlayMode, startPresentation]);

  const handleModalClose = useCallback(() => {
    setShowStartModal(false);
    setPendingPlayMode(null);
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
      <div className="editor-canvas">
        <ReactFlowProvider>
          <Canvas
            deck={deck}
            onUpdateDeck={handleUpdateDeck}
            onBack={onBack}
            onNameChange={handleNameChange}
            onPlayFullscreen={handlePlayFullscreen}
            onPlayWindow={handlePlayWindow}
            inspectorVisible={inspectorVisible}
            onToggleInspector={toggleInspector}
            showGrid={showGrid}
          />
        </ReactFlowProvider>
      </div>
      <Inspector
        visible={inspectorVisible}
        onClose={toggleInspector}
        deck={deck}
        onUpdateDeck={handleUpdateDeck}
        showGrid={showGrid}
        onToggleShowGrid={() => setShowGrid((v) => !v)}
      />
      
      {showStartModal && deck && (
        <StartPresentationModal
          deck={deck}
          currentSlideId={selection.slideId}
          onStart={handleModalStart}
          onClose={handleModalClose}
        />
      )}
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
