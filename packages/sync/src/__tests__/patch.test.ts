import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { applyPatchesToYDoc } from '../patch';
import { deckToYDoc, yDocToDeck } from '../ydoc';
import { diffDeck, type Patch } from '../diff';
import { createEmptyDeck } from '@deckhand/schema';


describe('applyPatchesToYDoc', () => {
  describe('set operations', () => {
    it('sets top-level primitive value', () => {
      const deck = createEmptyDeck();
      const ydoc = deckToYDoc(deck);
      
      const patches: Patch[] = [
        { path: ['aspectRatio'], op: 'set', value: '4:3' },
      ];
      
      ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
      
      const root = ydoc.getMap('root');
      expect(root.get('aspectRatio')).toBe('4:3');
    });

    it('sets nested property', () => {
      const deck = createEmptyDeck();
      const ydoc = deckToYDoc(deck);
      
      const patches: Patch[] = [
        { path: ['meta', 'title'], op: 'set', value: 'New Title' },
      ];
      
      ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
      
      const extracted = yDocToDeck(ydoc);
      expect(extracted.meta.title).toBe('New Title');
    });

    it('sets deeply nested property', () => {
      const deck = createEmptyDeck();
      const ydoc = deckToYDoc(deck);
      
      const patches: Patch[] = [
        { path: ['theme', 'tokens', 'color-accent'], op: 'set', value: '#ff0000' },
      ];
      
      ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
      
      const extracted = yDocToDeck(ydoc);
      expect(extracted.theme.tokens['color-accent']).toBe('#ff0000');
    });

    it('sets object value', () => {
      const deck = createEmptyDeck();
      const slideId = Object.keys(deck.slides)[0];
      const ydoc = deckToYDoc(deck);
      
      const patches: Patch[] = [
        { 
          path: ['slides', slideId, 'position'], 
          op: 'set', 
          value: { x: 500, y: 300 } 
        },
      ];
      
      ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
      
      const extracted = yDocToDeck(ydoc);
      expect(extracted.slides[slideId].position).toEqual({ x: 500, y: 300 });
    });
  });

  describe('delete operations', () => {
    it('deletes top-level key', () => {
      const deck = createEmptyDeck();
      deck.assets = { 'asset-1': { id: 'asset-1', filename: 'test.png', mimeType: 'image/png', size: 100, url: '/test.png', uploaded: new Date().toISOString() } };
      const ydoc = deckToYDoc(deck);
      
      const patches: Patch[] = [
        { path: ['assets'], op: 'delete' },
      ];
      
      ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
      
      const root = ydoc.getMap('root');
      expect(root.has('assets')).toBe(false);
    });

    it('deletes nested property', () => {
      const deck = createEmptyDeck();
      deck.meta.description = 'To be deleted';
      const ydoc = deckToYDoc(deck);
      
      const patches: Patch[] = [
        { path: ['meta', 'description'], op: 'delete' },
      ];
      
      ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
      
      const extracted = yDocToDeck(ydoc);
      expect(extracted.meta.description).toBeUndefined();
    });

    it('deletes slide from slides map', () => {
      const deck = createEmptyDeck();
      const slideId = Object.keys(deck.slides)[0];
      deck.slides['slide-2'] = {
        id: 'slide-2',
        title: 'Second',
        components: [],
        position: { x: 900, y: 0 },
      };
      const ydoc = deckToYDoc(deck);
      
      const patches: Patch[] = [
        { path: ['slides', slideId], op: 'delete' },
      ];
      
      ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
      
      const extracted = yDocToDeck(ydoc);
      expect(Object.keys(extracted.slides)).toEqual(['slide-2']);
    });
  });

  describe('array operations', () => {
    it('inserts item into array', () => {
      const deck = createEmptyDeck();
      const slideId = Object.keys(deck.slides)[0];
      const ydoc = deckToYDoc(deck);
      
      const newComponent = {
        id: 'comp-new',
        type: 'deck-text',
        props: { content: 'New Component' },
      };
      
      const patches: Patch[] = [
        { 
          path: ['slides', slideId, 'components', { id: 'comp-new' }], 
          op: 'insert', 
          value: newComponent 
        },
      ];
      
      ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
      
      const extracted = yDocToDeck(ydoc);
      expect(extracted.slides[slideId].components).toHaveLength(2);
      expect(extracted.slides[slideId].components[1].id).toBe('comp-new');
    });

    it('removes item from array by ID', () => {
      const deck = createEmptyDeck();
      const slideId = Object.keys(deck.slides)[0];
      const compId = deck.slides[slideId].components[0].id;
      const ydoc = deckToYDoc(deck);
      
      const patches: Patch[] = [
        { 
          path: ['slides', slideId, 'components', { id: compId }], 
          op: 'remove' 
        },
      ];
      
      ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
      
      const extracted = yDocToDeck(ydoc);
      expect(extracted.slides[slideId].components).toHaveLength(0);
    });

    it('replaces item in array by ID', () => {
      const deck = createEmptyDeck();
      const slideId = Object.keys(deck.slides)[0];
      const compId = deck.slides[slideId].components[0].id;
      const ydoc = deckToYDoc(deck);
      
      const updatedComponent = {
        id: compId,
        type: 'deck-text',
        props: { content: 'Updated Text', size: 'lg' },
      };
      
      const patches: Patch[] = [
        { 
          path: ['slides', slideId, 'components', { id: compId }], 
          op: 'set', 
          value: updatedComponent 
        },
      ];
      
      ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
      
      const extracted = yDocToDeck(ydoc);
      const comp = extracted.slides[slideId].components[0];
      if (comp.type === 'deck-text') {
        expect(comp.props.content).toBe('Updated Text');
      }
    });
  });

  describe('reorder operations', () => {
    it('reorders items in array', () => {
      const deck = createEmptyDeck();
      const slideId = Object.keys(deck.slides)[0];
      
      // Add more components
      deck.slides[slideId].components = [
        { id: 'comp-1', type: 'deck-text', props: { content: 'First' } },
        { id: 'comp-2', type: 'deck-text', props: { content: 'Second' } },
        { id: 'comp-3', type: 'deck-text', props: { content: 'Third' } },
      ];
      
      const ydoc = deckToYDoc(deck);
      
      // Reorder to: comp-3, comp-1, comp-2
      const patches: Patch[] = [
        { 
          path: ['slides', slideId, 'components'], 
          op: 'reorder', 
          value: ['comp-3', 'comp-1', 'comp-2'] 
        },
      ];
      
      ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
      
      const extracted = yDocToDeck(ydoc);
      expect(extracted.slides[slideId].components.map(c => c.id)).toEqual([
        'comp-3', 'comp-1', 'comp-2'
      ]);
    });
  });
});

