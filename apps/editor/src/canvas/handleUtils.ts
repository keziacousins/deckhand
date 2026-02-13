/**
 * Handle Utilities
 *
 * DOM-based utilities for finding the closest handle on a node.
 * Used for drop-on-node connections and reconnection to automatically
 * select the best handle based on geometric proximity.
 *
 * Adapted from reference-code/processfactory-studio/apps/modeler/src/utils/handleUtils.ts
 */

const TARGET_HANDLE_IDS = ['target-left', 'target-top'];
const SOURCE_HANDLE_IDS = ['source-right', 'source-bottom'];

function isSourceHandle(handleId: string): boolean {
  return SOURCE_HANDLE_IDS.includes(handleId);
}

function getHandleCenter(handle: Element): { x: number; y: number } {
  const rect = handle.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Find the closest target handle on a node relative to a source handle's position.
 */
export function findClosestTargetHandle(
  targetNodeId: string,
  sourceNodeId: string,
  sourceHandleId: string
): string | null {
  const sourceNodeEl = document.querySelector(`[data-id="${sourceNodeId}"]`);
  if (!sourceNodeEl) return null;

  const sourceHandle = sourceNodeEl.querySelector(`[data-handleid="${sourceHandleId}"]`);
  if (!sourceHandle) return null;

  const sourcePos = getHandleCenter(sourceHandle);

  const targetNodeEl = document.querySelector(`[data-id="${targetNodeId}"]`);
  if (!targetNodeEl) return null;

  const targetHandles = targetNodeEl.querySelectorAll('.react-flow__handle.target[data-handleid]');
  if (targetHandles.length === 0) return null;

  let closest: string | null = null;
  let minDist = Infinity;

  targetHandles.forEach((handle) => {
    const handleId = handle.getAttribute('data-handleid');
    if (!handleId || !TARGET_HANDLE_IDS.includes(handleId)) return;

    const pos = getHandleCenter(handle);
    const dist = Math.hypot(sourcePos.x - pos.x, sourcePos.y - pos.y);
    if (dist < minDist) {
      minDist = dist;
      closest = handleId;
    }
  });

  return closest;
}

/**
 * Find the closest source handle on a node relative to a target handle's position.
 * Used when reconnecting the source end of an edge.
 */
export function findClosestSourceHandle(
  sourceNodeId: string,
  targetNodeId: string,
  targetHandleId: string
): string | null {
  const targetNodeEl = document.querySelector(`[data-id="${targetNodeId}"]`);
  if (!targetNodeEl) return null;

  const targetHandle = targetNodeEl.querySelector(`[data-handleid="${targetHandleId}"]`);
  if (!targetHandle) return null;

  const targetPos = getHandleCenter(targetHandle);

  const sourceNodeEl = document.querySelector(`[data-id="${sourceNodeId}"]`);
  if (!sourceNodeEl) return null;

  const sourceHandles = sourceNodeEl.querySelectorAll('.react-flow__handle.source[data-handleid]');
  if (sourceHandles.length === 0) return null;

  let closest: string | null = null;
  let minDist = Infinity;

  sourceHandles.forEach((handle) => {
    const handleId = handle.getAttribute('data-handleid');
    if (!handleId || !isSourceHandle(handleId)) return;

    const pos = getHandleCenter(handle);
    const dist = Math.hypot(targetPos.x - pos.x, targetPos.y - pos.y);
    if (dist < minDist) {
      minDist = dist;
      closest = handleId;
    }
  });

  return closest;
}
