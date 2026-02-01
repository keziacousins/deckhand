import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

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
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as TransitionEdgeData | undefined;
  const hasCustomTransition = edgeData?.transition !== undefined;

  // Position badge at fixed distance from source along the initial axis
  // Smoothstep edges go horizontally from left/right handles, vertically from top/bottom
  const BADGE_OFFSET = 40;
  let badgeX = sourceX;
  let badgeY = sourceY;
  
  if (sourcePosition === 'left') {
    badgeX = sourceX - BADGE_OFFSET;
  } else if (sourcePosition === 'right') {
    badgeX = sourceX + BADGE_OFFSET;
  } else if (sourcePosition === 'top') {
    badgeY = sourceY - BADGE_OFFSET;
  } else if (sourcePosition === 'bottom') {
    badgeY = sourceY + BADGE_OFFSET;
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} />
      {hasCustomTransition && (
        <EdgeLabelRenderer>
          <div
            className={`edge-transition-badge ${selected ? 'selected' : ''}`}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${badgeX}px, ${badgeY}px)`,
              pointerEvents: 'all',
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
