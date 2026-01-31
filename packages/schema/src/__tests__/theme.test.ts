import { describe, it, expect } from 'vitest';
import {
  ThemeSchema,
  StandardTokensSchema,
  CustomTokensSchema,
  defaultTheme,
  computeSpacingScale,
  computeTypographyScale,
  themeToCssProperties,
} from '../theme';

describe('StandardTokensSchema', () => {
  it('validates minimal required tokens', () => {
    const tokens = {
      'font-display': 'Arial, sans-serif',
      'font-body': 'Georgia, serif',
      'color-background': '#ffffff',
      'color-text-primary': '#000000',
      'color-accent': '#0066cc',
    };
    expect(StandardTokensSchema.parse(tokens)).toEqual(tokens);
  });

  it('validates all optional tokens', () => {
    const tokens = {
      'font-display': 'Arial',
      'font-body': 'Georgia',
      'font-mono': 'Courier New',
      'font-size-base': '18px',
      'font-size-scale': 1.333,
      'color-background': '#fff',
      'color-surface': '#f5f5f5',
      'color-text-primary': '#111',
      'color-text-secondary': '#666',
      'color-accent': '#00f',
      'color-accent-contrast': '#fff',
      'space-unit': '4px',
      'space-scale': 2,
      'radius-sm': '2px',
      'radius-md': '4px',
      'radius-lg': '8px',
      'shadow-sm': '0 1px 2px rgba(0,0,0,0.1)',
      'shadow-md': '0 2px 4px rgba(0,0,0,0.1)',
      'shadow-lg': '0 4px 8px rgba(0,0,0,0.1)',
      'grid-gap': '24px',
    };
    const result = StandardTokensSchema.parse(tokens);
    expect(result['grid-gap']).toBe('24px');
    expect(result['font-size-scale']).toBe(1.333);
  });

  it('rejects missing required tokens', () => {
    expect(() => StandardTokensSchema.parse({})).toThrow();
    expect(() => StandardTokensSchema.parse({
      'font-display': 'Arial',
      // missing font-body, colors
    })).toThrow();
  });
});

describe('CustomTokensSchema', () => {
  it('validates empty custom tokens', () => {
    expect(CustomTokensSchema.parse({})).toEqual({});
  });

  it('validates custom token map', () => {
    const custom = {
      'color-hero-overlay': 'rgba(0,0,0,0.5)',
      'gradient-primary': 'linear-gradient(45deg, #f00, #00f)',
    };
    expect(CustomTokensSchema.parse(custom)).toEqual(custom);
  });
});

describe('ThemeSchema', () => {
  it('validates minimal theme', () => {
    const theme = {
      id: 'my-theme',
      tokens: {
        'font-display': 'Arial',
        'font-body': 'Georgia',
        'color-background': '#fff',
        'color-text-primary': '#000',
        'color-accent': '#00f',
      },
    };
    expect(ThemeSchema.parse(theme).id).toBe('my-theme');
  });

  it('validates theme with all fields', () => {
    const theme = {
      id: 'full-theme',
      name: 'Full Theme',
      tokens: {
        'font-display': 'Arial',
        'font-body': 'Georgia',
        'color-background': '#fff',
        'color-text-primary': '#000',
        'color-accent': '#00f',
      },
      customTokens: {
        'my-custom': 'value',
      },
      css: '.custom { color: red; }',
    };
    const result = ThemeSchema.parse(theme);
    expect(result.name).toBe('Full Theme');
    expect(result.customTokens?.['my-custom']).toBe('value');
    expect(result.css).toBe('.custom { color: red; }');
  });

  it('rejects theme without id', () => {
    expect(() => ThemeSchema.parse({
      tokens: defaultTheme.tokens,
    })).toThrow();
  });
});

