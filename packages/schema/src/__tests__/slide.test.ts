import { describe, it, expect } from 'vitest';
import {
  SlideSchema,
  SlidesMapSchema,
  PositionSchema,
  SpacingSchema,
  GridSchema,
  SlideLayoutSchema,
  SlideStyleSchema,
  BackgroundSizeSchema,
  defaultSlideLayout,
  generateSlideId,
  createBlankSlide,
  layoutToCssProperties,
  styleToCssProperties,
  backgroundSizeToCss,
} from '../slide';

describe('PositionSchema', () => {
  it('validates a valid position', () => {
    const pos = { x: 100, y: 200 };
    expect(PositionSchema.parse(pos)).toEqual(pos);
  });

  it('accepts negative coordinates', () => {
    const pos = { x: -50, y: -100 };
    expect(PositionSchema.parse(pos)).toEqual(pos);
  });

  it('accepts zero coordinates', () => {
    const pos = { x: 0, y: 0 };
    expect(PositionSchema.parse(pos)).toEqual(pos);
  });

  it('rejects missing coordinates', () => {
    expect(() => PositionSchema.parse({ x: 100 })).toThrow();
    expect(() => PositionSchema.parse({ y: 100 })).toThrow();
    expect(() => PositionSchema.parse({})).toThrow();
  });

  it('rejects non-numeric values', () => {
    expect(() => PositionSchema.parse({ x: '100', y: 200 })).toThrow();
  });
});

describe('SpacingSchema', () => {
  it('validates full spacing', () => {
    const spacing = {
      top: '10px',
      right: '20px',
      bottom: '10px',
      left: '20px',
    };
    expect(SpacingSchema.parse(spacing)).toEqual(spacing);
  });

  it('allows partial spacing', () => {
    expect(SpacingSchema.parse({ top: '10px' })).toEqual({ top: '10px' });
    expect(SpacingSchema.parse({})).toEqual({});
  });

  it('accepts CSS variable values', () => {
    const spacing = { top: 'var(--deck-space-md)' };
    expect(SpacingSchema.parse(spacing)).toEqual(spacing);
  });
});

describe('GridSchema', () => {
  it('validates grid with defaults', () => {
    const grid = {};
    const result = GridSchema.parse(grid);
    expect(result.columns).toBe(12);
  });

  it('validates custom grid settings', () => {
    const grid = {
      columns: 8,
      rows: 4,
      gap: '16px',
      rowGap: '8px',
      columnGap: '24px',
    };
    expect(GridSchema.parse(grid)).toEqual({ ...grid, columns: 8 });
  });

  it('allows columns to be overridden', () => {
    const result = GridSchema.parse({ columns: 6 });
    expect(result.columns).toBe(6);
  });
});

describe('SlideLayoutSchema', () => {
  it('validates empty layout', () => {
    expect(SlideLayoutSchema.parse({})).toEqual({});
  });

  it('validates full layout', () => {
    const layout = {
      margin: { top: '20px', bottom: '20px' },
      padding: { left: '10px', right: '10px' },
      alignItems: 'center',
      justifyContent: 'space-between',
      direction: 'row',
      gap: '16px',
    };
    expect(SlideLayoutSchema.parse(layout)).toEqual(layout);
  });

  it('validates alignItems values', () => {
    expect(SlideLayoutSchema.parse({ alignItems: 'start' }).alignItems).toBe('start');
    expect(SlideLayoutSchema.parse({ alignItems: 'center' }).alignItems).toBe('center');
    expect(SlideLayoutSchema.parse({ alignItems: 'end' }).alignItems).toBe('end');
    expect(SlideLayoutSchema.parse({ alignItems: 'stretch' }).alignItems).toBe('stretch');
    expect(() => SlideLayoutSchema.parse({ alignItems: 'invalid' })).toThrow();
  });

  it('validates justifyContent values', () => {
    expect(SlideLayoutSchema.parse({ justifyContent: 'start' }).justifyContent).toBe('start');
    expect(SlideLayoutSchema.parse({ justifyContent: 'space-between' }).justifyContent).toBe('space-between');
    expect(SlideLayoutSchema.parse({ justifyContent: 'space-around' }).justifyContent).toBe('space-around');
    expect(() => SlideLayoutSchema.parse({ justifyContent: 'invalid' })).toThrow();
  });

  it('validates direction values', () => {
    expect(SlideLayoutSchema.parse({ direction: 'column' }).direction).toBe('column');
    expect(SlideLayoutSchema.parse({ direction: 'row' }).direction).toBe('row');
    expect(() => SlideLayoutSchema.parse({ direction: 'diagonal' })).toThrow();
  });

  // backgroundSize moved to SlideStyleSchema
});

describe('defaultSlideLayout', () => {
  it('has expected default values', () => {
    expect(defaultSlideLayout.alignItems).toBe('start');
    expect(defaultSlideLayout.justifyContent).toBe('start');
    expect(defaultSlideLayout.direction).toBe('column');
    expect(defaultSlideLayout.gap).toBe('var(--deck-space-lg)');
  });

  it('has margin using theme variables', () => {
    expect(defaultSlideLayout.margin?.top).toBe('var(--deck-space-xl)');
  });
});

