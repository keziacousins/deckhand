/**
 * Apply patches to a Y.Doc.
 *
 * Patches use ID-based paths, which are resolved to actual indices
 * at apply-time. This ensures patches remain valid even if concurrent
 * edits have changed array order.
 *
 * Adapted from ProcessFactory Studio's collaboration/applyPatches.ts
 */

import * as Y from 'yjs';
import type { Patch, PathSegment } from './diff';
import { toYValue, fromYValue } from './ydoc';

/**
 * Root-level keys in a Deck document
 */

/**
 * Apply a list of patches to a Y.Doc.
 * Should be called within a Y.transact() for efficiency.
 */
export function applyPatchesToYDoc(patches: Patch[], ydoc: Y.Doc): void {
  for (const patch of patches) {
    applyPatch(patch, ydoc);
  }
}

/**
 * Apply a single patch to a Y.Doc.
 */
function applyPatch(patch: Patch, ydoc: Y.Doc): void {
  const { path, op, value } = patch;

  if (path.length === 0) {
    throw new Error('Cannot apply patch to root');
  }

  // Navigate to parent and apply operation
  const parentPath = path.slice(0, -1);
  const lastSegment = path[path.length - 1];

  // Special case: top-level keys (meta, theme, slides, flow, assets)
  if (path.length === 1 && typeof lastSegment === 'string') {
    const rootMap = ydoc.getMap('root');
    if (op === 'set') {
      rootMap.set(lastSegment, toYValue(value));
    } else if (op === 'delete') {
      rootMap.delete(lastSegment);
    } else {
      throw new Error(`Invalid op '${op}' for root-level key`);
    }
    return;
  }

  const parent = navigateToPath(ydoc, parentPath);

  if (parent instanceof Y.Map) {
    if (typeof lastSegment !== 'string') {
      throw new Error('Expected string key for Y.Map');
    }
    switch (op) {
      case 'set':
        parent.set(lastSegment, toYValue(value));
        break;
      case 'delete':
        parent.delete(lastSegment);
        break;
      case 'reorder': {
        const arr = parent.get(lastSegment);
        if (arr instanceof Y.Array) {
          reorderYArray(arr, value as string[]);
        } else {
          throw new Error(`Cannot reorder non-array property '${lastSegment}'`);
        }
        break;
      }
      default:
        throw new Error(`Invalid op '${op}' for Y.Map`);
    }
  } else if (parent instanceof Y.Array) {
    if (typeof lastSegment === 'string') {
      throw new Error('Expected ID reference for Y.Array');
    }
    const { id } = lastSegment;

    switch (op) {
      case 'insert':
        parent.push([toYValue(value)]);
        break;
      case 'remove': {
        const removeIdx = findIndexById(parent, id);
        if (removeIdx !== -1) {
          parent.delete(removeIdx, 1);
        }
        break;
      }
      case 'set': {
        const setIdx = findIndexById(parent, id);
        if (setIdx !== -1) {
          parent.delete(setIdx, 1);
          parent.insert(setIdx, [toYValue(value)]);
        }
        break;
      }
      default:
        throw new Error(`Invalid op '${op}' for Y.Array`);
    }
  } else {
    throw new Error(`Cannot apply patch to ${typeof parent}`);
  }
}

/**
 * Find the index of an item in a Y.Array by its ID.
 */
function findIndexById(yArray: Y.Array<unknown>, id: string): number {
  for (let i = 0; i < yArray.length; i++) {
    const item = yArray.get(i);
    if (item instanceof Y.Map && item.get('id') === id) {
      return i;
    }
  }
  return -1;
}

/**
 * Reorder items in a Y.Array to match the specified ID order.
 */
function reorderYArray(yArray: Y.Array<unknown>, newOrder: string[]): void {
  const itemsById = new Map<string, unknown>();
  const existingIds: string[] = [];

  for (let i = 0; i < yArray.length; i++) {
    const item = yArray.get(i);
    if (item instanceof Y.Map) {
      const id = item.get('id') as string;
      if (id) {
        itemsById.set(id, fromYValue(item));
        existingIds.push(id);
      }
    }
  }

  const orderedIds: string[] = [];
  for (const id of newOrder) {
    if (itemsById.has(id)) {
      orderedIds.push(id);
    }
  }
  for (const id of existingIds) {
    if (!orderedIds.includes(id)) {
      orderedIds.push(id);
    }
  }

  let orderChanged = false;
  if (existingIds.length === orderedIds.length) {
    for (let i = 0; i < existingIds.length; i++) {
      if (existingIds[i] !== orderedIds[i]) {
        orderChanged = true;
        break;
      }
    }
  } else {
    orderChanged = true;
  }

  if (!orderChanged) return;

  yArray.delete(0, yArray.length);
  for (const id of orderedIds) {
    const item = itemsById.get(id);
    yArray.push([toYValue(item)]);
  }
}

/**
 * Navigate to a location in the Y.Doc by path.
 */
function navigateToPath(
  ydoc: Y.Doc,
  path: PathSegment[]
): Y.Map<unknown> | Y.Array<unknown> {
  if (path.length === 0) {
    return ydoc.getMap('root');
  }

  const [rootKey, ...rest] = path;
  if (typeof rootKey !== 'string') {
    throw new Error('Root path segment must be a string');
  }

  // All our root keys are maps within the 'root' map
  let current: unknown = ydoc.getMap('root').get(rootKey);

  for (const segment of rest) {
    if (current instanceof Y.Map) {
      if (typeof segment !== 'string') {
        throw new Error('Expected string key for Y.Map navigation');
      }
      current = current.get(segment);
    } else if (current instanceof Y.Array) {
      if (typeof segment === 'string') {
        throw new Error('Expected ID reference for Y.Array navigation');
      }
      const { id } = segment;
      const idx = findIndexById(current, id);
      if (idx === -1) {
        throw new Error(`Item with id '${id}' not found in array`);
      }
      current = current.get(idx);
    } else {
      throw new Error(`Cannot navigate through ${typeof current}`);
    }
  }

  return current as Y.Map<unknown> | Y.Array<unknown>;
}

