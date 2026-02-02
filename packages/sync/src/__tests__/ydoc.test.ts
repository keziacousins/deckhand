import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { toYValue, fromYValue, deckToYDoc, yDocToDeck } from '../ydoc';
import { createEmptyDeck, type Deck, DeckSchema } from '@deckhand/schema';

/**
 * Helper to create a Y.Doc and add a value to it, returning the value.
 * Y.js types need to be part of a document before they can be read.
 */
function addToDoc<T>(value: T): T {
  const doc = new Y.Doc();
  const root = doc.getMap('root');
  root.set('value', value);
  return root.get('value') as T;
}

describe('toYValue', () => {
  it('converts null to null', () => {
    expect(toYValue(null)).toBe(null);
  });

  it('converts undefined to undefined', () => {
    expect(toYValue(undefined)).toBe(undefined);
  });

  it('converts string as-is', () => {
    expect(toYValue('hello')).toBe('hello');
  });

  it('converts number as-is', () => {
    expect(toYValue(42)).toBe(42);
    expect(toYValue(3.14)).toBe(3.14);
  });

  it('converts boolean as-is', () => {
    expect(toYValue(true)).toBe(true);
    expect(toYValue(false)).toBe(false);
  });

  it('converts Date to ISO string', () => {
    const date = new Date('2024-01-15T10:30:00.000Z');
    expect(toYValue(date)).toBe('2024-01-15T10:30:00.000Z');
  });

  it('converts array to Y.Array', () => {
    const yArray = addToDoc(toYValue([1, 2, 3])) as Y.Array<number>;
    expect(yArray).toBeInstanceOf(Y.Array);
    expect(yArray.toArray()).toEqual([1, 2, 3]);
  });

  it('converts nested arrays', () => {
    const yArray = addToDoc(toYValue([[1, 2], [3, 4]])) as Y.Array<unknown>;
    expect(yArray).toBeInstanceOf(Y.Array);
    expect(yArray.get(0)).toBeInstanceOf(Y.Array);
  });

  it('converts empty array to empty Y.Array', () => {
    const result = toYValue([]);
    expect(result).toBeInstanceOf(Y.Array);
  });

  it('converts object to Y.Map', () => {
    const yMap = addToDoc(toYValue({ name: 'Alice', age: 30 })) as Y.Map<unknown>;
    expect(yMap).toBeInstanceOf(Y.Map);
    expect(yMap.get('name')).toBe('Alice');
    expect(yMap.get('age')).toBe(30);
  });

  it('converts nested objects', () => {
    const yMap = addToDoc(toYValue({ user: { name: 'Bob' } })) as Y.Map<unknown>;
    expect(yMap).toBeInstanceOf(Y.Map);
    expect(yMap.get('user')).toBeInstanceOf(Y.Map);
  });

  it('omits undefined values in objects', () => {
    const yMap = addToDoc(toYValue({ a: 1, b: undefined, c: 3 })) as Y.Map<unknown>;
    expect(yMap.has('a')).toBe(true);
    expect(yMap.has('b')).toBe(false);
    expect(yMap.has('c')).toBe(true);
  });

  it('converts complex nested structure', () => {
    const obj = {
      slides: {
        'slide-1': {
          id: 'slide-1',
          title: 'Test',
          components: [
            { id: 'comp-1', type: 'deck-title', props: { text: 'Hello' } },
          ],
        },
      },
    };
    const yMap = addToDoc(toYValue(obj)) as Y.Map<unknown>;
    expect(yMap).toBeInstanceOf(Y.Map);
    
    const slides = yMap.get('slides') as Y.Map<unknown>;
    expect(slides).toBeInstanceOf(Y.Map);
    
    const slide = slides.get('slide-1') as Y.Map<unknown>;
    expect(slide).toBeInstanceOf(Y.Map);
    expect(slide.get('id')).toBe('slide-1');
    
    const components = slide.get('components') as Y.Array<unknown>;
    expect(components).toBeInstanceOf(Y.Array);
    expect(components.length).toBe(1);
  });
});

