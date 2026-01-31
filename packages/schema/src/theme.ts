import { z } from 'zod';

/**
 * Standard design tokens - consistent names across all decks.
 * Components reference these via CSS custom properties (--deck-*).
 */
export const StandardTokensSchema = z.object({
  // Typography
  'font-display': z.string().describe('Display/heading font family'),
  'font-body': z.string().describe('Body text font family'),
  'font-mono': z.string().optional().describe('Monospace/code font family'),
  'font-size-base': z.string().optional().describe('Base font size (e.g., "16px" or "clamp(...)")'),
  'font-size-scale': z.number().optional().describe('Type scale ratio (e.g., 1.25 for major third)'),

  // Colors - semantic naming
  'color-background': z.string().describe('Primary background color'),
  'color-surface': z.string().optional().describe('Surface/card background color'),
  'color-text-primary': z.string().describe('Primary text color'),
  'color-text-secondary': z.string().optional().describe('Secondary/muted text color'),
  'color-accent': z.string().describe('Accent/brand color'),
  'color-accent-contrast': z.string().optional().describe('Text color on accent background'),

  // Spacing
  'space-unit': z.string().optional().describe('Base spacing unit (e.g., "8px")'),
  'space-scale': z.number().optional().describe('Spacing scale ratio'),

  // Effects
  'radius-sm': z.string().optional().describe('Small border radius'),
  'radius-md': z.string().optional().describe('Medium border radius'),
  'radius-lg': z.string().optional().describe('Large border radius'),
  'shadow-sm': z.string().optional().describe('Small shadow'),
  'shadow-md': z.string().optional().describe('Medium shadow'),
  'shadow-lg': z.string().optional().describe('Large shadow'),

  // Grid
  'grid-gap': z.string().optional().describe('Gap between grid items'),
});

export type StandardTokens = z.infer<typeof StandardTokensSchema>;

/**
 * Custom tokens - deck-specific tokens that components can declare as requirements.
 * Keyed by token name (e.g., "color-hero-overlay").
 */
export const CustomTokensSchema = z.record(z.string(), z.string());

export type CustomTokens = z.infer<typeof CustomTokensSchema>;

/**
 * Theme definition
 */
export const ThemeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  tokens: StandardTokensSchema,
  customTokens: CustomTokensSchema.optional(),
  css: z.string().optional(), // Additional raw CSS
});

export type Theme = z.infer<typeof ThemeSchema>;

/**
 * Default theme with sensible defaults
 */
export const defaultTheme: Theme = {
  id: 'default',
  name: 'Default',
  tokens: {
    // Typography
    'font-display': 'system-ui, -apple-system, sans-serif',
    'font-body': 'system-ui, -apple-system, sans-serif',
    'font-mono': 'ui-monospace, monospace',
    'font-size-base': '16px',
    'font-size-scale': 1.25,

    // Colors
    'color-background': '#ffffff',
    'color-surface': '#f8fafc',
    'color-text-primary': '#1a1a2e',
    'color-text-secondary': '#64748b',
    'color-accent': '#3b82f6',
    'color-accent-contrast': '#ffffff',

    // Spacing
    'space-unit': '8px',
    'space-scale': 1.5,

    // Effects
    'radius-sm': '4px',
    'radius-md': '8px',
    'radius-lg': '12px',
    'shadow-sm': '0 1px 2px rgba(0,0,0,0.05)',
    'shadow-md': '0 4px 6px -1px rgba(0,0,0,0.1)',
    'shadow-lg': '0 10px 15px -3px rgba(0,0,0,0.1)',

    // Grid
    'grid-gap': '16px',
  },
};

/**
 * Generate computed spacing values from base unit and scale.
 * Returns CSS values for xs, sm, md, lg, xl, 2xl spacing.
 */
export function computeSpacingScale(baseUnit: string, scale: number): Record<string, string> {
  const base = parseFloat(baseUnit);
  const unit = baseUnit.replace(/[\d.]/g, '') || 'px';
  
  return {
    'space-xs': `${base / scale}${unit}`,
    'space-sm': `${base / Math.sqrt(scale)}${unit}`,
    'space-md': `${base}${unit}`,
    'space-lg': `${base * Math.sqrt(scale)}${unit}`,
    'space-xl': `${base * scale}${unit}`,
    'space-2xl': `${base * scale * Math.sqrt(scale)}${unit}`,
    'space-3xl': `${base * scale * scale}${unit}`,
  };
}

/**
 * Generate computed font size values from base and scale.
 * Returns CSS values for xs through 5xl.
 */
export function computeTypographyScale(baseSize: string, scale: number): Record<string, string> {
  const base = parseFloat(baseSize);
  const unit = baseSize.replace(/[\d.]/g, '') || 'px';
  
  return {
    'font-size-xs': `${base / scale / scale}${unit}`,
    'font-size-sm': `${base / scale}${unit}`,
    'font-size-md': `${base}${unit}`,
    'font-size-lg': `${base * scale}${unit}`,
    'font-size-xl': `${base * scale * scale}${unit}`,
    'font-size-2xl': `${base * scale * scale * scale}${unit}`,
    'font-size-3xl': `${base * Math.pow(scale, 4)}${unit}`,
    'font-size-4xl': `${base * Math.pow(scale, 5)}${unit}`,
    'font-size-5xl': `${base * Math.pow(scale, 6)}${unit}`,
  };
}

/**
 * Convert theme tokens to CSS custom properties string.
 * Used by components to apply theme via style attribute.
 */
export function themeToCssProperties(theme: Theme): Record<string, string> {
  const props: Record<string, string> = {};

  // Standard tokens
  for (const [key, value] of Object.entries(theme.tokens)) {
    if (value !== undefined) {
      props[`--deck-${key}`] = String(value);
    }
  }

  // Computed scales
  const baseSize = theme.tokens['font-size-base'] || '16px';
  const typeScale = theme.tokens['font-size-scale'] || 1.25;
  const spaceUnit = theme.tokens['space-unit'] || '8px';
  const spaceScale = theme.tokens['space-scale'] || 1.5;

  for (const [key, value] of Object.entries(computeTypographyScale(baseSize, typeScale))) {
    props[`--deck-${key}`] = value;
  }

  for (const [key, value] of Object.entries(computeSpacingScale(spaceUnit, spaceScale))) {
    props[`--deck-${key}`] = value;
  }

  // Custom tokens
  if (theme.customTokens) {
    for (const [key, value] of Object.entries(theme.customTokens)) {
      props[`--deck-${key}`] = value;
    }
  }

  return props;
}
