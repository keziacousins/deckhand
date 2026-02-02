import { describe, it, expect } from 'vitest';
import {
  ComponentSchema,
  TitleComponentSchema,
  SubtitleComponentSchema,
  TextComponentSchema,
  ListComponentSchema,
  ImageComponentSchema,
  CodeComponentSchema,
  QuoteComponentSchema,
  ColumnsComponentSchema,
  SpacerComponentSchema,
  HeadlineSubheadComponentSchema,
  componentTypes,
} from '../component';

describe('TitleComponentSchema', () => {
  it('validates minimal title component', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-title',
      props: { text: 'Hello World' },
    };
    expect(TitleComponentSchema.parse(comp)).toEqual(comp);
  });

  it('validates title with all optional props', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-title',
      props: {
        text: 'Hello',
        level: '2',
        align: 'center',
        gridWidth: 6,
      },
    };
    const result = TitleComponentSchema.parse(comp);
    expect(result.props.level).toBe('2');
    expect(result.props.align).toBe('center');
    expect(result.props.gridWidth).toBe(6);
  });

  it('validates level values', () => {
    expect(TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 't', level: '1' }
    }).props.level).toBe('1');
    expect(TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 't', level: '2' }
    }).props.level).toBe('2');
    expect(TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 't', level: '3' }
    }).props.level).toBe('3');
    expect(() => TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 't', level: '4' }
    })).toThrow();
  });

  it('validates align values', () => {
    expect(TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 't', align: 'left' }
    }).props.align).toBe('left');
    expect(TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 't', align: 'center' }
    }).props.align).toBe('center');
    expect(TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 't', align: 'right' }
    }).props.align).toBe('right');
    expect(() => TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 't', align: 'justify' }
    })).toThrow();
  });

  it('validates gridWidth range (1-12)', () => {
    expect(TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 't', gridWidth: 1 }
    }).props.gridWidth).toBe(1);
    expect(TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 't', gridWidth: 12 }
    }).props.gridWidth).toBe(12);
    expect(() => TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 't', gridWidth: 0 }
    })).toThrow();
    expect(() => TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 't', gridWidth: 13 }
    })).toThrow();
  });

  it('gridWidth is optional', () => {
    const result = TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 'test' }
    });
    expect(result.props.gridWidth).toBeUndefined();
  });

  it('rejects missing text', () => {
    expect(() => TitleComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: {}
    })).toThrow();
  });
});

describe('SubtitleComponentSchema', () => {
  it('validates subtitle component', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-subtitle',
      props: { text: 'A subtitle', align: 'left' },
    };
    expect(SubtitleComponentSchema.parse(comp)).toEqual(comp);
  });

  it('supports gridWidth', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-subtitle',
      props: { text: 'Sub', gridWidth: 4 },
    };
    expect(SubtitleComponentSchema.parse(comp).props.gridWidth).toBe(4);
  });
});

describe('TextComponentSchema', () => {
  it('validates text component with rich text array', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-text',
      props: {
        content: [
          { text: 'Hello ' },
          { text: 'world', bold: true },
        ],
      },
    };
    const result = TextComponentSchema.parse(comp);
    expect(Array.isArray(result.props.content)).toBe(true);
    expect(result.props.content).toHaveLength(2);
  });

  it('validates text with formatting options', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-text',
      props: {
        content: [
          { text: 'bold', bold: true },
          { text: 'italic', italic: true },
          { text: 'underline', underline: true },
          { text: 'code', code: true },
          { text: 'link', href: 'https://example.com' },
        ],
      },
    };
    const result = TextComponentSchema.parse(comp);
    expect(result.props.content[0].bold).toBe(true);
    expect(result.props.content[4].href).toBe('https://example.com');
  });

  it('supports gridWidth', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-text',
      props: { content: [{ text: 'Text' }], gridWidth: 8 },
    };
    expect(TextComponentSchema.parse(comp).props.gridWidth).toBe(8);
  });

  it('rejects plain string content', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-text',
      props: { content: 'Plain text' },
    };
    expect(() => TextComponentSchema.parse(comp)).toThrow();
  });
});