describe('SlideSchema', () => {
  const validSlide = {
    id: 'slide-1',
    title: 'My Slide',
    components: [],
    position: { x: 0, y: 0 },
  };

  it('validates a minimal slide', () => {
    expect(SlideSchema.parse(validSlide)).toEqual(validSlide);
  });

  it('validates slide with components', () => {
    const slide = {
      ...validSlide,
      components: [
        {
          id: 'comp-1',
          type: 'deck-text',
          props: { content: 'Hello' },
        },
      ],
    };
    const result = SlideSchema.parse(slide);
    expect(result.components).toHaveLength(1);
    expect(result.components[0].type).toBe('deck-text');
  });

  it('validates optional gridColumns override', () => {
    const slide = { ...validSlide, gridColumns: 6 };
    expect(SlideSchema.parse(slide).gridColumns).toBe(6);
  });

  it('validates gridColumns range (1-12)', () => {
    expect(SlideSchema.parse({ ...validSlide, gridColumns: 1 }).gridColumns).toBe(1);
    expect(SlideSchema.parse({ ...validSlide, gridColumns: 12 }).gridColumns).toBe(12);
    expect(() => SlideSchema.parse({ ...validSlide, gridColumns: 0 })).toThrow();
    expect(() => SlideSchema.parse({ ...validSlide, gridColumns: 13 })).toThrow();
  });

  it('allows undefined gridColumns (uses deck default)', () => {
    const result = SlideSchema.parse(validSlide);
    expect(result.gridColumns).toBeUndefined();
  });

  it('validates optional notes', () => {
    const slide = { ...validSlide, notes: 'Speaker notes here' };
    expect(SlideSchema.parse(slide).notes).toBe('Speaker notes here');
  });

  it('validates optional layout', () => {
    const slide = {
      ...validSlide,
      layout: { alignItems: 'center', direction: 'row' },
    };
    const result = SlideSchema.parse(slide);
    expect(result.layout?.alignItems).toBe('center');
    expect(result.layout?.direction).toBe('row');
  });

  it('rejects missing required fields', () => {
    expect(() => SlideSchema.parse({ id: 'slide-1' })).toThrow();
    expect(() => SlideSchema.parse({ title: 'Test' })).toThrow();
  });

  it('rejects invalid components', () => {
    const slide = {
      ...validSlide,
      components: [{ id: 'comp-1', type: 'invalid-type', props: {} }],
    };
    expect(() => SlideSchema.parse(slide)).toThrow();
  });
});

describe('SlidesMapSchema', () => {
  it('validates empty slides map', () => {
    expect(SlidesMapSchema.parse({})).toEqual({});
  });

  it('validates slides map with multiple slides', () => {
    const slides = {
      'slide-1': {
        id: 'slide-1',
        title: 'First',
        components: [],
        position: { x: 0, y: 0 },
      },
      'slide-2': {
        id: 'slide-2',
        title: 'Second',
        components: [],
        position: { x: 900, y: 0 },
      },
    };
    const result = SlidesMapSchema.parse(slides);
    expect(Object.keys(result)).toHaveLength(2);
  });
});

describe('generateSlideId', () => {
  it('generates ID with slide- prefix', () => {
    const id = generateSlideId();
    expect(id).toMatch(/^slide-[a-f0-9]{8}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSlideId()));
    expect(ids.size).toBe(100);
  });
});

describe('createBlankSlide', () => {
  it('creates slide with default position', () => {
    const slide = createBlankSlide();
    expect(slide.position).toEqual({ x: 0, y: 0 });
  });

  it('creates slide with custom position', () => {
    const slide = createBlankSlide({ x: 500, y: 300 });
    expect(slide.position).toEqual({ x: 500, y: 300 });
  });

  it('creates slide with default title', () => {
    const slide = createBlankSlide();
    expect(slide.title).toBe('Untitled');
  });

  it('creates slide with empty components array', () => {
    const slide = createBlankSlide();
    expect(slide.components).toEqual([]);
  });

  it('creates slide with default layout', () => {
    const slide = createBlankSlide();
    expect(slide.layout).toEqual(defaultSlideLayout);
  });

  it('creates a valid slide', () => {
    const slide = createBlankSlide();
    const result = SlideSchema.safeParse(slide);
    expect(result.success).toBe(true);
  });
});