describe('diff and apply integration', () => {
  it('applies diffed patches to recreate next state', () => {
    const prev = createEmptyDeck('Original');
    const next = createEmptyDeck('Modified');
    next.meta.title = 'Modified';
    next.aspectRatio = '4:3';
    
    const patches = diffDeck(prev, next);
    const ydoc = deckToYDoc(prev);
    
    ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
    
    const result = yDocToDeck(ydoc);
    expect(result.meta.title).toBe('Modified');
    expect(result.aspectRatio).toBe('4:3');
  });

  it('applies component changes correctly', () => {
    const prev = createEmptyDeck();
    const slideId = Object.keys(prev.slides)[0];
    
    const next = JSON.parse(JSON.stringify(prev));
    next.slides[slideId].components[0].props.content = 'Changed Title';
    next.slides[slideId].components[0].props.gridWidth = 6;
    
    const patches = diffDeck(prev, next);
    const ydoc = deckToYDoc(prev);
    
    ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
    
    const result = yDocToDeck(ydoc);
    const comp = result.slides[slideId].components[0];
    if (comp.type === 'deck-text') {
      expect(comp.props.content).toBe('Changed Title');
      expect(comp.props.gridWidth).toBe(6);
    }
  });

  it('applies multiple patches atomically', () => {
    const prev = createEmptyDeck();
    const slideId = Object.keys(prev.slides)[0];
    
    const next = JSON.parse(JSON.stringify(prev));
    next.meta.title = 'New Title';
    next.meta.description = 'New Description';
    next.slides[slideId].title = 'New Slide Title';
    next.theme.tokens['color-accent'] = '#00ff00';
    
    const patches = diffDeck(prev, next);
    expect(patches.length).toBeGreaterThan(1);
    
    const ydoc = deckToYDoc(prev);
    ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
    
    const result = yDocToDeck(ydoc);
    expect(result.meta.title).toBe('New Title');
    expect(result.meta.description).toBe('New Description');
    expect(result.slides[slideId].title).toBe('New Slide Title');
    expect(result.theme.tokens['color-accent']).toBe('#00ff00');
  });

  it('handles add and remove in same patch set', () => {
    const prev = createEmptyDeck();
    const slideId = Object.keys(prev.slides)[0];
    
    const next = JSON.parse(JSON.stringify(prev));
    // Remove existing component
    next.slides[slideId].components = [];
    // Add new components
    next.slides[slideId].components.push(
      { id: 'new-1', type: 'deck-text', props: { content: 'New 1' } },
      { id: 'new-2', type: 'deck-text', props: { content: 'New 2' } }
    );
    
    const patches = diffDeck(prev, next);
    const ydoc = deckToYDoc(prev);
    
    ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
    
    const result = yDocToDeck(ydoc);
    expect(result.slides[slideId].components).toHaveLength(2);
    expect(result.slides[slideId].components.map(c => c.id)).toEqual(['new-1', 'new-2']);
  });
});

describe('error handling', () => {
  it('throws on patch to root', () => {
    const ydoc = new Y.Doc();
    const patches: Patch[] = [
      { path: [], op: 'set', value: {} },
    ];
    
    expect(() => {
      ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
    }).toThrow('Cannot apply patch to root');
  });

  it('throws on invalid op for Y.Map', () => {
    const deck = createEmptyDeck();
    const ydoc = deckToYDoc(deck);
    
    const patches: Patch[] = [
      { path: ['meta'], op: 'insert', value: {} },
    ];
    
    expect(() => {
      ydoc.transact(() => applyPatchesToYDoc(patches, ydoc));
    }).toThrow();
  });
});
