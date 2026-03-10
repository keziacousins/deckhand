import { describe, it, expect } from 'vitest';
import {
  ComponentSchema,
  TextComponentSchema,
  ImageComponentSchema,
  ContainerComponentSchema,
  componentTypes,
} from '../component';

describe('TextComponentSchema', () => {
  it('validates minimal text component', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-text',
      props: { content: 'Hello World' },
    };
    expect(TextComponentSchema.parse(comp)).toEqual(comp);
  });

  it('validates text with markdown flag', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-text',
      props: { content: '**Bold** and *italic*', markdown: true },
    };
    const result = TextComponentSchema.parse(comp);
    expect(result.props.markdown).toBe(true);
  });

  it('markdown defaults to undefined (off)', () => {
    const result = TextComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: 'plain' },
    });
    expect(result.props.markdown).toBeUndefined();
  });

  it('validates size values', () => {
    for (const size of ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'display']) {
      expect(TextComponentSchema.parse({
        id: 'c1', type: 'deck-text', props: { content: 't', size },
      }).props.size).toBe(size);
    }
    expect(() => TextComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: 't', size: 'huge' },
    })).toThrow();
  });

  it('validates weight values', () => {
    for (const weight of ['normal', 'medium', 'semibold', 'bold']) {
      expect(TextComponentSchema.parse({
        id: 'c1', type: 'deck-text', props: { content: 't', weight },
      }).props.weight).toBe(weight);
    }
    expect(() => TextComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: 't', weight: 'thin' },
    })).toThrow();
  });

  it('validates align values', () => {
    for (const align of ['left', 'center', 'right']) {
      expect(TextComponentSchema.parse({
        id: 'c1', type: 'deck-text', props: { content: 't', align },
      }).props.align).toBe(align);
    }
    expect(() => TextComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: 't', align: 'justify' },
    })).toThrow();
  });

  it('validates transform values', () => {
    for (const transform of ['none', 'uppercase', 'lowercase', 'capitalize']) {
      expect(TextComponentSchema.parse({
        id: 'c1', type: 'deck-text', props: { content: 't', transform },
      }).props.transform).toBe(transform);
    }
    expect(() => TextComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: 't', transform: 'small-caps' },
    })).toThrow();
  });

  it('accepts color string', () => {
    const result = TextComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: 't', color: '#ff0000' },
    });
    expect(result.props.color).toBe('#ff0000');
  });

  it('validates all props together', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-text',
      props: {
        content: '# Heading\n\nBody text',
        markdown: true,
        size: 'lg',
        weight: 'bold',
        align: 'center',
        transform: 'uppercase',
        color: 'var(--accent)',
        gridWidth: 8,
      },
    };
    const result = TextComponentSchema.parse(comp);
    expect(result.props.content).toBe('# Heading\n\nBody text');
    expect(result.props.markdown).toBe(true);
    expect(result.props.size).toBe('lg');
    expect(result.props.weight).toBe('bold');
    expect(result.props.align).toBe('center');
    expect(result.props.transform).toBe('uppercase');
    expect(result.props.color).toBe('var(--accent)');
    expect(result.props.gridWidth).toBe(8);
  });

  it('requires content string', () => {
    expect(() => TextComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: {},
    })).toThrow();
  });

  it('rejects non-string content', () => {
    expect(() => TextComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: [{ text: 'rich' }] },
    })).toThrow();
  });

  it('gridWidth is optional', () => {
    const result = TextComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: 'test' },
    });
    expect(result.props.gridWidth).toBeUndefined();
  });

  it('validates gridWidth range (0-12)', () => {
    expect(TextComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: 't', gridWidth: 0 },
    }).props.gridWidth).toBe(0);
    expect(TextComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: 't', gridWidth: 12 },
    }).props.gridWidth).toBe(12);
    expect(() => TextComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: 't', gridWidth: -1 },
    })).toThrow();
    expect(() => TextComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: 't', gridWidth: 13 },
    })).toThrow();
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
        darken: 50,
        blur: 5,
        maxWidth: 800,
        maxHeight: 600,
        align: 'center',
        color: '#333',
        borderRadius: 'lg',
        borderWidth: 2,
        borderColor: '#000',
        shadow: 'md',
        shadowColor: 'rgba(0,0,0,0.3)',
        gridWidth: 4,
      },
    };
    const result = ImageComponentSchema.parse(comp);
    expect(result.props.alt).toBe('Description');
    expect(result.props.caption).toBe('Figure 1');
    expect(result.props.fit).toBe('cover');
    expect(result.props.darken).toBe(50);
    expect(result.props.blur).toBe(5);
    expect(result.props.maxWidth).toBe(800);
    expect(result.props.maxHeight).toBe(600);
    expect(result.props.align).toBe('center');
    expect(result.props.color).toBe('#333');
    expect(result.props.borderRadius).toBe('lg');
    expect(result.props.borderWidth).toBe(2);
    expect(result.props.borderColor).toBe('#000');
    expect(result.props.shadow).toBe('md');
    expect(result.props.shadowColor).toBe('rgba(0,0,0,0.3)');
    expect(result.props.gridWidth).toBe(4);
  });

  it('validates fit values', () => {
    for (const fit of ['contain', 'cover', 'fill']) {
      expect(ImageComponentSchema.parse({
        id: 'c1', type: 'deck-image', props: { assetId: 'a', fit },
      }).props.fit).toBe(fit);
    }
    expect(() => ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', fit: 'stretch' },
    })).toThrow();
  });

  it('validates borderRadius values', () => {
    for (const borderRadius of ['none', 'sm', 'md', 'lg', 'full']) {
      expect(ImageComponentSchema.parse({
        id: 'c1', type: 'deck-image', props: { assetId: 'a', borderRadius },
      }).props.borderRadius).toBe(borderRadius);
    }
    expect(() => ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', borderRadius: 'xl' },
    })).toThrow();
    expect(() => ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', borderRadius: 'default' },
    })).toThrow();
  });

  it('validates borderWidth range (0-10)', () => {
    expect(ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', borderWidth: 0 },
    }).props.borderWidth).toBe(0);
    expect(ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', borderWidth: 10 },
    }).props.borderWidth).toBe(10);
    expect(() => ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', borderWidth: -1 },
    })).toThrow();
    expect(() => ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', borderWidth: 11 },
    })).toThrow();
  });

  it('validates shadow values', () => {
    for (const shadow of ['none', 'sm', 'md', 'lg']) {
      expect(ImageComponentSchema.parse({
        id: 'c1', type: 'deck-image', props: { assetId: 'a', shadow },
      }).props.shadow).toBe(shadow);
    }
    expect(() => ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', shadow: 'xl' },
    })).toThrow();
  });

  it('validates darken range (0-100)', () => {
    expect(ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', darken: 0 },
    }).props.darken).toBe(0);
    expect(ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', darken: 100 },
    }).props.darken).toBe(100);
    expect(() => ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', darken: -1 },
    })).toThrow();
    expect(() => ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', darken: 101 },
    })).toThrow();
  });

  it('validates blur range (0-20)', () => {
    expect(ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', blur: 0 },
    }).props.blur).toBe(0);
    expect(ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', blur: 20 },
    }).props.blur).toBe(20);
    expect(() => ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { assetId: 'a', blur: 21 },
    })).toThrow();
  });

  it('validates align values', () => {
    for (const align of ['left', 'center', 'right']) {
      expect(ImageComponentSchema.parse({
        id: 'c1', type: 'deck-image', props: { assetId: 'a', align },
      }).props.align).toBe(align);
    }
  });

  it('requires assetId', () => {
    expect(() => ImageComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: {},
    })).toThrow();
  });
});

