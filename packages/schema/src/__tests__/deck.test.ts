import { describe, it, expect } from 'vitest';
import {
  DeckSchema,
  DeckMetaSchema,
  AspectRatioSchema,
  EdgeSchema,
  FlowSchema,
  DEFAULT_GRID_COLUMNS,
  SLIDE_WIDTH,
  SLIDE_HEIGHTS,
  getSlideHeight,
  createEmptyDeck,
  generateDeckId,
  generateEdgeId,
  validateDeck,
} from '../deck';
import { defaultTheme } from '../theme';

describe('DeckMetaSchema', () => {
  it('validates a valid deck meta', () => {
    const meta = {
      id: 'deck-123',
      title: 'My Presentation',
      description: 'A test deck',
      created: '2024-01-15T10:30:00.000Z',
      updated: '2024-01-15T11:00:00.000Z',
    };
    expect(DeckMetaSchema.parse(meta)).toEqual(meta);
  });

  it('allows optional description', () => {
    const meta = {
      id: 'deck-123',
      title: 'My Presentation',
      created: '2024-01-15T10:30:00.000Z',
      updated: '2024-01-15T10:30:00.000Z',
    };
    expect(DeckMetaSchema.parse(meta)).toEqual(meta);
  });

  it('rejects missing required fields', () => {
    expect(() => DeckMetaSchema.parse({ id: 'deck-123' })).toThrow();
    expect(() => DeckMetaSchema.parse({ title: 'Test' })).toThrow();
  });

  it('rejects invalid datetime format', () => {
    const meta = {
      id: 'deck-123',
      title: 'Test',
      created: 'not-a-date',
      updated: '2024-01-15',
    };
    expect(() => DeckMetaSchema.parse(meta)).toThrow();
  });
});

describe('AspectRatioSchema', () => {
  it('accepts valid aspect ratios', () => {
    expect(AspectRatioSchema.parse('16:9')).toBe('16:9');
    expect(AspectRatioSchema.parse('4:3')).toBe('4:3');
    expect(AspectRatioSchema.parse('16:10')).toBe('16:10');
  });

  it('rejects invalid aspect ratios', () => {
    expect(() => AspectRatioSchema.parse('21:9')).toThrow();
    expect(() => AspectRatioSchema.parse('1:1')).toThrow();
    expect(() => AspectRatioSchema.parse('invalid')).toThrow();
  });
});

describe('EdgeSchema', () => {
  it('validates default trigger', () => {
    const edge = {
      id: 'edge-1',
      from: 'slide-1',
      to: 'slide-2',
      trigger: 'default',
    };
    expect(EdgeSchema.parse(edge)).toEqual(edge);
  });

  it('validates button trigger', () => {
    const edge = {
      id: 'edge-1',
      from: 'slide-1',
      to: 'slide-2',
      trigger: 'button:learn-more',
      label: 'Learn More',
    };
    expect(EdgeSchema.parse(edge)).toEqual(edge);
  });

  it('rejects invalid trigger format', () => {
    const edge = {
      id: 'edge-1',
      from: 'slide-1',
      to: 'slide-2',
      trigger: 'invalid-trigger',
    };
    expect(() => EdgeSchema.parse(edge)).toThrow();
  });
});

describe('FlowSchema', () => {
  it('validates a flow with edges', () => {
    const flow = {
      edges: {
        'edge-1': {
          id: 'edge-1',
          from: 'slide-1',
          to: 'slide-2',
          trigger: 'default',
        },
      },
      entrySlide: 'slide-1',
    };
    expect(FlowSchema.parse(flow)).toEqual(flow);
  });

  it('validates empty edges', () => {
    const flow = {
      edges: {},
      entrySlide: 'slide-1',
    };
    expect(FlowSchema.parse(flow)).toEqual(flow);
  });
});