describe('ListComponentSchema', () => {
  it('validates list with items', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-list',
      props: { items: ['Item 1', 'Item 2', 'Item 3'] },
    };
    expect(ListComponentSchema.parse(comp).props.items).toHaveLength(3);
  });

  it('validates ordered list', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-list',
      props: { items: ['First', 'Second'], ordered: true },
    };
    expect(ListComponentSchema.parse(comp).props.ordered).toBe(true);
  });

  it('accepts empty items array', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-list',
      props: { items: [] },
    };
    expect(ListComponentSchema.parse(comp).props.items).toEqual([]);
  });

  it('supports gridWidth', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-list',
      props: { items: ['A'], gridWidth: 6 },
    };
    expect(ListComponentSchema.parse(comp).props.gridWidth).toBe(6);
  });
});

describe('ImageComponentSchema', () => {
  it('validates image with assetId', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-image',
      props: { assetId: 'asset-123' },
    };
    expect(ImageComponentSchema.parse(comp).props.assetId).toBe('asset-123');
  });

  it('validates all optional props', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-image',
      props: {
        assetId: 'asset-123',
        alt: 'Description',
        caption: 'Figure 1',
        fit: 'cover',
        gridWidth: 4,
      },
    };
    const result = ImageComponentSchema.parse(comp);
    expect(result.props.alt).toBe('Description');
    expect(result.props.caption).toBe('Figure 1');
    expect(result.props.fit).toBe('cover');
    expect(result.props.gridWidth).toBe(4);
  });

  it('validates fit values', () => {
    expect(ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', fit: 'contain' }
    }).props.fit).toBe('contain');
    expect(ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', fit: 'cover' }
    }).props.fit).toBe('cover');
    expect(ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', fit: 'fill' }
    }).props.fit).toBe('fill');
    expect(() => ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', fit: 'stretch' }
    })).toThrow();
  });
});

describe('CodeComponentSchema', () => {
  it('validates code component', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-code',
      props: { code: 'console.log("hello")' },
    };
    expect(CodeComponentSchema.parse(comp).props.code).toBe('console.log("hello")');
  });

  it('validates optional language and line numbers', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-code',
      props: {
        code: 'const x = 1;',
        language: 'typescript',
        showLineNumbers: true,
        gridWidth: 8,
      },
    };
    const result = CodeComponentSchema.parse(comp);
    expect(result.props.language).toBe('typescript');
    expect(result.props.showLineNumbers).toBe(true);
    expect(result.props.gridWidth).toBe(8);
  });
});

describe('QuoteComponentSchema', () => {
  it('validates quote component', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-quote',
      props: { text: 'To be or not to be' },
    };
    expect(QuoteComponentSchema.parse(comp).props.text).toBe('To be or not to be');
  });

  it('validates optional attribution', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-quote',
      props: {
        text: 'Stay hungry, stay foolish',
        attribution: 'Steve Jobs',
        gridWidth: 6,
      },
    };
    const result = QuoteComponentSchema.parse(comp);
    expect(result.props.attribution).toBe('Steve Jobs');
    expect(result.props.gridWidth).toBe(6);
  });
});

describe('ColumnsComponentSchema', () => {
  it('validates columns layout', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-columns',
      props: {
        columns: [
          { id: 'col-1', componentIds: ['comp-2', 'comp-3'] },
          { id: 'col-2', componentIds: ['comp-4'] },
        ],
      },
    };
    const result = ColumnsComponentSchema.parse(comp);
    expect(result.props.columns).toHaveLength(2);
    expect(result.props.columns[0].componentIds).toEqual(['comp-2', 'comp-3']);
  });

  it('validates optional gap', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-columns',
      props: {
        columns: [],
        gap: '24px',
        gridWidth: 12,
      },
    };
    const result = ColumnsComponentSchema.parse(comp);
    expect(result.props.gap).toBe('24px');
    expect(result.props.gridWidth).toBe(12);
  });
});

describe('SpacerComponentSchema', () => {
  it('validates spacer with default', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-spacer',
      props: {},
    };
    expect(SpacerComponentSchema.parse(comp).type).toBe('deck-spacer');
  });

  it('validates spacer with height', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-spacer',
      props: { height: '48px', gridWidth: 12 },
    };
    const result = SpacerComponentSchema.parse(comp);
    expect(result.props.height).toBe('48px');
    expect(result.props.gridWidth).toBe(12);
  });
});