describe('ContainerComponentSchema', () => {
  it('validates minimal container', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-container',
      props: { gridWidth: 6 },
    };
    expect(ContainerComponentSchema.parse(comp).props.gridWidth).toBe(6);
  });

  it('validates all grid/style props', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-container',
      props: {
        gridWidth: 4,
        background: '#f0f0f0',
        padding: 'md',
        gap: 'sm',
        borderRadius: 'lg',
        borderWidth: 2,
        borderColor: '#ccc',
        shadow: 'md',
        shadowColor: 'rgba(0,0,0,0.2)',
        alignItems: 'center',
        justifyContent: 'space-between',
      },
    };
    const result = ContainerComponentSchema.parse(comp);
    expect(result.props.background).toBe('#f0f0f0');
    expect(result.props.padding).toBe('md');
    expect(result.props.gap).toBe('sm');
    expect(result.props.borderRadius).toBe('lg');
    expect(result.props.borderWidth).toBe(2);
    expect(result.props.borderColor).toBe('#ccc');
    expect(result.props.shadow).toBe('md');
    expect(result.props.shadowColor).toBe('rgba(0,0,0,0.2)');
    expect(result.props.alignItems).toBe('center');
    expect(result.props.justifyContent).toBe('space-between');
  });

  it('requires gridWidth', () => {
    expect(() => ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: {},
    })).toThrow();
  });

  it('validates gridWidth range (1-12)', () => {
    expect(ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 1 },
    }).props.gridWidth).toBe(1);
    expect(ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 12 },
    }).props.gridWidth).toBe(12);
    expect(() => ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 0 },
    })).toThrow();
    expect(() => ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 13 },
    })).toThrow();
  });

  it('validates padding values', () => {
    for (const padding of ['none', 'sm', 'md', 'lg']) {
      expect(ContainerComponentSchema.parse({
        id: 'c1', type: 'deck-container', props: { gridWidth: 6, padding },
      }).props.padding).toBe(padding);
    }
    expect(() => ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 6, padding: 'xl' },
    })).toThrow();
  });

  it('validates gap values', () => {
    for (const gap of ['none', 'sm', 'md', 'lg']) {
      expect(ContainerComponentSchema.parse({
        id: 'c1', type: 'deck-container', props: { gridWidth: 6, gap },
      }).props.gap).toBe(gap);
    }
  });

  it('validates borderRadius values', () => {
    for (const borderRadius of ['none', 'sm', 'md', 'lg', 'full']) {
      expect(ContainerComponentSchema.parse({
        id: 'c1', type: 'deck-container', props: { gridWidth: 6, borderRadius },
      }).props.borderRadius).toBe(borderRadius);
    }
  });

  it('validates visual props (borderWidth, shadow, shadowColor)', () => {
    const result = ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: {
        gridWidth: 6, borderWidth: 3, borderColor: '#f00', shadow: 'lg', shadowColor: '#000',
      },
    });
    expect(result.props.borderWidth).toBe(3);
    expect(result.props.borderColor).toBe('#f00');
    expect(result.props.shadow).toBe('lg');
    expect(result.props.shadowColor).toBe('#000');
  });

  it('rejects freeform border string (use borderWidth + borderColor instead)', () => {
    const result = ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 6, border: '1px solid #ccc' },
    });
    // border is not in the schema — should be stripped
    expect((result.props as Record<string, unknown>).border).toBeUndefined();
  });

  it('validates alignItems values', () => {
    for (const alignItems of ['start', 'center', 'end', 'stretch']) {
      expect(ContainerComponentSchema.parse({
        id: 'c1', type: 'deck-container', props: { gridWidth: 6, alignItems },
      }).props.alignItems).toBe(alignItems);
    }
  });

  it('validates justifyContent values', () => {
    for (const justifyContent of ['start', 'center', 'end', 'space-between']) {
      expect(ContainerComponentSchema.parse({
        id: 'c1', type: 'deck-container', props: { gridWidth: 6, justifyContent },
      }).props.justifyContent).toBe(justifyContent);
    }
  });

  // Floating mode props
  it('validates floating mode with anchorX and anchorY', () => {
    const comp = {
      id: 'comp-1',
      type: 'deck-container',
      props: {
        gridWidth: 4,
        anchorX: 'left',
        anchorY: 'top',
        x: '20px',
        y: '10%',
        width: '200px',
        height: '150px',
        opacity: 80,
      },
    };
    const result = ContainerComponentSchema.parse(comp);
    expect(result.props.anchorX).toBe('left');
    expect(result.props.anchorY).toBe('top');
    expect(result.props.x).toBe('20px');
    expect(result.props.y).toBe('10%');
    expect(result.props.width).toBe('200px');
    expect(result.props.height).toBe('150px');
    expect(result.props.opacity).toBe(80);
  });

  it('validates anchorX values', () => {
    for (const anchorX of ['left', 'right']) {
      expect(ContainerComponentSchema.parse({
        id: 'c1', type: 'deck-container', props: { gridWidth: 6, anchorX },
      }).props.anchorX).toBe(anchorX);
    }
    expect(() => ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 6, anchorX: 'center' },
    })).toThrow();
  });

  it('validates anchorY values', () => {
    for (const anchorY of ['top', 'bottom']) {
      expect(ContainerComponentSchema.parse({
        id: 'c1', type: 'deck-container', props: { gridWidth: 6, anchorY },
      }).props.anchorY).toBe(anchorY);
    }
    expect(() => ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 6, anchorY: 'middle' },
    })).toThrow();
  });

  it('validates opacity range (0-100)', () => {
    expect(ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 6, opacity: 0 },
    }).props.opacity).toBe(0);
    expect(ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 6, opacity: 100 },
    }).props.opacity).toBe(100);
    expect(() => ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 6, opacity: -1 },
    })).toThrow();
    expect(() => ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 6, opacity: 101 },
    })).toThrow();
  });

  it('floating props are all optional', () => {
    const result = ContainerComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 6 },
    });
    expect(result.props.anchorX).toBeUndefined();
    expect(result.props.anchorY).toBeUndefined();
    expect(result.props.x).toBeUndefined();
    expect(result.props.y).toBeUndefined();
    expect(result.props.width).toBeUndefined();
    expect(result.props.height).toBeUndefined();
    expect(result.props.opacity).toBeUndefined();
  });

  it('supports parentId for nesting', () => {
    const comp = {
      id: 'comp-1',
      parentId: 'parent-container',
      type: 'deck-container',
      props: { gridWidth: 4 },
    };
    expect(ContainerComponentSchema.parse(comp).parentId).toBe('parent-container');
  });
});

