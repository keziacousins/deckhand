/**
 * Y.Doc utility functions for converting between plain JS values and Y.js types.
 *
 * These utilities create nested Y.Map/Y.Array structures that mirror the domain
 * model hierarchy, enabling granular CRDT operations instead of opaque blob replacement.
 *
 * Adapted from ProcessFactory Studio's collaboration/yDocUtils.ts
 */

import * as Y from 'yjs';
import type { Deck } from '@deckhand/schema';

/**
 * Convert a plain JS value to a Y.js value.
 *
 * - Objects → Y.Map (recursive)
 * - Arrays → Y.Array (recursive)
 * - Primitives → as-is
 * - Date → ISO string
 * - null/undefined → as-is
 */
export function toYValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    const yArray = new Y.Array();
    if (value.length > 0) {
      yArray.push(value.map((item) => toYValue(item)));
    }
    return yArray;
  }

  if (typeof value === 'object') {
    const yMap = new Y.Map();
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        yMap.set(k, toYValue(v));
      }
    }
    return yMap;
  }

  // Primitive (string, number, boolean)
  return value;
}

/**
 * Convert a Y.js value back to plain JS.
 *
 * - Y.Map → plain object (recursive)
 * - Y.Array → plain array (recursive)
 * - Primitives → as-is
 */
export function fromYValue(value: unknown): unknown {
  if (value instanceof Y.Map) {
    const result: Record<string, unknown> = {};
    value.forEach((v, k) => {
      result[k] = fromYValue(v);
    });
    return result;
  }

  if (value instanceof Y.Array) {
    return value.toArray().map((item) => fromYValue(item));
  }

  // Primitive, null, or undefined
  return value;
}

/**
 * Initialize a Y.Doc with a Deck structure.
 * The deck is stored under a 'root' Y.Map.
 */
export function deckToYDoc(deck: Deck, ydoc?: Y.Doc): Y.Doc {
  const doc = ydoc ?? new Y.Doc();

  doc.transact(() => {
    const root = doc.getMap('root');

    // Clear existing data
    root.forEach((_, key) => root.delete(key));

    // Set each top-level key
    root.set('meta', toYValue(deck.meta));
    root.set('theme', toYValue(deck.theme));
    root.set('aspectRatio', deck.aspectRatio);
    root.set('gridColumns', deck.gridColumns);
    if (deck.defaultBackdropSlideId) {
      root.set('defaultBackdropSlideId', deck.defaultBackdropSlideId);
    }
    root.set('slides', toYValue(deck.slides));
    root.set('flow', toYValue(deck.flow));
    if (deck.assets) {
      root.set('assets', toYValue(deck.assets));
    }
  });

  return doc;
}

/**
 * Extract a Deck from a Y.Doc.
 */
export function yDocToDeck(ydoc: Y.Doc): Deck {
  const root = ydoc.getMap('root');

  const deck: Deck = {
    meta: fromYValue(root.get('meta')),
    theme: fromYValue(root.get('theme')),
    aspectRatio: (root.get('aspectRatio') as string) || '16:9',
    gridColumns: (root.get('gridColumns') as number) || 8,
    slides: fromYValue(root.get('slides')),
    flow: fromYValue(root.get('flow')),
    assets: fromYValue(root.get('assets')),
  } as Deck;

  const defaultBackdropSlideId = root.get('defaultBackdropSlideId') as string | undefined;
  if (defaultBackdropSlideId) {
    deck.defaultBackdropSlideId = defaultBackdropSlideId;
  }

  return deck;
}

/**
 * Compute a hash of a deck for consistency checking.
 * Uses a stable JSON stringification.
 */
export async function hashDeck(deck: Deck): Promise<string> {
  const json = JSON.stringify(deck, Object.keys(deck).sort());
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
