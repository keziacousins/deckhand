/**
 * Diff algorithm for Deck domain model.
 *
 * Produces minimal patches by comparing old and new Deck states.
 * All array items are matched by ID (not index) for concurrent edit safety.
 *
 * Adapted from ProcessFactory Studio's collaboration/diff.ts
 */

import type { Deck } from '@deckhand/schema';

/**
 * A path segment is either:
 * - A string key for object properties (e.g., 'title', 'position')
 * - An ID reference for map/array items (e.g., { id: 'slide-1' })
 */
export type PathSegment = string | { id: string };

/**
 * Patch operations:
 * - 'set': Set a value (object property or replace item)
 * - 'delete': Delete an object property or map entry
 * - 'insert': Insert a new item
 * - 'remove': Remove an item
 * - 'reorder': Reorder items in an array (value is array of IDs in new order)
 */
export type PatchOp = 'set' | 'delete' | 'insert' | 'remove' | 'reorder';

/**
 * A patch describes a single change to apply to the Y.Doc.
 */
export interface Patch {
  /** Path to the changed value using ID references for items */
  path: PathSegment[];

  /** Operation type */
  op: PatchOp;

  /** New value (for 'set' and 'insert') */
  value?: unknown;
}

/**
 * Diff two Deck states and produce minimal patches.
 */
export function diffDeck(prev: Deck, next: Deck): Patch[] {
  const patches: Patch[] = [];
  diffValue([], prev, next, patches);
  return patches;
}

/**
 * Recursively diff two values and accumulate patches.
 */
function diffValue(
  path: PathSegment[],
  prev: unknown,
  next: unknown,
  patches: Patch[]
): void {
  // Same reference - no change
  if (prev === next) return;

  // Both nullish - no change
  if (prev == null && next == null) return;

  // Type changed or one is null/undefined
  if (typeof prev !== typeof next || prev === null || next === null) {
    patches.push({ path, op: 'set', value: next });
    return;
  }

  // Arrays
  if (Array.isArray(prev) && Array.isArray(next)) {
    diffArray(path, prev, next, patches);
    return;
  }

  // Objects (but not arrays)
  if (typeof prev === 'object' && typeof next === 'object') {
    diffObject(
      path,
      prev as Record<string, unknown>,
      next as Record<string, unknown>,
      patches
    );
    return;
  }

  // Primitives (string, number, boolean)
  if (prev !== next) {
    patches.push({ path, op: 'set', value: next });
  }
}

/**
 * Diff two objects and accumulate patches for changed/added/removed keys.
 */
function diffObject(
  path: PathSegment[],
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  patches: Patch[]
): void {
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of allKeys) {
    const prevVal = prev[key];
    const nextVal = next[key];

    if (!(key in next) || nextVal === undefined) {
      // Key removed
      if (key in prev && prevVal !== undefined) {
        patches.push({ path: [...path, key], op: 'delete' });
      }
    } else if (!(key in prev) || prevVal === undefined) {
      // Key added
      patches.push({ path: [...path, key], op: 'set', value: nextVal });
    } else {
      // Key exists in both - recurse
      diffValue([...path, key], prevVal, nextVal, patches);
    }
  }
}

/**
 * Check if an array should be treated atomically (replaced wholesale).
 * This includes:
 * - Primitive arrays (strings, numbers, booleans)
 * - Arrays of objects without 'id' fields (e.g., rich text spans)
 */
function isAtomicArray(arr: unknown[]): boolean {
  if (arr.length === 0) return false;
  return arr.every((item) => {
    // Primitives are atomic
    if (
      item === null ||
      item === undefined ||
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean'
    ) {
      return true;
    }
    // Objects without 'id' field are atomic (e.g., rich text spans)
    if (typeof item === 'object' && !('id' in (item as Record<string, unknown>))) {
      return true;
    }
    return false;
  });
}

/**
 * Check if two atomic arrays are equal using deep comparison.
 */
function atomicArraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Diff two arrays using ID-based matching for object arrays,
 * or atomic comparison for arrays without IDs.
 */
function diffArray(
  path: PathSegment[],
  prev: unknown[],
  next: unknown[],
  patches: Patch[]
): void {
  // Handle atomic arrays as wholesale values
  if (isAtomicArray(prev) || isAtomicArray(next)) {
    if (!atomicArraysEqual(prev, next)) {
      patches.push({ path, op: 'set', value: next });
    }
    return;
  }

  // Build ID maps and order arrays for object arrays
  const prevById = new Map<string, unknown>();
  const nextById = new Map<string, unknown>();
  const prevOrder: string[] = [];
  const nextOrder: string[] = [];

  for (const item of prev) {
    const id = getItemId(item);
    if (id) {
      prevById.set(id, item);
      prevOrder.push(id);
    }
  }

  for (const item of next) {
    const id = getItemId(item);
    if (id) {
      nextById.set(id, item);
      nextOrder.push(id);
    }
  }

  // Removed items
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) {
      patches.push({ path: [...path, { id }], op: 'remove' });
    }
  }

  // Added items
  for (const [id, item] of nextById) {
    if (!prevById.has(id)) {
      patches.push({ path: [...path, { id }], op: 'insert', value: item });
    }
  }

  // Changed items - recurse
  for (const [id, nextItem] of nextById) {
    const prevItem = prevById.get(id);
    if (prevItem !== undefined) {
      diffValue([...path, { id }], prevItem, nextItem, patches);
    }
  }

  // Check for reordering
  const commonPrevOrder = prevOrder.filter((id) => nextById.has(id));
  const commonNextOrder = nextOrder.filter((id) => prevById.has(id));

  if (commonPrevOrder.length > 0 && !arraysEqual(commonPrevOrder, commonNextOrder)) {
    patches.push({ path, op: 'reorder', value: nextOrder });
  }
}

/**
 * Check if two string arrays are equal.
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Extract the 'id' field from an item, if present.
 */
function getItemId(item: unknown): string | null {
  if (item && typeof item === 'object' && 'id' in item) {
    const id = (item as Record<string, unknown>).id;
    if (typeof id === 'string') {
      return id;
    }
  }
  return null;
}