describe('ComponentSchema (discriminated union)', () => {
  it('correctly discriminates by type', () => {
    const text = ComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: 'Hello' },
    });
    expect(text.type).toBe('deck-text');

    const image = ComponentSchema.parse({
      id: 'c2', type: 'deck-image', props: { assetId: 'a' },
    });
    expect(image.type).toBe('deck-image');

    const container = ComponentSchema.parse({
      id: 'c3', type: 'deck-container', props: { gridWidth: 6 },
    });
    expect(container.type).toBe('deck-container');
  });

  it('rejects invalid component type', () => {
    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'invalid-component', props: {},
    })).toThrow();
  });

  it('rejects old component types', () => {
    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'deck-title', props: { text: 'Hello' },
    })).toThrow();
    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'deck-subtitle', props: { text: 'Sub' },
    })).toThrow();
    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'deck-list', props: { items: ['a'] },
    })).toThrow();
    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'deck-floating-image', props: { assetId: 'a' },
    })).toThrow();
    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'deck-code', props: { code: 'x' },
    })).toThrow();
    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'deck-quote', props: { text: 'q' },
    })).toThrow();
    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'deck-columns', props: { columns: [] },
    })).toThrow();
    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'deck-spacer', props: {},
    })).toThrow();
    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'deck-headline-subhead', props: { headline: 'H' },
    })).toThrow();
  });

  it('rejects mismatched props for type', () => {
    // deck-image requires assetId
    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'deck-image', props: { content: 'hello' },
    })).toThrow();
  });
});

