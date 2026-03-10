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
import { generateSlideId, generateEdgeId, generateStartPointId, createStartPoint, DEFAULT_GRID_COLUMNS, resolveEdgeSource, SLIDE_WIDTH, getSlideHeight } from '@deckhand/schema';
import { findClosestTargetHandle } from './handleUtils';
import { useAuthAssets } from '../hooks/useAuthAssets';

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
  onShare?: () => void;
  readOnly?: boolean;
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
  onShare,
  readOnly,
  showGrid,
  connectionStatus,
  connectionError,
}: CanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const store = useStoreApi();
  const { selection, selectSlide, selectEdge, selectStartPoint, clearSelection } = useSelection();
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

  // Resolve asset URLs to authenticated blob URLs for web components
  const rawAssets = useMemo(() => deck.assets ?? {}, [deck.assets]);
  const assets = useAuthAssets(rawAssets);

  // Derive slide nodes from deck state
  const slideNodes = useMemo(() => {
    const deckGridColumns = deck.gridColumns ?? DEFAULT_GRID_COLUMNS;
    
    // Pre-compute linked component IDs per slide
    const linkedComponentsBySlide = new Map<string, string[]>();
    for (const edge of Object.values(deck.flow.edges)) {
      const source = resolveEdgeSource(deck, edge.from);
      if (source?.type === 'component') {
        const existing = linkedComponentsBySlide.get(source.slideId) ?? [];
        existing.push(source.componentId);
        linkedComponentsBySlide.set(source.slideId, existing);
      }
    }
    
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
        allSlides: deck.slides,
        defaultBackdropSlideId: deck.defaultBackdropSlideId,
        linkedComponentIds: linkedComponentsBySlide.get(slide.id),
      },
      selected: slide.id === selectedSlideId,
    }));
  }, [deck.slides, deck.theme, deck.aspectRatio, deck.gridColumns, assets, deck.defaultBackdropSlideId, deck.flow.edges, showGrid, selectedSlideId, selectedComponentId]);

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
  const slideHeight = getSlideHeight(deck.aspectRatio);

  const deckEdges = useMemo((): Edge[] => {
    // Compute actual handle positions on the node boundary
    const getHandlePositions = (nodeId: string) => {
      const slide = deck.slides[nodeId];
      if (slide) {
        const x = slide.position.x;
        const y = slide.position.y;
        return {
          'source-right':  { x: x + SLIDE_WIDTH, y: y + slideHeight / 2 },
          'source-bottom': { x: x + SLIDE_WIDTH / 2, y: y + slideHeight },
          'target-left':   { x, y: y + slideHeight / 2 },
          'target-top':    { x: x + SLIDE_WIDTH / 2, y: y },
        };
      }
      const sp = (deck.flow.startPoints ?? {})[nodeId];
      if (sp) {
        const px = sp.position.x;
        const py = sp.position.y;
        return {
          'source-right':  { x: px + 20, y: py },
          'source-bottom': { x: px, y: py + 20 },
          'target-left':   { x: px - 20, y: py },
          'target-top':    { x: px, y: py - 20 },
        };
      }
      return null;
    };

    type HandlePositions = NonNullable<ReturnType<typeof getHandlePositions>>;

    // Pick the (source, target) handle pair that gives the shortest distance
    const HANDLE_PAIRS: Array<{ source: keyof HandlePositions; target: keyof HandlePositions }> = [
      { source: 'source-right', target: 'target-left' },
      { source: 'source-right', target: 'target-top' },
      { source: 'source-bottom', target: 'target-left' },
      { source: 'source-bottom', target: 'target-top' },
    ];

    const pickHandles = (sourceId: string, targetId: string) => {
      const sp = getHandlePositions(sourceId);
      const tp = getHandlePositions(targetId);
      if (!sp || !tp) return { source: 'source-right', target: 'target-left' };

      let best = HANDLE_PAIRS[0];
      let bestDist = Infinity;
      for (const pair of HANDLE_PAIRS) {
        const s = sp[pair.source];
        const t = tp[pair.target];
        const dist = Math.hypot(s.x - t.x, s.y - t.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = pair;
        }
      }
      return best;
    };

    return Object.values(deck.flow.edges).map((edge) => {
      const source = resolveEdgeSource(deck, edge.from);

      if (source?.type === 'component') {
        // Use source slide's boundary handle positions as proxy for the
        // component badge position to pick the shortest-distance pair
        const sp = getHandlePositions(source.slideId);
        const tp = getHandlePositions(edge.to);
        let linkDir = 'r';
        let targetHandle = 'target-left';
        if (sp && tp) {
          const LINK_PAIRS = [
            { dir: 'r', source: 'source-right' as const, target: 'target-left' as const },
            { dir: 'r', source: 'source-right' as const, target: 'target-top' as const },
            { dir: 'b', source: 'source-bottom' as const, target: 'target-left' as const },
            { dir: 'b', source: 'source-bottom' as const, target: 'target-top' as const },
          ];
          let bestDist = Infinity;
          for (const pair of LINK_PAIRS) {
            const s = sp[pair.source];
            const t = tp[pair.target];
            const dist = Math.hypot(s.x - t.x, s.y - t.y);
            if (dist < bestDist) {
              bestDist = dist;
              linkDir = pair.dir;
              targetHandle = pair.target;
            }
          }
        }
        return {
          id: edge.id,
          source: source.slideId,
          target: edge.to,
          sourceHandle: `link-${linkDir}-${source.componentId}`,
          targetHandle,
          type: 'transition',
          data: {
            transition: edge.transition,
            label: edge.label,
          },
        };
      }

      // Slide or start point edge
      const handles = pickHandles(edge.from, edge.to);
      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        sourceHandle: handles.source,
        targetHandle: handles.target,
        type: 'transition',
        data: {
          transition: edge.transition,
          label: edge.label,
        },
      };
    });
  }, [deck.flow.edges, deck.slides, deck.flow.startPoints, slideHeight]);

  // Use React Flow's state management - initialize with empty, sync via effect
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNodeType>([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([]);

  // Filter out React Flow's automatic edge additions — we manage edge creation
  // ourselves via onConnect + deck state. Without this filter, RF adds a duplicate
  // edge with an RF-generated ID and no data alongside our deck-synced edge.
  const onEdgesChange = useCallback((changes: Parameters<typeof onEdgesChangeBase>[0]) => {
    const filtered = changes.filter(c => c.type !== 'add');
    if (filtered.length > 0) onEdgesChangeBase(filtered);
  }, [onEdgesChangeBase]);

  // Sync nodes and edges when deck changes.
  // Nodes must render before edges so dynamic handles (link-*) exist in the DOM.
  // We sync nodes immediately, then defer edge sync with double rAF to ensure
  // React has committed the node update and handles are painted.
  const deckEdgesRef = useRef(deckEdges);
  deckEdgesRef.current = deckEdges;

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

  // Sync edges after nodes have rendered their handles.
  useEffect(() => {
    // Double rAF: first lets React commit node update, second ensures
    // browser has painted so handles are in the DOM for edge resolution.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const currentDeckEdges = deckEdgesRef.current;
      setEdges((currentEdges) => {
        const selectedIds = new Set(currentEdges.filter(e => e.selected).map(e => e.id));
        return currentDeckEdges.map(edge => ({
          ...edge,
          selected: selectedIds.has(edge.id),
        }));
      });
    }));
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
      if (readOnly) return;
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
    [onUpdateDeck, readOnly]
  );

  // Connection handling
  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      // Skip if this is a reconnection (handled by onReconnect)
      if (isReconnectingRef.current) return;

      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return; // No self-loops

      const edgeId = generateEdgeId();

      // Update deck state - edges will update via deckEdges memo
      onUpdateDeck((d) => {
        const targetId = connection.target!;
        
        const sourceId = connection.source!;
        
        // Enforce single outgoing edge per source (slide, start point, or component)
        let newEdges = { ...d.flow.edges };
        for (const [existingEdgeId, edge] of Object.entries(newEdges)) {
          if (edge.from === sourceId) {
            delete newEdges[existingEdgeId];
          }
        }
        
        // Add the new edge
        newEdges[edgeId] = {
          id: edgeId,
          from: sourceId,
          to: targetId,
          trigger: 'default',
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
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
      if (readOnly) return;
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
                sourceHandle: newConnection.sourceHandle ?? undefined,
                targetHandle: newConnection.targetHandle ?? undefined,
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
        // Find closest target handle based on the edge's source handle
        const sourceHandleId = edge.sourceHandle as string | undefined;
        const targetHandle = sourceHandleId
          ? findClosestTargetHandle(targetNodeId, edge.source, sourceHandleId)
          : null;

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
                  targetHandle: targetHandle ?? undefined,
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

      if (targetNodeId && startInfo.handleId) {
        // Find closest target handle based on source handle position
        const targetHandle = findClosestTargetHandle(targetNodeId, startInfo.nodeId, startInfo.handleId);

        // Create connection via drop-on-node
        onConnect({
          source: startInfo.nodeId,
          sourceHandle: startInfo.handleId,
          target: targetNodeId,
          targetHandle: targetHandle ?? null,
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

        return {
          ...d,
          slides: newSlides,
          flow: {
            ...d.flow,
            edges: newEdges,
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

  const deleteStartPoints = useCallback(
    (startPointIds: string[]) => {
      onUpdateDeck((d) => {
        const startPoints = d.flow.startPoints;
        if (!startPoints) return d;

        const newStartPoints = { ...startPoints };
        const newEdges = { ...d.flow.edges };

        for (const id of startPointIds) {
          delete newStartPoints[id];
          // Also delete edges from this start point
          for (const [edgeId, edge] of Object.entries(newEdges)) {
            if (edge.from === id) {
              delete newEdges[edgeId];
            }
          }
        }

        return {
          ...d,
          flow: {
            ...d.flow,
            startPoints: Object.keys(newStartPoints).length > 0 ? newStartPoints : undefined,
            edges: newEdges,
          },
        };
      });

      clearSelection();
    },
    [onUpdateDeck, clearSelection]
  );

  // Handle node deletion from React Flow
  const onNodesDelete = useCallback(
    (nodesToDelete: CanvasNodeType[]) => {
      const slideIds = nodesToDelete
        .filter((n): n is SlideNodeType => n.type === 'slide')
        .map((n) => n.id);
      if (slideIds.length > 0) {
        deleteSlides(slideIds);
      }

      const startPointIds = nodesToDelete
        .filter((n): n is StartPointNodeType => n.type === 'startPoint')
        .map((n) => n.id);
      if (startPointIds.length > 0) {
        deleteStartPoints(startPointIds);
      }
    },
    [deleteSlides, deleteStartPoints]
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

  // Delete component from slide
  const deleteComponent = useCallback(
    (slideId: string, componentId: string) => {
      onUpdateDeck((d) => {
        const slide = d.slides[slideId];
        if (!slide) return d;

        return {
          ...d,
          slides: {
            ...d.slides,
            [slideId]: {
              ...slide,
              components: slide.components.filter((c) => c.id !== componentId),
            },
          },
        };
      });

      // Clear component selection, keep slide selected
      selectSlide(slideId);
    },
    [onUpdateDeck, selectSlide]
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (readOnly) return;

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

      // Delete/Backspace: delete selected component if one is selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSlideId && selectedComponentId) {
        e.preventDefault();
        e.stopPropagation();
        deleteComponent(selectedSlideId, selectedComponentId);
        return;
      }

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

    // Use capture phase to intercept before React Flow
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [readOnly, addSlide, duplicateSlide, deleteComponent, selectedSlideId, selectedComponentId]);

  return (
    <>
      <ReactFlow
        className={showDetails ? '' : 'zoom-overview'}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={readOnly ? undefined : onNodesDelete}
        onEdgesDelete={readOnly ? undefined : onEdgesDelete}
        onNodeDragStop={readOnly ? undefined : onNodeDragStop}
        onSelectionChange={onSelectionChange}
        onConnect={readOnly ? undefined : onConnect}
        onReconnectStart={readOnly ? undefined : onReconnectStart}
        onReconnect={readOnly ? undefined : onReconnect}
        onReconnectEnd={readOnly ? undefined : onReconnectEnd}
        edgesReconnectable={!readOnly}
        onConnectStart={readOnly ? undefined : onConnectStart}
        onConnectEnd={readOnly ? undefined : onConnectEnd}
        onMoveEnd={onMoveEnd}
        onPaneContextMenu={readOnly ? undefined : onPaneContextMenu}
        onNodeContextMenu={readOnly ? undefined : onNodeContextMenu}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        connectionMode="loose"
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
        elevateEdgesOnSelect
        defaultEdgeOptions={{
          type: 'transition',
          markerEnd: {
            type: MarkerType.Arrow,
            width: 20,
            height: 20,
          },
          style: { zIndex: 1 },
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
          onShare={onShare}
          readOnly={readOnly}
          connectionStatus={connectionStatus}
          connectionError={connectionError}
        />
      </ReactFlow>

      <ContextMenu
        position={contextMenu?.position ?? null}
        targetNode={contextMenu?.targetNode ?? null}
        selectedNodes={selectedNodes}
        selectedComponentId={selectedComponentId ?? null}
        selectedSlideId={selectedSlideId ?? null}
        onClose={closeContextMenu}
        onAddSlide={addSlide}
        onAddStartPoint={addStartPoint}
        onDuplicateSlide={duplicateSlide}
        onDeleteSlide={deleteSlides}
        onDeleteComponent={deleteComponent}
      />
    </>
  );
}