describe('fromYValue', () => {
  it('converts Y.Map to plain object', () => {
    const doc = new Y.Doc();
    const root = doc.getMap('root');
    const yMap = new Y.Map();
    root.set('data', yMap);
    const addedMap = root.get('data') as Y.Map<unknown>;
    addedMap.set('name', 'Charlie');
    addedMap.set('age', 25);
    
    const result = fromYValue(addedMap);
    expect(result).toEqual({ name: 'Charlie', age: 25 });
  });

  it('converts Y.Array to plain array', () => {
    const doc = new Y.Doc();
    const root = doc.getMap('root');
    const yArray = new Y.Array();
    root.set('data', yArray);
    const addedArray = root.get('data') as Y.Array<unknown>;
    addedArray.push(['a', 'b', 'c']);
    
    const result = fromYValue(addedArray);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('converts nested Y structures', () => {
    const doc = new Y.Doc();
    const root = doc.getMap('root');
    
    // Create structure inside doc
    const outerMap = new Y.Map();
    root.set('outer', outerMap);
    const addedOuter = root.get('outer') as Y.Map<unknown>;
    
    const innerMap = new Y.Map();
    addedOuter.set('inner', innerMap);
    const addedInner = addedOuter.get('inner') as Y.Map<unknown>;
    addedInner.set('key', 'value');
    
    const result = fromYValue(addedOuter);
    expect(result).toEqual({ inner: { key: 'value' } });
  });

  it('passes through primitives', () => {
    expect(fromYValue('hello')).toBe('hello');
    expect(fromYValue(42)).toBe(42);
    expect(fromYValue(true)).toBe(true);
    expect(fromYValue(null)).toBe(null);
    expect(fromYValue(undefined)).toBe(undefined);
  });

  it('handles empty Y.Map in doc', () => {
    const doc = new Y.Doc();
    const root = doc.getMap('root');
    root.set('empty', new Y.Map());
    const result = fromYValue(root.get('empty'));
    expect(result).toEqual({});
  });

  it('handles empty Y.Array in doc', () => {
    const doc = new Y.Doc();
    const root = doc.getMap('root');
    root.set('empty', new Y.Array());
    const result = fromYValue(root.get('empty'));
    expect(result).toEqual([]);
  });
});

describe('toYValue/fromYValue round-trip', () => {
  it('round-trips primitives', () => {
    expect(fromYValue(toYValue('test'))).toBe('test');
    expect(fromYValue(toYValue(123))).toBe(123);
    expect(fromYValue(toYValue(true))).toBe(true);
    expect(fromYValue(toYValue(null))).toBe(null);
  });

  it('round-trips arrays via Y.Doc', () => {
    const original = [1, 'two', true, null];
    const yValue = addToDoc(toYValue(original));
    const result = fromYValue(yValue);
    expect(result).toEqual(original);
  });

  it('round-trips objects via Y.Doc', () => {
    const original = { a: 1, b: 'two', c: true };
    const yValue = addToDoc(toYValue(original));
    const result = fromYValue(yValue);
    expect(result).toEqual(original);
  });

  it('round-trips nested structures via Y.Doc', () => {
    const original = {
      users: [
        { id: '1', name: 'Alice', active: true },
        { id: '2', name: 'Bob', active: false },
      ],
      meta: { count: 2, version: '1.0' },
    };
    const yValue = addToDoc(toYValue(original));
    const result = fromYValue(yValue);
    expect(result).toEqual(original);
  });
});

describe('deckToYDoc', () => {
  it('creates a Y.Doc from a deck', () => {
    const deck = createEmptyDeck('My Deck');
    const ydoc = deckToYDoc(deck);
    
    expect(ydoc).toBeInstanceOf(Y.Doc);
    const root = ydoc.getMap('root');
    expect(root.get('meta')).toBeInstanceOf(Y.Map);
    expect(root.get('theme')).toBeInstanceOf(Y.Map);
    expect(root.get('slides')).toBeInstanceOf(Y.Map);
    expect(root.get('flow')).toBeInstanceOf(Y.Map);
  });

  it('stores aspectRatio as primitive', () => {
    const deck = createEmptyDeck();
    const ydoc = deckToYDoc(deck);
    
    const root = ydoc.getMap('root');
    expect(root.get('aspectRatio')).toBe('16:9');
  });

  it('stores meta fields correctly', () => {
    const deck = createEmptyDeck('Test Title');
    const ydoc = deckToYDoc(deck);
    
    const root = ydoc.getMap('root');
    const meta = root.get('meta') as Y.Map<unknown>;
    expect(meta.get('title')).toBe('Test Title');
    expect(meta.get('id')).toMatch(/^deck-/);
  });

  it('stores slides as Y.Map keyed by ID', () => {
    const deck = createEmptyDeck();
    const slideId = Object.keys(deck.slides)[0];
    const ydoc = deckToYDoc(deck);
    
    const root = ydoc.getMap('root');
    const slides = root.get('slides') as Y.Map<unknown>;
    expect(slides.get(slideId)).toBeInstanceOf(Y.Map);
  });

  it('stores components as Y.Array', () => {
    const deck = createEmptyDeck();
    const slideId = Object.keys(deck.slides)[0];
    const ydoc = deckToYDoc(deck);
    
    const root = ydoc.getMap('root');
    const slides = root.get('slides') as Y.Map<unknown>;
    const slide = slides.get(slideId) as Y.Map<unknown>;
    const components = slide.get('components') as Y.Array<unknown>;
    
    expect(components).toBeInstanceOf(Y.Array);
    expect(components.length).toBe(1);
  });

  it('uses provided ydoc if given', () => {
    const existingDoc = new Y.Doc();
    const deck = createEmptyDeck();
    
    const result = deckToYDoc(deck, existingDoc);
    expect(result).toBe(existingDoc);
  });

  it('clears existing data in ydoc', () => {
    const ydoc = new Y.Doc();
    const root = ydoc.getMap('root');
    root.set('oldKey', 'oldValue');
    
    const deck = createEmptyDeck();
    deckToYDoc(deck, ydoc);
    
    expect(root.has('oldKey')).toBe(false);
    expect(root.has('meta')).toBe(true);
  });

  it('stores assets when present', () => {
    const deck = createEmptyDeck();
    deck.assets = {
      'asset-1': {
        id: 'asset-1',
        filename: 'image.png',
        mimeType: 'image/png',
        size: 1024,
        url: '/uploads/image.png',
        uploaded: new Date().toISOString(),
      },
    };
    
    const ydoc = deckToYDoc(deck);
    const root = ydoc.getMap('root');
    const assets = root.get('assets') as Y.Map<unknown>;
    
    expect(assets).toBeInstanceOf(Y.Map);
    expect(assets.get('asset-1')).toBeInstanceOf(Y.Map);
  });
});

describe('yDocToDeck', () => {
  it('extracts deck from Y.Doc', () => {
    const originalDeck = createEmptyDeck('Extracted Deck');
    const ydoc = deckToYDoc(originalDeck);
    const extractedDeck = yDocToDeck(ydoc);
    
    expect(extractedDeck.meta.title).toBe('Extracted Deck');
  });

  it('extracts aspectRatio', () => {
    const originalDeck = createEmptyDeck();
    originalDeck.aspectRatio = '4:3';
    const ydoc = deckToYDoc(originalDeck);
    const extractedDeck = yDocToDeck(ydoc);
    
    expect(extractedDeck.aspectRatio).toBe('4:3');
  });

  it('defaults aspectRatio to 16:9 if missing', () => {
    const ydoc = new Y.Doc();
    const root = ydoc.getMap('root');
    root.set('meta', toYValue({ id: 'deck-1', title: 'Test', created: new Date().toISOString(), updated: new Date().toISOString() }));
    root.set('theme', toYValue({ id: 'default', tokens: {} }));
    root.set('slides', toYValue({}));
    root.set('flow', toYValue({ edges: {} }));
    // No aspectRatio set
    
    const deck = yDocToDeck(ydoc);
    expect(deck.aspectRatio).toBe('16:9');
  });

  it('extracts slides with components', () => {
    const originalDeck = createEmptyDeck();
    const slideId = Object.keys(originalDeck.slides)[0];
    const ydoc = deckToYDoc(originalDeck);
    const extractedDeck = yDocToDeck(ydoc);
    
    expect(extractedDeck.slides[slideId]).toBeDefined();
    expect(extractedDeck.slides[slideId].components.length).toBe(1);
    expect(extractedDeck.slides[slideId].components[0].type).toBe('deck-title');
  });

  it('extracts theme tokens', () => {
    const originalDeck = createEmptyDeck();
    const ydoc = deckToYDoc(originalDeck);
    const extractedDeck = yDocToDeck(ydoc);
    
    expect(extractedDeck.theme.tokens['color-accent']).toBe(originalDeck.theme.tokens['color-accent']);
  });

  it('extracts flow with edges', () => {
    const originalDeck = createEmptyDeck();
    const slideId = Object.keys(originalDeck.slides)[0];
    originalDeck.flow.edges = {
      'edge-1': {
        id: 'edge-1',
        from: slideId,
        to: 'slide-2',
        trigger: 'default',
      },
    };
    
    const ydoc = deckToYDoc(originalDeck);
    const extractedDeck = yDocToDeck(ydoc);
    
    expect(extractedDeck.flow.edges['edge-1']).toBeDefined();
    expect(extractedDeck.flow.edges['edge-1'].trigger).toBe('default');
  });
});

describe('deckToYDoc/yDocToDeck round-trip', () => {
  it('preserves key deck data', () => {
    const originalDeck = createEmptyDeck('Round Trip Test');
    const ydoc = deckToYDoc(originalDeck);
    const extractedDeck = yDocToDeck(ydoc);
    
    // Check key fields are preserved
    expect(extractedDeck.meta.title).toBe(originalDeck.meta.title);
    expect(extractedDeck.meta.id).toBe(originalDeck.meta.id);
    expect(extractedDeck.aspectRatio).toBe(originalDeck.aspectRatio);
    expect(extractedDeck.theme.id).toBe(originalDeck.theme.id);
    expect(Object.keys(extractedDeck.slides)).toEqual(Object.keys(originalDeck.slides));
  });

  it('produces valid deck after round-trip', () => {
    const originalDeck = createEmptyDeck();
    const ydoc = deckToYDoc(originalDeck);
    const extractedDeck = yDocToDeck(ydoc);
    
    // Should pass schema validation
    const result = DeckSchema.safeParse(extractedDeck);
    expect(result.success).toBe(true);
  });

  it('preserves complex deck with multiple slides and components', () => {
    const deck = createEmptyDeck('Complex Deck');
    const slideId = Object.keys(deck.slides)[0];
    
    // Add more components
    deck.slides[slideId].components.push(
      { id: 'comp-2', type: 'deck-title', props: { text: 'Second', gridWidth: 4 } },
      { id: 'comp-3', type: 'deck-headline-subhead', props: { headline: 'Headline', subheading: 'Sub' } }
    );
    
    // Add another slide
    deck.slides['slide-2'] = {
      id: 'slide-2',
      title: 'Second Slide',
      components: [
        { id: 'comp-4', type: 'deck-title', props: { text: 'Slide 2' } },
      ],
      position: { x: 900, y: 0 },
    };
    
    // Add edge
    deck.flow.edges = {
      'edge-1': { id: 'edge-1', from: slideId, to: 'slide-2', trigger: 'default' },
    };
    
    const ydoc = deckToYDoc(deck);
    const extracted = yDocToDeck(ydoc);
    
    expect(Object.keys(extracted.slides)).toHaveLength(2);
    expect(extracted.slides[slideId].components).toHaveLength(3);
    expect(extracted.slides['slide-2'].components).toHaveLength(1);
    expect(Object.keys(extracted.flow.edges)).toHaveLength(1);
  });

  it('preserves gridColumns', () => {
    const deck = createEmptyDeck();
    deck.gridColumns = 12;
    
    const ydoc = deckToYDoc(deck);
    const extracted = yDocToDeck(ydoc);
    
    expect(extracted.gridColumns).toBe(12);
  });

  it('defaults gridColumns to 8 when missing', () => {
    const ydoc = new Y.Doc();
    const root = ydoc.getMap('root');
    root.set('meta', toYValue({ id: 'deck-1', title: 'Test', created: new Date().toISOString(), updated: new Date().toISOString() }));
    root.set('theme', toYValue({ id: 'default', tokens: {} }));
    root.set('aspectRatio', '16:9');
    // gridColumns not set
    root.set('slides', toYValue({}));
    root.set('flow', toYValue({ edges: {} }));
    
    const deck = yDocToDeck(ydoc);
    expect(deck.gridColumns).toBe(8);
  });
});

describe('Y.Doc collaborative editing simulation', () => {
  it('allows modifications after creation', () => {
    const deck = createEmptyDeck();
    const ydoc = deckToYDoc(deck);
    
    // Simulate editing the title
    ydoc.transact(() => {
      const root = ydoc.getMap('root');
      const meta = root.get('meta') as Y.Map<unknown>;
      meta.set('title', 'Modified Title');
    });
    
    const extracted = yDocToDeck(ydoc);
    expect(extracted.meta.title).toBe('Modified Title');
  });

  it('allows adding components', () => {
    const deck = createEmptyDeck();
    const slideId = Object.keys(deck.slides)[0];
    const ydoc = deckToYDoc(deck);
    
    ydoc.transact(() => {
      const root = ydoc.getMap('root');
      const slides = root.get('slides') as Y.Map<unknown>;
      const slide = slides.get(slideId) as Y.Map<unknown>;
      const components = slide.get('components') as Y.Array<unknown>;
      
      components.push([toYValue({
        id: 'new-comp',
        type: 'deck-title',
        props: { text: 'New Component' },
      })]);
    });
    
    const extracted = yDocToDeck(ydoc);
    expect(extracted.slides[slideId].components).toHaveLength(2);
    expect(extracted.slides[slideId].components[1].id).toBe('new-comp');
  });

  it('allows removing components', () => {
    const deck = createEmptyDeck();
    const slideId = Object.keys(deck.slides)[0];
    const ydoc = deckToYDoc(deck);
    
    ydoc.transact(() => {
      const root = ydoc.getMap('root');
      const slides = root.get('slides') as Y.Map<unknown>;
      const slide = slides.get(slideId) as Y.Map<unknown>;
      const components = slide.get('components') as Y.Array<unknown>;
      
      components.delete(0, 1);
    });
    
    const extracted = yDocToDeck(ydoc);
    expect(extracted.slides[slideId].components).toHaveLength(0);
  });
});
