import { useEffect } from 'react';
import type { Node, XYPosition } from '@xyflow/react';
import './ContextMenu.css';

interface ContextMenuProps {
  position: XYPosition | null;
  targetNode: Node | null;
  selectedNodes: Node[];
  selectedComponentId: string | null;
  selectedSlideId: string | null;
  onClose: () => void;
  onAddSlide: (position: XYPosition) => void;
  onAddStartPoint: (position: XYPosition) => void;
  onDuplicateSlide: (nodeId: string) => void;
  onDeleteSlide: (nodeIds: string[]) => void;
  onDeleteComponent: (slideId: string, componentId: string) => void;
}

export function ContextMenu({
  position,
  targetNode,
  selectedNodes,
  selectedComponentId,
  selectedSlideId,
  onClose,
  onAddSlide,
  onAddStartPoint,
  onDuplicateSlide,
  onDeleteSlide,
  onDeleteComponent,
}: ContextMenuProps) {
  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.context-menu')) {
        onClose();
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  if (!position) return null;

  const hasSelection = selectedNodes.length > 0;
  const nodeIds = selectedNodes.map((n) => n.id);

  return (
    <div
      className="context-menu"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <button
        className="context-menu-item"
        onClick={() => {
          onAddSlide(position);
          onClose();
        }}
      >
        <span className="context-menu-label">Add Slide</span>
        <span className="context-menu-shortcut">⌘N</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onAddStartPoint(position);
          onClose();
        }}
      >
        <span className="context-menu-label">Add Start Point</span>
      </button>

      <div className="context-menu-separator" />

      <button
        className="context-menu-item"
        disabled={!hasSelection}
        onClick={() => {
          // TODO: Implement copy
          onClose();
        }}
      >
        <span className="context-menu-label">Copy</span>
        <span className="context-menu-shortcut">⌘C</span>
      </button>

      <button
        className="context-menu-item"
        disabled={!targetNode}
        onClick={() => {
          if (targetNode) {
            onDuplicateSlide(targetNode.id);
          }
          onClose();
        }}
      >
        <span className="context-menu-label">Duplicate</span>
        <span className="context-menu-shortcut">⌘D</span>
      </button>

      <div className="context-menu-separator" />

      {/* Delete Component - shown when a component is selected */}
      {selectedComponentId && selectedSlideId && (
        <button
          className="context-menu-item context-menu-item-danger"
          onClick={() => {
            onDeleteComponent(selectedSlideId, selectedComponentId);
            onClose();
          }}
        >
          <span className="context-menu-label">Delete Component</span>
          <span className="context-menu-shortcut">⌫</span>
        </button>
      )}

      {/* Delete Slide/Node - shown when no component is selected */}
      {!selectedComponentId && (
        <button
          className="context-menu-item context-menu-item-danger"
          disabled={!hasSelection}
          onClick={() => {
            onDeleteSlide(nodeIds);
            onClose();
          }}
        >
          <span className="context-menu-label">Delete</span>
          <span className="context-menu-shortcut">⌫</span>
        </button>
      )}
    </div>
  );
}
