import { memo, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

/** Sample a point on an SVG path at a given distance from the end */
function getPointNearEnd(pathD: string, distFromEnd: number): { x: number; y: number } | null {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  const totalLen = path.getTotalLength();
  if (totalLen === 0) return null;
  const at = Math.max(0, totalLen - distFromEnd);
  const pt = path.getPointAtLength(at);
  return { x: pt.x, y: pt.y };
}

export interface TransitionEdgeData extends Record<string, unknown> {
  transition?: string;
  label?: string;
}

/**
 * TransitionEdge: Custom edge that shows a transition badge when a custom transition is set
 */
export const TransitionEdge = memo(function TransitionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.55,
  });

  const edgeData = data as TransitionEdgeData | undefined;
  const hasCustomTransition = edgeData?.transition !== undefined;

  // Position badge 50px from the target end, on the actual curve
  const badgePos = useMemo(() => getPointNearEnd(edgePath, 50), [edgePath]);
  const bx = badgePos?.x ?? labelX;
  const by = badgePos?.y ?? labelY;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} />
      {hasCustomTransition && (
        <EdgeLabelRenderer>
          <div
            className={`edge-transition-badge ${selected ? 'selected' : ''}`}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${bx}px, ${by}px)`,
              pointerEvents: 'all',
              zIndex: 1000,
            }}
            title={`Transition: ${edgeData.transition}`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z" />
            </svg>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