describe('componentTypes', () => {
  it('contains all expected component types', () => {
    expect(componentTypes).toContain('deck-text');
    expect(componentTypes).toContain('deck-image');
    expect(componentTypes).toContain('deck-container');
    expect(componentTypes).toContain('deck-diagram');
  });

  it('has 4 component types', () => {
    expect(componentTypes).toHaveLength(4);
  });
});

describe('parentId on components', () => {
  it('allows parentId on any component type', () => {
    const comp = {
      id: 'child-1',
      parentId: 'container-1',
      type: 'deck-text',
      props: { content: 'Inside container' },
    };
    const result = ComponentSchema.parse(comp);
    expect(result.parentId).toBe('container-1');
  });

  it('parentId is optional', () => {
    const comp = {
      id: 'top-level',
      type: 'deck-text',
      props: { content: 'No parent' },
    };
    const result = ComponentSchema.parse(comp);
    expect(result.parentId).toBeUndefined();
  });
});

describe('gridWidth across components', () => {
  it('text and image have optional gridWidth', () => {
    const textWithout = ComponentSchema.parse({
      id: 'c1', type: 'deck-text', props: { content: 't' },
    });
    expect((textWithout.props as { gridWidth?: number }).gridWidth).toBeUndefined();

    const textWith = ComponentSchema.parse({
      id: 'c2', type: 'deck-text', props: { content: 't', gridWidth: 6 },
    });
    expect((textWith.props as { gridWidth?: number }).gridWidth).toBe(6);

    const imageWithout = ComponentSchema.parse({
      id: 'c3', type: 'deck-image', props: { assetId: 'a' },
    });
    expect((imageWithout.props as { gridWidth?: number }).gridWidth).toBeUndefined();

    const imageWith = ComponentSchema.parse({
      id: 'c4', type: 'deck-image', props: { assetId: 'a', gridWidth: 4 },
    });
    expect((imageWith.props as { gridWidth?: number }).gridWidth).toBe(4);
  });

  it('container has required gridWidth', () => {
    const result = ComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: { gridWidth: 6 },
    });
    expect((result.props as { gridWidth: number }).gridWidth).toBe(6);

    expect(() => ComponentSchema.parse({
      id: 'c1', type: 'deck-container', props: {},
    })).toThrow();
  });
});
