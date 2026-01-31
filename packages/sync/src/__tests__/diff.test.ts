import { describe, it, expect } from 'vitest';
import { diffDeck, type Patch } from '../diff';
import { createEmptyDeck, type Deck } from '@deckhand/schema';

function createTestDeck(): Deck {
  return createEmptyDeck('Test Deck');
}

describe('diffDeck', () => {
  describe('identical documents', () => {
    it('returns empty array for identical decks', () => {
      const deck = createTestDeck();
      const patches = diffDeck(deck, deck);
      expect(patches).toEqual([]);
    });

    it('returns empty array for deep equal decks', () => {
      const deck1 = createTestDeck();
      const deck2 = JSON.parse(JSON.stringify(deck1));
      const patches = diffDeck(deck1, deck2);
      expect(patches).toEqual([]);
    });
  });

  describe('meta changes', () => {
    it('detects title change', () => {
      const prev = createTestDeck();
      const next = { ...prev, meta: { ...prev.meta, title: 'New Title' } };
      
      const patches = diffDeck(prev, next);
      expect(patches).toContainEqual({
        path: ['meta', 'title'],
        op: 'set',
        value: 'New Title',
      });
    });

    it('detects description added', () => {
      const prev = createTestDeck();
      const next = { ...prev, meta: { ...prev.meta, description: 'A description' } };
      
      const patches = diffDeck(prev, next);
      expect(patches).toContainEqual({
        path: ['meta', 'description'],
        op: 'set',
        value: 'A description',
      });
    });

    it('detects description removed', () => {
      const prev = createTestDeck();
      prev.meta.description = 'Old description';
      const next = { ...prev, meta: { ...prev.meta, description: undefined } };
      
      const patches = diffDeck(prev, next);
      expect(patches).toContainEqual({
        path: ['meta', 'description'],
        op: 'delete',
      });
    });
  });

  describe('aspectRatio and gridColumns', () => {
    it('detects aspectRatio change', () => {
      const prev = createTestDeck();
      const next = { ...prev, aspectRatio: '4:3' as const };
      
      const patches = diffDeck(prev, next);
      expect(patches).toContainEqual({
        path: ['aspectRatio'],
        op: 'set',
        value: '4:3',
      });
    });

    it('detects gridColumns change', () => {
      const prev = createTestDeck();
      const next = { ...prev, gridColumns: 12 };
      
      const patches = diffDeck(prev, next);
      expect(patches).toContainEqual({
        path: ['gridColumns'],
        op: 'set',
        value: 12,
      });
    });
  });

  describe('slide changes', () => {
    it('detects slide title change', () => {
      const prev = createTestDeck();
      const slideId = Object.keys(prev.slides)[0];
      const next = {
        ...prev,
        slides: {
          ...prev.slides,
          [slideId]: { ...prev.slides[slideId], title: 'New Slide Title' },
        },
      };
      
      const patches = diffDeck(prev, next);
      expect(patches).toContainEqual({
        path: ['slides', slideId, 'title'],
        op: 'set',
        value: 'New Slide Title',
      });
    });

    it('detects slide notes added', () => {
      const prev = createTestDeck();
      const slideId = Object.keys(prev.slides)[0];
      const next = {
        ...prev,
        slides: {
          ...prev.slides,
          [slideId]: { ...prev.slides[slideId], notes: 'Speaker notes' },
        },
      };
      
      const patches = diffDeck(prev, next);
      expect(patches).toContainEqual({
        path: ['slides', slideId, 'notes'],
        op: 'set',
        value: 'Speaker notes',
      });
    });

    it('detects slide position change', () => {
      const prev = createTestDeck();
      const slideId = Object.keys(prev.slides)[0];
      const next = {
        ...prev,
        slides: {
          ...prev.slides,
          [slideId]: { ...prev.slides[slideId], position: { x: 100, y: 200 } },
        },
      };
      
      const patches = diffDeck(prev, next);
      expect(patches.some(p => 
        p.path[0] === 'slides' && p.path[1] === slideId && p.path[2] === 'position'
      )).toBe(true);
    });

    it('detects new slide added', () => {
      const prev = createTestDeck();
      const newSlideId = 'slide-new';
      const next = {
        ...prev,
        slides: {
          ...prev.slides,
          [newSlideId]: {
            id: newSlideId,
            title: 'New Slide',
            components: [],
            position: { x: 900, y: 0 },
          },
        },
      };
      
      const patches = diffDeck(prev, next);
      expect(patches).toContainEqual({
        path: ['slides', newSlideId],
        op: 'set',
        value: next.slides[newSlideId],
      });
    });

    it('detects slide removed', () => {
      const prev = createTestDeck();
      const slideId = Object.keys(prev.slides)[0];
      const next = { ...prev, slides: {} };
      
      const patches = diffDeck(prev, next);
      expect(patches).toContainEqual({
        path: ['slides', slideId],
        op: 'delete',
      });
    });
  });

  describe('component changes', () => {
    it('detects component prop change', () => {
      const prev = createTestDeck();
      const slideId = Object.keys(prev.slides)[0];
      const compId = prev.slides[slideId].components[0].id;
      
      const next = {
        ...prev,
        slides: {
          ...prev.slides,
          [slideId]: {
            ...prev.slides[slideId],
            components: [
              {
                ...prev.slides[slideId].components[0],
                props: { ...prev.slides[slideId].components[0].props, text: 'Updated Title' },
              },
            ],
          },
        },
      };
      
      const patches = diffDeck(prev, next);
      // The diff produces a patch for the 'text' property change
      expect(patches.some(p => 
        p.op === 'set' && 
        p.path.includes('props') &&
        p.path.includes('text') &&
        p.value === 'Updated Title'
      )).toBe(true);
    });

    it('detects component added', () => {
      const prev = createTestDeck();
      const slideId = Object.keys(prev.slides)[0];
      const newComp = {
        id: 'comp-new',
        type: 'deck-title' as const,
        props: { text: 'New Component' },
      };
      
      const next = {
        ...prev,
        slides: {
          ...prev.slides,
          [slideId]: {
            ...prev.slides[slideId],
            components: [...prev.slides[slideId].components, newComp],
          },
        },
      };
      
      const patches = diffDeck(prev, next);
      expect(patches.some(p => 
        p.op === 'insert' && 
        JSON.stringify(p.path).includes('comp-new')
      )).toBe(true);
    });

    it('detects component removed', () => {
      const prev = createTestDeck();
      const slideId = Object.keys(prev.slides)[0];
      const compId = prev.slides[slideId].components[0].id;
      
      const next = {
        ...prev,
        slides: {
          ...prev.slides,
          [slideId]: {
            ...prev.slides[slideId],
            components: [],
          },
        },
      };
      
      const patches = diffDeck(prev, next);
      expect(patches.some(p => 
        p.op === 'remove' && 
        JSON.stringify(p.path).includes(compId)
      )).toBe(true);
    });

    it('detects gridWidth added to component', () => {
      const prev = createTestDeck();
      const slideId = Object.keys(prev.slides)[0];
      const compId = prev.slides[slideId].components[0].id;
      
      const next = {
        ...prev,
        slides: {
          ...prev.slides,
          [slideId]: {
            ...prev.slides[slideId],
            components: [
              {
                ...prev.slides[slideId].components[0],
                props: { ...prev.slides[slideId].components[0].props, gridWidth: 6 },
              },
            ],
          },
        },
      };
      
      const patches = diffDeck(prev, next);
      expect(patches.some(p => 
        p.op === 'set' && 
        JSON.stringify(p.path).includes('gridWidth')
      )).toBe(true);
    });
  });

  describe('array reordering', () => {
    it('detects component reorder', () => {
      const prev = createTestDeck();
      const slideId = Object.keys(prev.slides)[0];
      
      // Add two more components
      const comp1 = prev.slides[slideId].components[0];
      const comp2 = { id: 'comp-2', type: 'deck-title' as const, props: { text: 'Second' } };
      const comp3 = { id: 'comp-3', type: 'deck-title' as const, props: { text: 'Third' } };
      
      prev.slides[slideId].components = [comp1, comp2, comp3];
      
      // Reorder: move comp3 to beginning
      const next = {
        ...prev,
        slides: {
          ...prev.slides,
          [slideId]: {
            ...prev.slides[slideId],
            components: [comp3, comp1, comp2],
          },
        },
      };
      
      const patches = diffDeck(prev, next);
      expect(patches.some(p => p.op === 'reorder')).toBe(true);
    });
  });

  describe('nested object changes', () => {
    it('detects theme token change', () => {
      const prev = createTestDeck();
      const next = {
        ...prev,
        theme: {
          ...prev.theme,
          tokens: {
            ...prev.theme.tokens,
            'color-accent': '#ff0000',
          },
        },
      };
      
      const patches = diffDeck(prev, next);
      expect(patches).toContainEqual({
        path: ['theme', 'tokens', 'color-accent'],
        op: 'set',
        value: '#ff0000',
      });
    });

    it('detects flow edge added', () => {
      const prev = createTestDeck();
      const next = {
        ...prev,
        flow: {
          ...prev.flow,
          edges: {
            'edge-1': {
              id: 'edge-1',
              from: 'slide-1',
              to: 'slide-2',
              trigger: 'default',
            },
          },
        },
      };
      
      const patches = diffDeck(prev, next);
      expect(patches).toContainEqual({
        path: ['flow', 'edges', 'edge-1'],
        op: 'set',
        value: next.flow.edges['edge-1'],
      });
    });
  });

  describe('atomic arrays (rich text)', () => {
    it('replaces atomic arrays wholesale', () => {
      // Rich text arrays have no IDs, so they're treated atomically
      const prev = createTestDeck();
      const slideId = Object.keys(prev.slides)[0];
      
      // Add a text component with rich text
      prev.slides[slideId].components.push({
        id: 'text-comp',
        type: 'deck-text' as any,
        props: { content: [{ text: 'Hello' }] },
      });
      
      const next = JSON.parse(JSON.stringify(prev));
      next.slides[slideId].components[1].props.content = [
        { text: 'Hello ' },
        { text: 'World', bold: true },
      ];
      
      const patches = diffDeck(prev, next);
      // Should replace the entire content array, not individual spans
      expect(patches.some(p => 
        p.op === 'set' && 
        Array.isArray(p.value) &&
        (p.value as unknown[]).length === 2
      )).toBe(true);
    });

    it('does not diff individual list items (strings)', () => {
      const prev = createTestDeck();
      const slideId = Object.keys(prev.slides)[0];
      
      // Add a list component
      prev.slides[slideId].components.push({
        id: 'list-comp',
        type: 'deck-list' as any,
        props: { items: ['One', 'Two', 'Three'] },
      });
      
      const next = JSON.parse(JSON.stringify(prev));
      next.slides[slideId].components[1].props.items = ['One', 'Two Modified', 'Three'];
      
      const patches = diffDeck(prev, next);
      // Should replace items array wholesale
      expect(patches.some(p => 
        p.op === 'set' && 
        Array.isArray(p.value) &&
        (p.value as string[]).includes('Two Modified')
      )).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles null to value change', () => {
      const prev = createTestDeck();
      (prev as any).nullField = null;
      const next = { ...prev };
      (next as any).nullField = 'now has value';
      
      const patches = diffDeck(prev, next);
      expect(patches).toContainEqual({
        path: ['nullField'],
        op: 'set',
        value: 'now has value',
      });
    });

    it('handles value to null change', () => {
      const prev = createTestDeck();
      (prev as any).someField = 'has value';
      const next = { ...prev };
      (next as any).someField = null;
      
      const patches = diffDeck(prev, next);
      expect(patches).toContainEqual({
        path: ['someField'],
        op: 'set',
        value: null,
      });
    });

    it('handles empty objects', () => {
      const prev = createTestDeck();
      const next = { ...prev, assets: {} };
      
      const patches = diffDeck(prev, next);
      // assets: {} should not generate patches if prev.assets is also empty or undefined
      const assetPatches = patches.filter(p => p.path[0] === 'assets');
      // Both are effectively empty, no patch needed
      expect(assetPatches.length).toBeLessThanOrEqual(1);
    });

    it('handles deeply nested changes', () => {
      const prev = createTestDeck();
      const slideId = Object.keys(prev.slides)[0];
      
      // Create deep nesting
      prev.slides[slideId].layout = {
        margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' },
      };
      
      const next = JSON.parse(JSON.stringify(prev));
      next.slides[slideId].layout.margin.top = '20px';
      
      const patches = diffDeck(prev, next);
      expect(patches.some(p => 
        p.path.includes('margin') && p.path.includes('top') && p.value === '20px'
      )).toBe(true);
    });
  });
});
