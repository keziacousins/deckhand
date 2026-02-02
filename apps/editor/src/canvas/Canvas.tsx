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
  type OnReconnect,
  BackgroundVariant,
} from '@xyflow/react';
import { SlideNode, type SlideNodeType } from './SlideNode';
import { StartPointNode, type StartPointNodeType } from './StartPointNode';
import { TransitionEdge } from './TransitionEdge';
import { ContextMenu } from './ContextMenu';
import { CanvasHeader } from './CanvasHeader';
import { useSelection } from '../selection';
import type { Deck, Slide, StartPoint } from '@deckhand/schema';
import { generateSlideId, generateEdgeId, generateStartPointId, createStartPoint, DEFAULT_GRID_COLUMNS } from '@deckhand/schema';

const nodeTypes = {
  slide: SlideNode,
  startPoint: StartPointNode,
};

const edgeTypes = {
  transition: TransitionEdge,
};

// Union type for all node types
type CanvasNodeType = SlideNodeType | StartPointNodeType;

type ConnectionStatusType = 'connecting' | 'connected' | 'disconnected' | 'error';

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
  connectionStatus: ConnectionStatusType;
  connectionError?: string | null;
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
  connectionStatus,
  connectionError,
}: CanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const store = useStoreApi();
  const { selection, selectSlide, selectEdge, selectStartPoint } = useSelection();
  const selectedSlideId = selection.slideId;
  const selectedComponentId = selection.componentId;
  const selectedEdgeId = selection.edgeId;
  const selectedStartPointId = selection.startPointId;

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
    targetNode: CanvasNodeType | null;
  } | null>(null);

  // Derive slide nodes from deck state
  const slideNodes = useMemo(() => {
    const deckGridColumns = deck.gridColumns ?? DEFAULT_GRID_COLUMNS;
    const assets = deck.assets ?? {};
    return Object.values(deck.slides).map((slide): SlideNodeType => ({
      id: slide.id,
      type: 'slide',
      position: slide.position,
      data: {
        slide,
        theme: deck.theme,
        aspectRatio: deck.aspectRatio,
        gridColumns: deckGridColumns,
        assets,
        showGrid,
        selectedComponentId: slide.id === selectedSlideId ? selectedComponentId : null,
      },
      selected: slide.id === selectedSlideId,
    }));
  }, [deck.slides, deck.theme, deck.aspectRatio, deck.gridColumns, deck.assets, showGrid, selectedSlideId, selectedComponentId]);

  // Derive start point nodes from deck state
  const startPointNodes = useMemo(() => {
    const startPoints = deck.flow.startPoints ?? {};
    return Object.values(startPoints).map((startPoint): StartPointNodeType => ({
      id: startPoint.id,
      type: 'startPoint',
      position: startPoint.position,
      data: { startPoint },
      selected: startPoint.id === selectedStartPointId,
    }));
  }, [deck.flow.startPoints, selectedStartPointId]);

  // Combine all nodes
  const deckNodes = useMemo(() => {
    return [...slideNodes, ...startPointNodes];
  }, [slideNodes, startPointNodes]);

  // Derive edges from deck state
  const deckEdges = useMemo((): Edge[] => {
    return Object.values(deck.flow.edges).map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: 'transition',
      data: {
        transition: edge.transition,
        label: edge.label,
      },
    }));
  }, [deck.flow.edges]);

  // Use React Flow's state management - initialize with empty, sync via effect
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Sync nodes when deck changes - merge to preserve React Flow's internal state
  useEffect(() => {
    // Set flag to ignore selection changes during this update
    isUpdatingNodesRef.current = true;
    
    setNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((n) => [n.id, n]));
      
      // Build new array, preserving existing node objects where possible
      const newNodes: CanvasNodeType[] = [];
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
            newNodes.push({ ...current, ...deckNode } as CanvasNodeType);
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

  // Sync edges when deck changes - preserve selection state
  useEffect(() => {
    setEdges((currentEdges) => {
      const selectedIds = new Set(currentEdges.filter(e => e.selected).map(e => e.id));
      return deckEdges.map(edge => ({
        ...edge,
        selected: selectedIds.has(edge.id),
      }));
    });
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
    ({ nodes, edges: selectedEdgesList }: OnSelectionChangeParams) => {
      // Ignore selection changes during programmatic node updates
      if (isUpdatingNodesRef.current) {
        return;
      }
      
      // Handle edge selection
      if (selectedEdgesList.length === 1 && nodes.length === 0) {
        selectEdge(selectedEdgesList[0].id);
        return;
      }
      
      // Handle node selection
      if (nodes.length === 1) {
        const node = nodes[0];
        if (node.type === 'startPoint') {
          selectStartPoint(node.id);
        } else {
          selectSlide(node.id);
        }
      } else if (nodes.length === 0 && selectedEdgesList.length === 0) {
        selectSlide(null);
      }
    },
    [selectSlide, selectEdge, selectStartPoint]
  );

  // Persist positions to deck when drag ends (handles single and multi-select)
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: CanvasNodeType, draggedNodes: CanvasNodeType[]) => {
      onUpdateDeck((d) => {
        let hasChanges = false;
        const updatedSlides = { ...d.slides };
        const updatedStartPoints = { ...d.flow.startPoints };

        for (const node of draggedNodes) {
          if (node.type === 'slide') {
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
          } else if (node.type === 'startPoint') {
            const startPoint = d.flow.startPoints?.[node.id];
            if (!startPoint) continue;
            // Only update if position actually changed
            if (startPoint.position.x === node.position.x && startPoint.position.y === node.position.y) {
              continue;
            }
            hasChanges = true;
            updatedStartPoints[node.id] = {
              ...startPoint,
              position: { x: node.position.x, y: node.position.y },
            };
          }
        }

        if (!hasChanges) return d;

        return {
          ...d,
          slides: updatedSlides,
          flow: {
            ...d.flow,
            startPoints: updatedStartPoints,
          },
        };
      });
    },
    [onUpdateDeck]
  );

  // Connection handling
  const onConnect = useCallback(
    (connection: Connection) => {
      // Skip if this is a reconnection (handled by onReconnect)
      if (isReconnectingRef.current) return;
      
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return; // No self-loops

      const edgeId = generateEdgeId();

      // Update deck state - edges will update via deckEdges memo
      onUpdateDeck((d) => {
        const sourceId = connection.source!;
        const targetId = connection.target!;
        
        // Check if source is a start point - enforce single outgoing edge
        const isStartPoint = d.flow.startPoints?.[sourceId] !== undefined;
        let newEdges = { ...d.flow.edges };
        
        if (isStartPoint) {
          // Remove any existing edges from this start point
          for (const [existingEdgeId, edge] of Object.entries(newEdges)) {
            if (edge.from === sourceId) {
              delete newEdges[existingEdgeId];
            }
          }
        }
        
        // Add the new edge
        newEdges[edgeId] = {
          id: edgeId,
          from: sourceId,
          to: targetId,
          trigger: 'default',
          label: undefined,
        };
        
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

  // Track if we're in the middle of a reconnect to prevent onConnect from firing
  const isReconnectingRef = useRef(false);

  // Edge reconnection - drag edge endpoint to new handle/node
  const onReconnectStart = useCallback(() => {
    isReconnectingRef.current = true;
  }, []);

  const onReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection) => {
      if (!newConnection.source || !newConnection.target) return;
      if (newConnection.source === newConnection.target) return; // No self-loops

      onUpdateDeck((d) => {
        const existingEdge = d.flow.edges[oldEdge.id];
        if (!existingEdge) return d;

        return {
          ...d,
          flow: {
            ...d.flow,
            edges: {
              ...d.flow.edges,
              [oldEdge.id]: {
                ...existingEdge,
                from: newConnection.source!,
                to: newConnection.target!,
              },
            },
          },
        };
      });
    },
    [onUpdateDeck]
  );

  const onReconnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, edge: Edge) => {
      isReconnectingRef.current = false;

      const clientX = 'clientX' in event ? event.clientX : event.touches?.[0]?.clientX;
      const clientY = 'clientY' in event ? event.clientY : event.touches?.[0]?.clientY;
      if (clientX === undefined || clientY === undefined) return;

      // Check if dropped on a handle (onReconnect already handled it)
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
          if (nodeId && nodeLookup.has(nodeId) && nodeId !== edge.source) {
            targetNodeId = nodeId;
            break;
          }
        }
      }

      if (targetNodeId) {
        // Reconnect edge to dropped node
        onUpdateDeck((d) => {
          const existingEdge = d.flow.edges[edge.id];
          if (!existingEdge) return d;

          return {
            ...d,
            flow: {
              ...d.flow,
              edges: {
                ...d.flow.edges,
                [edge.id]: {
                  ...existingEdge,
                  to: targetNodeId!,
                },
              },
            },
          };
        });
      }
    },
    [store, onUpdateDeck]
  );

  // Track connection start for drop-on-node
  const onConnectStart = useCallback(
    (_: unknown, { nodeId, handleId }: { nodeId: string | null; handleId: string | null }) => {
      // Don't track if we're reconnecting an existing edge
      if (isReconnectingRef.current) return;
      
      if (nodeId) {
        connectStartRef.current = { nodeId, handleId };
      }
    },
    []
  );

  // Handle drop-on-node connections
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      // Don't handle if we're reconnecting an existing edge
      if (isReconnectingRef.current) return;
      
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

  const onNodeContextMenu: NodeMouseHandler<CanvasNodeType> = useCallback(
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

  // Add start point
  const addStartPoint = useCallback(
    (screenPosition?: XYPosition) => {
      const position = screenPosition
        ? screenToFlowPosition(screenPosition)
        : { x: -200, y: 0 };

      // Generate unique name
      const existingNames = new Set(
        Object.values(deck.flow.startPoints ?? {}).map((sp) => sp.name)
      );
      let name = 'Start';
      let counter = 1;
      while (existingNames.has(name)) {
        counter++;
        name = `Start ${counter}`;
      }

      const newStartPoint = createStartPoint(name, position);

      onUpdateDeck((d) => ({
        ...d,
        flow: {
          ...d.flow,
          startPoints: {
            ...d.flow.startPoints,
            [newStartPoint.id]: newStartPoint,
          },
        },
      }));
    },
    [deck.flow.startPoints, onUpdateDeck, screenToFlowPosition]
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
    (nodesToDelete: CanvasNodeType[]) => {
      // Only delete slide nodes, not start points (yet)
      const slideIds = nodesToDelete
        .filter((n): n is SlideNodeType => n.type === 'slide')
        .map((n) => n.id);
      if (slideIds.length > 0) {
        deleteSlides(slideIds);
      }
      // TODO: Handle start point deletion
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
        onReconnectStart={onReconnectStart}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        edgesReconnectable
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onMoveEnd={onMoveEnd}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.0 }}
        minZoom={0.1}
        maxZoom={4}
        panOnDrag={false}
        panOnScroll
        selectionOnDrag
        zoomOnScroll
        snapToGrid
        snapGrid={[25, 25]}
        defaultEdgeOptions={{
          type: 'transition',
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
          connectionStatus={connectionStatus}
          connectionError={connectionError}
        />
      </ReactFlow>

      <ContextMenu
        position={contextMenu?.position ?? null}
        targetNode={contextMenu?.targetNode ?? null}
        selectedNodes={selectedNodes}
        onClose={closeContextMenu}
        onAddSlide={addSlide}
        onAddStartPoint={addStartPoint}
        onDuplicateSlide={duplicateSlide}
        onDeleteSlide={deleteSlides}
      />
    </>
  );
}
