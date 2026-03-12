import { useState, useEffect, useCallback, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from '../canvas/Canvas';
import { Inspector } from '../inspector/Inspector';
import { StartPresentationModal } from '../components/StartPresentationModal';
import { ShareDialog } from '../components/ShareDialog';
import { SelectionProvider, useSelection } from '../selection';
import { useYDoc } from '../sync';
import { useAuth } from '../auth/AuthProvider';
import { usePresence } from '../collaboration';
import { useUndoRedoShortcuts } from '../hooks/useUndoRedoShortcuts';
import { useCoverCapture } from '../hooks/useCoverCapture';
import { useCaptureHandler } from '../hooks/useCaptureHandler';
import { useRenderErrorReporter } from '../hooks/useRenderErrorReporter';
import { useProfile } from '../hooks/useProfile';
import { getDeck, type DeckRole } from '../api/decks';
import type { Deck } from '@deckhand/schema';
import '../styles/layout.css';

interface DeckEditorProps {
  deckId: string;
  onBack: () => void;
}

// Window reference for presentation tab reuse
let presentationWindow: Window | null = null;

function DeckEditorInner({ deckId, onBack }: DeckEditorProps) {
  const { deck, status, hasEverSynced, error, updateDeck, undo, redo, canUndo, canRedo, onMessage, sendMessage, refreshWsToken, awareness } = useYDoc(deckId);
  const { token: authToken, user: authUser } = useAuth();
  const { profile } = useProfile(authToken);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const { updateCursor, updateViewport, remoteUsers, localUserInfo } = usePresence({
    awareness,
    localUser: {
      id: authUser?.sub ?? 'anonymous',
      name: profile?.name ?? authUser?.name ?? 'Anonymous',
      avatarUrl: profile?.avatarUrl ?? undefined,
    },
    followingUserId,
  });
  const [inspectorVisible, setInspectorVisible] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [initialSelectionDone, setInitialSelectionDone] = useState(false);
  const hasCapturedInitialCover = useRef(false);
  const [deckRole, setDeckRole] = useState<DeckRole | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Fetch deck role (ref guard prevents double-fetch in React strict mode)
  const roleFetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (roleFetchedFor.current === deckId) return;
    roleFetchedFor.current = deckId;
    getDeck(deckId).then((d) => {
      setDeckRole(d.role);
      if (d.role === 'viewer') setInspectorVisible(false);
    }).catch(() => {});
  }, [deckId]);

  // When the auth token refreshes, send it to the WebSocket to extend the session
  useEffect(() => {
    if (authToken) {
      refreshWsToken();
    }
  }, [authToken, refreshWsToken]);

  // Register undo/redo keyboard shortcuts
  useUndoRedoShortcuts({ undo, redo, canUndo, canRedo });

  // Cover image capture
  const { captureCover, isCapturing } = useCoverCapture({ deck, deckId });

  // Handle server-initiated slide capture commands (for LLM vision)
  useCaptureHandler({ deckId, onMessage, sendMessage });
  // Relay component render errors to server so LLM can fix them
  useRenderErrorReporter({ sendMessage });
  const [isSaving, setIsSaving] = useState(false);

  // Mark initial load complete (no auto-selection)
  useEffect(() => {
    if (deck && !initialSelectionDone) {
      setInitialSelectionDone(true);
    }
  }, [deck, initialSelectionDone]);

  // Reset initial selection flag when deckId changes
  useEffect(() => {
    setInitialSelectionDone(false);
    hasCapturedInitialCover.current = false;
  }, [deckId]);

  // Capture cover image after initial render (with delay for canvas to render)
  // Skip for viewers — they can't upload covers
  useEffect(() => {
    if (deck && hasEverSynced && !hasCapturedInitialCover.current && deckRole && deckRole !== 'viewer') {
      hasCapturedInitialCover.current = true;
      // Delay to ensure the slide is rendered
      const timer = setTimeout(() => {
        captureCover();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [deck, hasEverSynced, deckRole, captureCover]);

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

  // Capture cover before navigating away (skip for viewers)
  const handleBack = useCallback(async () => {
    if (deckRole && deckRole !== 'viewer') {
      setIsSaving(true);
      await captureCover();
    }
    onBack();
  }, [captureCover, deckRole, onBack]);

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

  // Show loading only on initial load (before we've ever synced)
  if (!hasEverSynced && !deck) {
    if (status === 'error') {
      return (
        <div className="editor-container">
          <div className="error-state">
            <p>{error || 'Failed to load deck'}</p>
            <button onClick={handleBack}>Back to Decks</button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="editor-container">
        <div className="loading-state">
          {status === 'connecting' ? 'Connecting...' : 'Loading deck...'}
        </div>
      </div>
    );
  }

  // Once we've synced, we should have a deck - but handle edge case
  if (!deck) {
    return (
      <div className="editor-container">
        <div className="error-state">
          <p>Deck not found</p>
          <button onClick={handleBack}>Back to Decks</button>
        </div>
      </div>
    );
  }

  const readOnly = deckRole === 'viewer';

  return (
    <div className="editor-container">
      <div className="editor-canvas">
        <ReactFlowProvider>
          <Canvas
            deck={deck}
            onUpdateDeck={handleUpdateDeck}
            onBack={handleBack}
            onNameChange={handleNameChange}
            onPlayFullscreen={handlePlayFullscreen}
            onPlayWindow={handlePlayWindow}
            inspectorVisible={inspectorVisible}
            onToggleInspector={toggleInspector}
            onShare={deckRole === 'owner' ? () => setShowShareDialog(true) : undefined}
            readOnly={readOnly}
            showGrid={showGrid}
            connectionStatus={status}
            connectionError={error}
            remoteUsers={remoteUsers}
            localUser={localUserInfo}
            updateCursor={updateCursor}
            updateViewport={updateViewport}
            followingUserId={followingUserId}
            onFollowUser={setFollowingUserId}
          />
        </ReactFlowProvider>
      </div>
      <Inspector
        visible={inspectorVisible}
        onClose={toggleInspector}
        deck={deck}
        deckId={deckId}
        onUpdateDeck={handleUpdateDeck}
        readOnly={readOnly}
        showGrid={showGrid}
        onToggleShowGrid={() => setShowGrid((v) => !v)}
        onMessage={onMessage}
        sendMessage={sendMessage}
        localUser={{
          id: authUser?.sub ?? 'anonymous',
          name: profile?.name ?? authUser?.name ?? 'Anonymous',
          avatarUrl: profile?.avatarUrl ?? undefined,
        }}
      />
      
      {showStartModal && deck && (
        <StartPresentationModal
          deck={deck}
          currentSlideId={selection.slideId}
          onStart={handleModalStart}
          onClose={handleModalClose}
        />
      )}
      
      {showShareDialog && (
        <ShareDialog deckId={deckId} onClose={() => setShowShareDialog(false)} />
      )}

      {isSaving && (
        <div className="saving-overlay">
          <div className="saving-spinner" />
          <span>Saving...</span>
        </div>
      )}

      {status === 'error' && error === 'This deck has been deleted' && (
        <div className="saving-overlay">
          <div style={{
            background: 'var(--bg-panel, #1e1e2e)',
            borderRadius: '12px',
            padding: '32px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary, #fff)' }}>
              This deck has been deleted
            </p>
            <button onClick={onBack} style={{
              padding: '8px 24px',
              background: 'var(--interactive-primary, #6366f1)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}>Back to Decks</button>
          </div>
        </div>
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
