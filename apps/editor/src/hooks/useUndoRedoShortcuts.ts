/**
 * useUndoRedoShortcuts: Keyboard shortcuts for undo/redo
 *
 * Handles:
 * - Cmd+Z (Mac) / Ctrl+Z (Windows) = Undo
 * - Cmd+Shift+Z (Mac) / Ctrl+Shift+Z (Windows) = Redo
 * - Cmd+Y (Windows convention) = Redo
 *
 * Skips when user is editing text (input, textarea, contenteditable)
 * to let browser handle native undo in text fields.
 */

import { useEffect } from 'react';

function isTextInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    target.isContentEditable
  );
}

interface UseUndoRedoShortcutsOptions {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedoShortcuts({
  undo,
  redo,
  canUndo,
  canRedo,
}: UseUndoRedoShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if editing text - let browser handle native undo
      if (isTextInputElement(e.target)) return;

      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+Z = Undo
      if (isMod && e.key === 'z' && !e.shiftKey) {
        console.log('[useUndoRedoShortcuts] Cmd+Z pressed, canUndo:', canUndo);
        if (canUndo) {
          e.preventDefault();
          undo();
        }
        return;
      }

      // Cmd+Shift+Z = Redo
      if (isMod && e.key === 'z' && e.shiftKey) {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
        return;
      }

      // Cmd+Y = Redo (Windows convention)
      if (isMod && e.key === 'y') {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);
}