describe('defaultTheme', () => {
  it('is a valid theme', () => {
    const result = ThemeSchema.safeParse(defaultTheme);
    expect(result.success).toBe(true);
  });

  it('has id "default"', () => {
    expect(defaultTheme.id).toBe('default');
  });

  it('has name "Default"', () => {
    expect(defaultTheme.name).toBe('Default');
  });

  it('has all required tokens', () => {
    expect(defaultTheme.tokens['font-display']).toBeDefined();
    expect(defaultTheme.tokens['font-body']).toBeDefined();
    expect(defaultTheme.tokens['color-background']).toBeDefined();
    expect(defaultTheme.tokens['color-text-primary']).toBeDefined();
    expect(defaultTheme.tokens['color-accent']).toBeDefined();
  });

  it('has grid-gap token', () => {
    expect(defaultTheme.tokens['grid-gap']).toBe('16px');
  });

  it('has typography scale values', () => {
    expect(defaultTheme.tokens['font-size-base']).toBe('16px');
    expect(defaultTheme.tokens['font-size-scale']).toBe(1.25);
  });

  it('has spacing scale values', () => {
    expect(defaultTheme.tokens['space-unit']).toBe('8px');
    expect(defaultTheme.tokens['space-scale']).toBe(1.5);
  });

  it('has effect tokens', () => {
    expect(defaultTheme.tokens['radius-sm']).toBe('4px');
    expect(defaultTheme.tokens['radius-md']).toBe('8px');
    expect(defaultTheme.tokens['radius-lg']).toBe('12px');
    expect(defaultTheme.tokens['shadow-sm']).toBeDefined();
    expect(defaultTheme.tokens['shadow-md']).toBeDefined();
    expect(defaultTheme.tokens['shadow-lg']).toBeDefined();
  });
});

describe('computeSpacingScale', () => {
  it('computes spacing scale from base unit', () => {
    const scale = computeSpacingScale('8px', 1.5);
    
    // Check that values are computed
    expect(scale['space-xs']).toBeDefined();
    expect(scale['space-sm']).toBeDefined();
    expect(scale['space-md']).toBeDefined();
    expect(scale['space-lg']).toBeDefined();
    expect(scale['space-xl']).toBeDefined();
    expect(scale['space-2xl']).toBeDefined();
    expect(scale['space-3xl']).toBeDefined();
  });

  it('space-md equals base unit', () => {
    const scale = computeSpacingScale('8px', 1.5);
    expect(scale['space-md']).toBe('8px');
  });

  it('space-xl equals base * scale', () => {
    const scale = computeSpacingScale('8px', 2);
    expect(scale['space-xl']).toBe('16px');
  });

  it('preserves unit from base', () => {
    const scalePx = computeSpacingScale('10px', 2);
    expect(scalePx['space-md']).toMatch(/px$/);

    const scaleRem = computeSpacingScale('1rem', 2);
    expect(scaleRem['space-md']).toMatch(/rem$/);
  });

  it('handles different scale ratios', () => {
    const smallScale = computeSpacingScale('8px', 1.25);
    const largeScale = computeSpacingScale('8px', 2);
    
    // Larger scale should produce bigger space-xl
    expect(parseFloat(largeScale['space-xl'])).toBeGreaterThan(
      parseFloat(smallScale['space-xl'])
    );
  });
});

describe('computeTypographyScale', () => {
  it('computes font size scale from base', () => {
    const scale = computeTypographyScale('16px', 1.25);
    
    expect(scale['font-size-xs']).toBeDefined();
    expect(scale['font-size-sm']).toBeDefined();
    expect(scale['font-size-md']).toBeDefined();
    expect(scale['font-size-lg']).toBeDefined();
    expect(scale['font-size-xl']).toBeDefined();
    expect(scale['font-size-2xl']).toBeDefined();
    expect(scale['font-size-3xl']).toBeDefined();
    expect(scale['font-size-4xl']).toBeDefined();
    expect(scale['font-size-5xl']).toBeDefined();
  });

  it('font-size-md equals base size', () => {
    const scale = computeTypographyScale('16px', 1.25);
    expect(scale['font-size-md']).toBe('16px');
  });

  it('font-size-lg equals base * scale', () => {
    const scale = computeTypographyScale('16px', 1.25);
    expect(scale['font-size-lg']).toBe('20px'); // 16 * 1.25 = 20
  });

  it('preserves unit from base', () => {
    const scalePx = computeTypographyScale('16px', 1.25);
    expect(scalePx['font-size-lg']).toMatch(/px$/);

    const scaleRem = computeTypographyScale('1rem', 1.25);
    expect(scaleRem['font-size-lg']).toMatch(/rem$/);
  });

  it('sizes increase progressively', () => {
    const scale = computeTypographyScale('16px', 1.25);
    const sizes = [
      parseFloat(scale['font-size-xs']),
      parseFloat(scale['font-size-sm']),
      parseFloat(scale['font-size-md']),
      parseFloat(scale['font-size-lg']),
      parseFloat(scale['font-size-xl']),
    ];
    
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    }
  });
});