describe('DeckSchema', () => {
  const validDeck = {
    meta: {
      id: 'deck-123',
      title: 'Test Deck',
      created: '2024-01-15T10:00:00.000Z',
      updated: '2024-01-15T10:00:00.000Z',
    },
    theme: defaultTheme,
    aspectRatio: '16:9',
    gridColumns: 8,
    slides: {
      'slide-1': {
        id: 'slide-1',
        title: 'First Slide',
        components: [],
        position: { x: 0, y: 0 },
      },
    },
    flow: {
      edges: {},
      entrySlide: 'slide-1',
    },
  };

  it('validates a complete deck', () => {
    const result = DeckSchema.parse(validDeck);
    expect(result.meta.id).toBe('deck-123');
    expect(result.gridColumns).toBe(8);
  });

  it('defaults aspectRatio to 16:9', () => {
    const deckWithoutAspect = { ...validDeck };
    delete (deckWithoutAspect as Record<string, unknown>).aspectRatio;
    const result = DeckSchema.parse(deckWithoutAspect);
    expect(result.aspectRatio).toBe('16:9');
  });

  it('defaults gridColumns to DEFAULT_GRID_COLUMNS (8)', () => {
    const deckWithoutGrid = { ...validDeck };
    delete (deckWithoutGrid as Record<string, unknown>).gridColumns;
    const result = DeckSchema.parse(deckWithoutGrid);
    expect(result.gridColumns).toBe(DEFAULT_GRID_COLUMNS);
    expect(result.gridColumns).toBe(8);
  });

  it('validates gridColumns range (1-12)', () => {
    expect(DeckSchema.parse({ ...validDeck, gridColumns: 1 }).gridColumns).toBe(1);
    expect(DeckSchema.parse({ ...validDeck, gridColumns: 12 }).gridColumns).toBe(12);
    expect(() => DeckSchema.parse({ ...validDeck, gridColumns: 0 })).toThrow();
    expect(() => DeckSchema.parse({ ...validDeck, gridColumns: 13 })).toThrow();
    expect(() => DeckSchema.parse({ ...validDeck, gridColumns: -1 })).toThrow();
  });

  it('allows optional assets', () => {
    const deckWithAssets = {
      ...validDeck,
      assets: {
        'asset-1': {
          id: 'asset-1',
          filename: 'image.png',
          mimeType: 'image/png',
          size: 1024,
          url: '/uploads/image.png',
          uploaded: '2024-01-15T10:00:00.000Z',
        },
      },
    };
    const result = DeckSchema.parse(deckWithAssets);
    expect(result.assets?.['asset-1'].filename).toBe('image.png');
  });

  it('rejects deck with missing required fields', () => {
    expect(() => DeckSchema.parse({})).toThrow();
    expect(() => DeckSchema.parse({ meta: validDeck.meta })).toThrow();
  });
});

describe('getSlideHeight', () => {
  it('returns correct height for 16:9', () => {
    expect(getSlideHeight('16:9')).toBe(450);
    expect(getSlideHeight('16:9')).toBe(SLIDE_HEIGHTS['16:9']);
  });

  it('returns correct height for 4:3', () => {
    expect(getSlideHeight('4:3')).toBe(600);
  });

  it('returns correct height for 16:10', () => {
    expect(getSlideHeight('16:10')).toBe(500);
  });
});

describe('SLIDE_WIDTH', () => {
  it('is 800', () => {
    expect(SLIDE_WIDTH).toBe(800);
  });
});

describe('generateDeckId', () => {
  it('generates ID with deck- prefix', () => {
    const id = generateDeckId();
    expect(id).toMatch(/^deck-[a-f0-9]{8}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateDeckId()));
    expect(ids.size).toBe(100);
  });
});

describe('generateEdgeId', () => {
  it('generates ID with edge- prefix', () => {
    const id = generateEdgeId();
    expect(id).toMatch(/^edge-[a-f0-9]{8}$/);
  });
});

describe('createEmptyDeck', () => {
  it('creates a deck with default title', () => {
    const deck = createEmptyDeck();
    expect(deck.meta.title).toBe('Untitled Deck');
  });

  it('creates a deck with custom title', () => {
    const deck = createEmptyDeck('My Presentation');
    expect(deck.meta.title).toBe('My Presentation');
  });

  it('creates a deck with valid structure', () => {
    const deck = createEmptyDeck();
    const result = DeckSchema.safeParse(deck);
    expect(result.success).toBe(true);
  });

  it('creates a deck with one slide', () => {
    const deck = createEmptyDeck();
    const slideIds = Object.keys(deck.slides);
    expect(slideIds).toHaveLength(1);
  });

  it('creates a deck with entry slide matching the created slide', () => {
    const deck = createEmptyDeck();
    const slideIds = Object.keys(deck.slides);
    expect(deck.flow.entrySlide).toBe(slideIds[0]);
  });

  it('creates a deck with default gridColumns', () => {
    const deck = createEmptyDeck();
    expect(deck.gridColumns).toBe(DEFAULT_GRID_COLUMNS);
  });

  it('creates a deck with default theme', () => {
    const deck = createEmptyDeck();
    expect(deck.theme.id).toBe('default');
  });

  it('creates a slide with a title component', () => {
    const deck = createEmptyDeck('Test');
    const slideId = Object.keys(deck.slides)[0];
    const slide = deck.slides[slideId];
    expect(slide.components).toHaveLength(1);
    expect(slide.components[0].type).toBe('deck-title');
    expect(slide.components[0].props.text).toBe('Test');
  });
});

describe('validateDeck', () => {
  it('returns success for valid deck', () => {
    const deck = createEmptyDeck();
    const result = validateDeck(deck);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.meta.title).toBe('Untitled Deck');
    }
  });

  it('returns errors for invalid deck', () => {
    const result = validateDeck({ invalid: 'data' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toBeDefined();
    }
  });

  it('returns errors for partial deck', () => {
    const result = validateDeck({ meta: { id: 'test' } });
    expect(result.success).toBe(false);
  });
});
