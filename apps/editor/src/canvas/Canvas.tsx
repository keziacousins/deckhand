import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStoreApi,
  MarkerType,
  type Edge,
  type Connection,
  type OnSelectionChangeParams,
  type NodeMouseHandler,
  type XYPosition,
  type Viewport,
  BackgroundVariant,
} from '@xyflow/react';
import { SlideNode, type SlideNodeType } from './SlideNode';
import { ContextMenu } from './ContextMenu';
import { CanvasHeader } from './CanvasHeader';
import { useSelection } from '../selection';
import type { Deck, Slide } from '@deckhand/schema';
import { generateSlideId, generateEdgeId, DEFAULT_GRID_COLUMNS } from '@deckhand/schema';

const nodeTypes = {
  slide: SlideNode,
};

interface CanvasProps {
  deck: Deck;
  onUpdateDeck: (updater: (deck: Deck) => Deck) => void;
  onBack: () => void;
  onNameChange: (name: string) => void;
  onPlayFullscreen: () => void;
  onPlayWindow: () => void;
  inspectorVisible: boolean;
  onToggleInspector: () => void;
  showGrid?: boolean;
}

export function Canvas({
  deck,
  onUpdateDeck,
  onBack,
  onNameChange,
  onPlayFullscreen,
  onPlayWindow,
  inspectorVisible,
  onToggleInspector,
  showGrid,
}: CanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const store = useStoreApi();
  const { selection, selectSlide } = useSelection();
  const selectedSlideId = selection.slideId;
  const selectedComponentId = selection.componentId;

  // Track connection start for drop-on-node
  const connectStartRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);

  // Flag to ignore selection changes during programmatic node updates
  const isUpdatingNodesRef = useRef(false);

  // LOD (Level of Detail) - show overview when zoomed out
  const DETAIL_ZOOM_THRESHOLD = 0.4;
  const [showDetails, setShowDetails] = useState(true);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    position: XYPosition;
    targetNode: SlideNodeType | null;
  } | null>(null);

  // Derive nodes from deck state
  const deckNodes = useMemo(() => {
    const deckGridColumns = deck.gridColumns ?? DEFAULT_GRID_COLUMNS;
    return Object.values(deck.slides).map((slide): SlideNodeType => ({
      id: slide.id,
      type: 'slide',
      position: slide.position,
      data: {
        slide,
        theme: deck.theme,
        aspectRatio: deck.aspectRatio,
        gridColumns: deckGridColumns,
        showGrid,
        selectedComponentId: slide.id === selectedSlideId ? selectedComponentId : null,
      },
      selected: slide.id === selectedSlideId,
    }));
  }, [deck.slides, deck.theme, deck.aspectRatio, deck.gridColumns, showGrid, selectedSlideId, selectedComponentId]);

  // Derive edges from deck state
  const deckEdges = useMemo(() => {
    return Object.values(deck.flow.edges).map((edge): Edge => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      type: 'smoothstep',
    }));
  }, [deck.flow.edges]);

  // Use React Flow's state management - initialize with empty, sync via effect
  const [nodes, setNodes, onNodesChange] = useNodesState<SlideNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Sync nodes when deck changes - merge to preserve React Flow's internal state
  useEffect(() => {
    // Set flag to ignore selection changes during this update
    isUpdatingNodesRef.current = true;
    
    setNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((n) => [n.id, n]));
      
      // Build new array, preserving existing node objects where possible
      const newNodes: SlideNodeType[] = [];
      for (const deckNode of deckNodes) {
        const current = currentById.get(deckNode.id);
        if (current) {
          // Update existing node in place - only change what's different
          const needsUpdate = 
            current.position.x !== deckNode.position.x ||
            current.position.y !== deckNode.position.y ||
            current.data !== deckNode.data ||
            current.selected !== deckNode.selected;
          
          if (needsUpdate) {
            newNodes.push({ ...current, ...deckNode });
          } else {
            newNodes.push(current);
          }
        } else {
          // New node from deck
          newNodes.push(deckNode);
        }
      }
      
      return newNodes;
    });
    
    // Clear flag after a microtask to allow React Flow to process the update
    queueMicrotask(() => {
      isUpdatingNodesRef.current = false;
    });
  }, [deckNodes, setNodes]);

  // Sync edges when deck changes
  useEffect(() => {
    setEdges(deckEdges);
  }, [deckEdges, setEdges]);

  const selectedNodes = useMemo(
    () => nodes.filter((n) => n.selected),
    [nodes]
  );

  const selectedEdges = useMemo(
    () => edges.filter((e) => e.selected),
    [edges]
  );

  const onSelectionChange = useCallback(
    ({ nodes }: OnSelectionChangeParams) => {
      // Ignore selection changes during programmatic node updates
      if (isUpdatingNodesRef.current) {
        return;
      }
      
      if (nodes.length === 1) {
        selectSlide(nodes[0].id);
      } else if (nodes.length === 0) {
        selectSlide(null);
      }
    },
    [selectSlide]
  );

  // Persist positions to deck when drag ends (handles single and multi-select)
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: SlideNodeType, draggedNodes: SlideNodeType[]) => {
      onUpdateDeck((d) => {
        let hasChanges = false;
        const updatedSlides = { ...d.slides };

        for (const node of draggedNodes) {
          const slide = d.slides[node.id];
          if (!slide) continue;
          // Only update if position actually changed
          if (slide.position.x === node.position.x && slide.position.y === node.position.y) {
            continue;
          }
          hasChanges = true;
          updatedSlides[node.id] = {
            ...slide,
            position: { x: node.position.x, y: node.position.y },
          };
        }

        if (!hasChanges) return d;

        return {
          ...d,
          slides: updatedSlides,
        };
      });
    },
    [onUpdateDeck]
  );

  // Connection handling
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return; // No self-loops

      const edgeId = generateEdgeId();

      // Update deck state - edges will update via deckEdges memo
      onUpdateDeck((d) => ({
        ...d,
        flow: {
          ...d.flow,
          edges: {
            ...d.flow.edges,
            [edgeId]: {
              id: edgeId,
              from: connection.source!,
              to: connection.target!,
              trigger: 'default',
              label: undefined,
            },
          },
        },
      }));
    },
    [onUpdateDeck]
  );

  // Track connection start for drop-on-node
  const onConnectStart = useCallback(
    (_: unknown, { nodeId, handleId }: { nodeId: string | null; handleId: string | null }) => {
      if (nodeId) {
        connectStartRef.current = { nodeId, handleId };
      }
    },
    []
  );

  // Handle drop-on-node connections
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const startInfo = connectStartRef.current;
      connectStartRef.current = null;
      if (!startInfo) return;

      const clientX = 'clientX' in event ? event.clientX : event.touches?.[0]?.clientX;
      const clientY = 'clientY' in event ? event.clientY : event.touches?.[0]?.clientY;
      if (clientX === undefined || clientY === undefined) return;

      // Check if dropped on a handle (ReactFlow's onConnect handles it)
      const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
      for (const el of elementsAtPoint) {
        if (el.classList.contains('react-flow__handle')) return;
      }

      // Find target node at drop point
      const { nodeLookup } = store.getState();
      let targetNodeId: string | null = null;

      for (const el of elementsAtPoint) {
        const nodeEl = el.closest('.react-flow__node[data-id]');
        if (nodeEl) {
          const nodeId = nodeEl.getAttribute('data-id');
          if (nodeId && nodeLookup.has(nodeId) && nodeId !== startInfo.nodeId) {
            targetNodeId = nodeId;
            break;
          }
        }
      }

      if (targetNodeId) {
        // Create connection via drop-on-node
        onConnect({
          source: startInfo.nodeId,
          sourceHandle: startInfo.handleId,
          target: targetNodeId,
          targetHandle: 'target',
        });
      }
    },
    [store, onConnect]
  );

  // Context menu handlers
  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        position: { x: event.clientX, y: event.clientY },
        targetNode: null,
      });
    },
    []
  );

  const onNodeContextMenu: NodeMouseHandler<SlideNodeType> = useCallback(
    (event, node) => {
      event.preventDefault();
      setContextMenu({
        position: { x: event.clientX, y: event.clientY },
        targetNode: node,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Slide operations
  const addSlide = useCallback(
    (screenPosition?: XYPosition) => {
      const position = screenPosition
        ? screenToFlowPosition(screenPosition)
        : { x: Object.keys(deck.slides).length * 250, y: 0 };

      const newSlide: Slide = {
        id: generateSlideId(),
        title: 'New Slide',
        components: [],
        position,
      };

      onUpdateDeck((d) => ({
        ...d,
        slides: {
          ...d.slides,
          [newSlide.id]: newSlide,
        },
      }));

      selectSlide(newSlide.id);
    },
    [deck.slides, onUpdateDeck, selectSlide, screenToFlowPosition]
  );

  const duplicateSlide = useCallback(
    (slideId: string) => {
      const original = deck.slides[slideId];
      if (!original) return;

      const newSlide: Slide = {
        ...original,
        id: generateSlideId(),
        title: `${original.title} (copy)`,
        position: {
          x: original.position.x + 50,
          y: original.position.y + 50,
        },
        components: original.components.map((c) => ({
          ...c,
          id: `comp-${crypto.randomUUID().slice(0, 8)}`,
        })),
      };

      onUpdateDeck((d) => ({
        ...d,
        slides: {
          ...d.slides,
          [newSlide.id]: newSlide,
        },
      }));

      selectSlide(newSlide.id);
    },
    [deck.slides, onUpdateDeck, selectSlide]
  );

  const deleteSlides = useCallback(
    (slideIds: string[]) => {
      onUpdateDeck((d) => {
        const newSlides = { ...d.slides };
        const newEdges = { ...d.flow.edges };

        for (const id of slideIds) {
          delete newSlides[id];
          // Remove edges connected to deleted slides
          for (const [edgeId, edge] of Object.entries(newEdges)) {
            if (edge.from === id || edge.to === id) {
              delete newEdges[edgeId];
            }
          }
        }

        // Update entry slide if needed
        let entrySlide = d.flow.entrySlide;
        if (slideIds.includes(entrySlide)) {
          const remaining = Object.keys(newSlides);
          entrySlide = remaining[0] || '';
        }

        return {
          ...d,
          slides: newSlides,
          flow: {
            ...d.flow,
            edges: newEdges,
            entrySlide,
          },
        };
      });

      selectSlide(null);
    },
    [onUpdateDeck, selectSlide]
  );

  const deleteEdges = useCallback(
    (edgeIds: string[]) => {
      onUpdateDeck((d) => {
        const newEdges = { ...d.flow.edges };
        for (const id of edgeIds) {
          delete newEdges[id];
        }
        return {
          ...d,
          flow: {
            ...d.flow,
            edges: newEdges,
          },
        };
      });
    },
    [onUpdateDeck]
  );

  // Handle node deletion from React Flow
  const onNodesDelete = useCallback(
    (nodesToDelete: SlideNodeType[]) => {
      deleteSlides(nodesToDelete.map((n) => n.id));
    },
    [deleteSlides]
  );

  // Handle edge deletion from React Flow
  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      deleteEdges(edgesToDelete.map((e) => e.id));
    },
    [deleteEdges]
  );

  // LOD zoom tracking
  const onMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      const shouldShowDetails = viewport.zoom >= DETAIL_ZOOM_THRESHOLD;
      if (shouldShowDetails !== showDetails) {
        setShowDetails(shouldShowDetails);
      }
    },
    [showDetails]
  );

  // Keyboard shortcuts (non-delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      // Add slide: Cmd+N
      if (isMod && e.key === 'n') {
        e.preventDefault();
        addSlide();
      }

      // Duplicate: Cmd+D
      if (isMod && e.key === 'd' && selectedSlideId) {
        e.preventDefault();
        duplicateSlide(selectedSlideId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addSlide, duplicateSlide, selectedSlideId]);

  return (
    <>
      <ReactFlow
        className={showDetails ? '' : 'zoom-overview'}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onMoveEnd={onMoveEnd}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.0 }}
        minZoom={0.1}
        maxZoom={4}
        panOnDrag={false}
        panOnScroll
        selectionOnDrag
        zoomOnScroll
        snapToGrid
        snapGrid={[10, 10]}
        defaultEdgeOptions={{
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
          },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="var(--canvas-dots)"
          style={{ backgroundColor: 'var(--canvas-bg)' }}
        />
        <Controls />
        <CanvasHeader
          deckName={deck.meta.title}
          onBack={onBack}
          onNameChange={onNameChange}
          onAddSlide={() => addSlide()}
          onPlayFullscreen={onPlayFullscreen}
          onPlayWindow={onPlayWindow}
          inspectorVisible={inspectorVisible}
          onToggleInspector={onToggleInspector}
        />
      </ReactFlow>

      <ContextMenu
        position={contextMenu?.position ?? null}
        targetNode={contextMenu?.targetNode ?? null}
        selectedNodes={selectedNodes}
        onClose={closeContextMenu}
        onAddSlide={addSlide}
        onDuplicateSlide={duplicateSlide}
        onDeleteSlide={deleteSlides}
      />
    </>
  );
}