describe('themeToCssProperties', () => {
  it('converts tokens to CSS custom properties', () => {
    const props = themeToCssProperties(defaultTheme);
    
    expect(props['--deck-font-display']).toBe(defaultTheme.tokens['font-display']);
    expect(props['--deck-font-body']).toBe(defaultTheme.tokens['font-body']);
    expect(props['--deck-color-background']).toBe(defaultTheme.tokens['color-background']);
    expect(props['--deck-color-accent']).toBe(defaultTheme.tokens['color-accent']);
  });

  it('includes grid-gap token', () => {
    const props = themeToCssProperties(defaultTheme);
    expect(props['--deck-grid-gap']).toBe('16px');
  });

  it('includes computed spacing scale', () => {
    const props = themeToCssProperties(defaultTheme);
    
    expect(props['--deck-space-xs']).toBeDefined();
    expect(props['--deck-space-sm']).toBeDefined();
    expect(props['--deck-space-md']).toBeDefined();
    expect(props['--deck-space-lg']).toBeDefined();
    expect(props['--deck-space-xl']).toBeDefined();
  });

  it('includes computed typography scale', () => {
    const props = themeToCssProperties(defaultTheme);
    
    expect(props['--deck-font-size-xs']).toBeDefined();
    expect(props['--deck-font-size-sm']).toBeDefined();
    expect(props['--deck-font-size-md']).toBeDefined();
    expect(props['--deck-font-size-lg']).toBeDefined();
    expect(props['--deck-font-size-xl']).toBeDefined();
  });

  it('includes custom tokens with --deck- prefix', () => {
    const theme = {
      ...defaultTheme,
      customTokens: {
        'hero-gradient': 'linear-gradient(red, blue)',
      },
    };
    const props = themeToCssProperties(theme);
    expect(props['--deck-hero-gradient']).toBe('linear-gradient(red, blue)');
  });

  it('uses default values for missing optional tokens', () => {
    const minimalTheme = {
      id: 'minimal',
      tokens: {
        'font-display': 'Arial',
        'font-body': 'Georgia',
        'color-background': '#fff',
        'color-text-primary': '#000',
        'color-accent': '#00f',
      },
    };
    const props = themeToCssProperties(minimalTheme);
    
    // Should still compute scales using defaults
    expect(props['--deck-font-size-md']).toBe('16px');
    expect(props['--deck-space-md']).toBe('8px');
  });

  it('converts numeric values to strings', () => {
    const props = themeToCssProperties(defaultTheme);
    
    // font-size-scale is a number in tokens, should be string in CSS props
    expect(typeof props['--deck-font-size-scale']).toBe('string');
    expect(props['--deck-font-size-scale']).toBe('1.25');
  });

  it('omits undefined tokens', () => {
    const theme = {
      id: 'test',
      tokens: {
        'font-display': 'Arial',
        'font-body': 'Georgia',
        'color-background': '#fff',
        'color-text-primary': '#000',
        'color-accent': '#00f',
        // font-mono is undefined
      },
    };
    const props = themeToCssProperties(theme);
    expect('--deck-font-mono' in props).toBe(false);
  });
});
