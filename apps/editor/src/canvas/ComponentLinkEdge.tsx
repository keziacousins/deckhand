import { memo } from 'react';
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

/**
 * ComponentLinkEdge: Dashed edge for component-to-slide links.
 * Visually distinct from solid TransitionEdge.
 */
export const ComponentLinkEdge = memo(function ComponentLinkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
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

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: selected ? 'var(--interactive-primary)' : 'var(--node-border)',
        strokeWidth: 2,
        strokeDasharray: '6 4',
      }}
    />
  );
});