describe('HeadlineSubheadComponentSchema', () => {
  it('validates minimal headline-subhead', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-headline-subhead',
      props: { headline: 'Welcome' },
    };
    expect(HeadlineSubheadComponentSchema.parse(comp).props.headline).toBe('Welcome');
  });

  it('validates all optional props', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-headline-subhead',
      props: {
        headline: 'Big News',
        subheading: 'Important details follow',
        category: 'Announcement',
        isHero: true,
        variant: 'dark',
        align: 'center',
        gridWidth: 8,
      },
    };
    const result = HeadlineSubheadComponentSchema.parse(comp);
    expect(result.props.subheading).toBe('Important details follow');
    expect(result.props.category).toBe('Announcement');
    expect(result.props.isHero).toBe(true);
    expect(result.props.variant).toBe('dark');
    expect(result.props.align).toBe('center');
    expect(result.props.gridWidth).toBe(8);
  });

  it('validates variant values', () => {
    expect(HeadlineSubheadComponentSchema.parse({
      id: 'c1', type: 'deck-headline-subhead', props: { headline: 'H', variant: 'dark' }
    }).props.variant).toBe('dark');
    expect(HeadlineSubheadComponentSchema.parse({
      id: 'c1', type: 'deck-headline-subhead', props: { headline: 'H', variant: 'light' }
    }).props.variant).toBe('light');
    expect(() => HeadlineSubheadComponentSchema.parse({
      id: 'c1', type: 'deck-headline-subhead', props: { headline: 'H', variant: 'medium' }
    })).toThrow();
  });
});

describe('ComponentSchema (discriminated union)', () => {
  it('correctly discriminates by type', () => {
    const title = ComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 'Hello' }
    });
    expect(title.type).toBe('deck-title');

    const list = ComponentSchema.parse({
      id: 'c2', type: 'deck-list', props: { items: ['a', 'b'] }
    });
    expect(list.type).toBe('deck-list');
  });

  it('rejects invalid component type', () => {
    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'invalid-component', props: {}
    })).toThrow();
  });

  it('rejects mismatched props for type', () => {
    // deck-title requires text prop
    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { items: ['a'] }
    })).toThrow();
  });
});

describe('componentTypes', () => {
  it('contains all expected component types', () => {
    expect(componentTypes).toContain('deck-title');
    expect(componentTypes).toContain('deck-subtitle');
    expect(componentTypes).toContain('deck-text');
    expect(componentTypes).toContain('deck-list');
    expect(componentTypes).toContain('deck-image');
    expect(componentTypes).toContain('deck-floating-image');
    expect(componentTypes).toContain('deck-code');
    expect(componentTypes).toContain('deck-quote');
    expect(componentTypes).toContain('deck-columns');
    expect(componentTypes).toContain('deck-spacer');
    expect(componentTypes).toContain('deck-headline-subhead');
  });

  it('has 11 component types', () => {
    expect(componentTypes).toHaveLength(11);
  });
});

describe('gridWidth across all components', () => {
  // Grid-based components that support gridWidth
  const gridComponentConfigs = [
    { type: 'deck-title', props: { text: 'T' } },
    { type: 'deck-subtitle', props: { text: 'S' } },
    { type: 'deck-text', props: { content: [{ text: 'C' }] } },
    { type: 'deck-list', props: { items: [] } },
    { type: 'deck-image', props: { assetId: 'a' } },
    { type: 'deck-code', props: { code: 'x' } },
    { type: 'deck-quote', props: { text: 'Q' } },
    { type: 'deck-columns', props: { columns: [] } },
    { type: 'deck-spacer', props: {} },
    { type: 'deck-headline-subhead', props: { headline: 'H' } },
  ];

  // Floating components that use absolute positioning (no gridWidth)
  const floatingComponentConfigs = [
    { type: 'deck-floating-image', props: { assetId: 'a' } },
  ];

  it('grid component types support optional gridWidth', () => {
    for (const config of gridComponentConfigs) {
      const withGridWidth = {
        id: 'test-id',
        type: config.type,
        props: { ...config.props, gridWidth: 6 },
      };
      const result = ComponentSchema.parse(withGridWidth);
      expect((result.props as { gridWidth?: number }).gridWidth).toBe(6);
    }
  });

  it('grid component types work without gridWidth', () => {
    for (const config of gridComponentConfigs) {
      const withoutGridWidth = {
        id: 'test-id',
        type: config.type,
        props: config.props,
      };
      const result = ComponentSchema.parse(withoutGridWidth);
      expect((result.props as { gridWidth?: number }).gridWidth).toBeUndefined();
    }
  });

  it('floating component types do not have gridWidth', () => {
    for (const config of floatingComponentConfigs) {
      const component = {
        id: 'test-id',
        type: config.type,
        props: config.props,
      };
      const result = ComponentSchema.parse(component);
      expect('gridWidth' in result.props).toBe(false);
    }
  });
});
