import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStoreApi,
  addEdge,
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
  inspectorVisible: boolean;
  onToggleInspector: () => void;
  showGrid?: boolean;
}

export function Canvas({
  deck,
  onUpdateDeck,
  onBack,
  onNameChange,
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

  // LOD (Level of Detail) - show overview when zoomed out
  const DETAIL_ZOOM_THRESHOLD = 0.4;
  const [showDetails, setShowDetails] = useState(true);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    position: XYPosition;
    targetNode: SlideNodeType | null;
  } | null>(null);

  // Convert deck slides to React Flow nodes
  const initialNodes = useMemo(() => {
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

  // Convert deck flow edges to React Flow edges
  const initialEdges = useMemo(() => {
    return Object.values(deck.flow.edges).map((edge): Edge => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      type: 'smoothstep',
    }));
  }, [deck.flow.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes when deck changes (but preserve positions from React Flow state)
  useEffect(() => {
    const deckGridColumns = deck.gridColumns ?? DEFAULT_GRID_COLUMNS;
    setNodes((currentNodes) => {
      // Merge: use deck data but preserve current positions if node exists
      const currentPositions = new Map(currentNodes.map((n) => [n.id, n.position]));
      return Object.values(deck.slides).map((slide): SlideNodeType => {
        const existingPos = currentPositions.get(slide.id);
        return {
          id: slide.id,
          type: 'slide',
          position: existingPos ?? slide.position,
          data: {
            slide,
            theme: deck.theme,
            aspectRatio: deck.aspectRatio,
            gridColumns: deckGridColumns,
            showGrid,
            selectedComponentId: slide.id === selectedSlideId ? selectedComponentId : null,
          },
          selected: slide.id === selectedSlideId,
        };
      });
    });
  }, [deck.slides, deck.theme, deck.aspectRatio, deck.gridColumns, showGrid, selectedSlideId, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

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
      if (nodes.length === 1) {
        selectSlide(nodes[0].id);
      } else if (nodes.length === 0) {
        selectSlide(null);
      }
    },
    [selectSlide]
  );

  // Persist position to deck when drag ends
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: SlideNodeType) => {
      onUpdateDeck((d) => {
        const slide = d.slides[node.id];
        if (!slide) return d;
        // Only update if position actually changed
        if (slide.position.x === node.position.x && slide.position.y === node.position.y) {
          return d;
        }
        return {
          ...d,
          slides: {
            ...d.slides,
            [node.id]: {
              ...slide,
              position: { x: node.position.x, y: node.position.y },
            },
          },
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

      // Update deck state
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

      // Optimistically update React Flow edges
      setEdges((eds) =>
        addEdge({ ...connection, id: edgeId, type: 'smoothstep' }, eds)
      );
    },
    [onUpdateDeck, setEdges]
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
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={4}
        panOnScroll
        zoomOnScroll
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={() => 'var(--node-bg)'}
          maskColor="var(--bg-overlay)"
        />
        <CanvasHeader
          deckName={deck.meta.title}
          onBack={onBack}
          onNameChange={onNameChange}
          onAddSlide={() => addSlide()}
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