describe('layoutToCssProperties', () => {
  it('generates flex display by default', () => {
    const css = layoutToCssProperties({});
    expect(css['display']).toBe('flex');
    expect(css['flex-direction']).toBe('column');
  });

  it('applies margin as padding', () => {
    const css = layoutToCssProperties({
      margin: { top: '20px', right: '10px', bottom: '20px', left: '10px' },
    });
    expect(css['padding-top']).toBe('20px');
    expect(css['padding-right']).toBe('10px');
    expect(css['padding-bottom']).toBe('20px');
    expect(css['padding-left']).toBe('10px');
  });

  it('applies alignment properties', () => {
    const css = layoutToCssProperties({
      alignItems: 'center',
      justifyContent: 'space-between',
    });
    expect(css['align-items']).toBe('center');
    expect(css['justify-content']).toBe('space-between');
  });

  it('applies direction', () => {
    const css = layoutToCssProperties({ direction: 'row' });
    expect(css['flex-direction']).toBe('row');
  });

  it('applies gap', () => {
    const css = layoutToCssProperties({ gap: '24px' });
    expect(css['gap']).toBe('24px');
  });
});

describe('SlideStyleSchema', () => {
  it('validates empty style', () => {
    expect(SlideStyleSchema.parse({})).toEqual({});
  });

  it('validates color overrides', () => {
    const style = {
      background: '#ffffff',
      textPrimary: '#000000',
      textSecondary: '#666666',
      accent: '#0066cc',
    };
    expect(SlideStyleSchema.parse(style)).toEqual(style);
  });

  it('validates background image properties', () => {
    const style = {
      backgroundAssetId: 'asset-123',
      backgroundSize: 'fill',
      backgroundPosition: 'center',
    };
    expect(SlideStyleSchema.parse(style)).toEqual(style);
  });

  it('validates backgroundSize enum values', () => {
    expect(SlideStyleSchema.parse({ backgroundSize: 'fill' }).backgroundSize).toBe('fill');
    expect(SlideStyleSchema.parse({ backgroundSize: 'fit-width' }).backgroundSize).toBe('fit-width');
    expect(SlideStyleSchema.parse({ backgroundSize: 'fit-height' }).backgroundSize).toBe('fit-height');
    expect(() => SlideStyleSchema.parse({ backgroundSize: 'invalid' })).toThrow();
    expect(() => SlideStyleSchema.parse({ backgroundSize: 'cover' })).toThrow();
  });

  it('validates backdropSlideId', () => {
    const style = { backdropSlideId: 'slide-backdrop-123' };
    expect(SlideStyleSchema.parse(style).backdropSlideId).toBe('slide-backdrop-123');
  });

  it('allows optional backdropSlideId', () => {
    const style = { background: '#fff' };
    expect(SlideStyleSchema.parse(style).backdropSlideId).toBeUndefined();
  });
});

describe('styleToCssProperties', () => {
  it('returns empty object for empty style', () => {
    const css = styleToCssProperties({});
    expect(Object.keys(css)).toHaveLength(0);
  });

  it('maps color overrides to CSS custom properties', () => {
    const css = styleToCssProperties({
      background: '#ffffff',
      textPrimary: '#000000',
      textSecondary: '#666666',
      accent: '#0066cc',
    });
    expect(css['--deck-color-background']).toBe('#ffffff');
    expect(css['--deck-color-text-primary']).toBe('#000000');
    expect(css['--deck-color-text-secondary']).toBe('#666666');
    expect(css['--deck-color-accent']).toBe('#0066cc');
  });

  it('does not include backgroundAssetId in CSS (resolved at component level)', () => {
    const css = styleToCssProperties({ backgroundAssetId: 'asset-123' });
    expect(css['background-image']).toBeUndefined();
  });

  it('applies background size and position', () => {
    const css = styleToCssProperties({
      backgroundSize: 'fill',
      backgroundPosition: 'center top',
    });
    expect(css['background-size']).toBe('cover');
    expect(css['background-position']).toBe('center top');
  });

  it('maps backgroundSize values to CSS correctly', () => {
    expect(styleToCssProperties({ backgroundSize: 'fill' })['background-size']).toBe('cover');
    expect(styleToCssProperties({ backgroundSize: 'fit-width' })['background-size']).toBe('100% auto');
    expect(styleToCssProperties({ backgroundSize: 'fit-height' })['background-size']).toBe('auto 100%');
  });
});

describe('backgroundSizeToCss', () => {
  it('maps fill to cover', () => {
    expect(backgroundSizeToCss('fill')).toBe('cover');
  });

  it('maps fit-width to 100% auto', () => {
    expect(backgroundSizeToCss('fit-width')).toBe('100% auto');
  });

  it('maps fit-height to auto 100%', () => {
    expect(backgroundSizeToCss('fit-height')).toBe('auto 100%');
  });
});

describe('BackgroundSizeSchema', () => {
  it('accepts valid values', () => {
    expect(BackgroundSizeSchema.parse('fill')).toBe('fill');
    expect(BackgroundSizeSchema.parse('fit-width')).toBe('fit-width');
    expect(BackgroundSizeSchema.parse('fit-height')).toBe('fit-height');
  });

  it('rejects invalid values', () => {
    expect(() => BackgroundSizeSchema.parse('cover')).toThrow();
    expect(() => BackgroundSizeSchema.parse('contain')).toThrow();
    expect(() => BackgroundSizeSchema.parse('auto')).toThrow();
  });
});
