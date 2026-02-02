import { useMemo } from 'react';
import type { InspectorSectionProps } from '../types';
import { TextField } from '../fields/TextField';
import { ColorField } from '../fields/ColorField';
import { NumberField } from '../fields/NumberField';
import { SelectField } from '../fields/SelectField';

// Token groups for organized display
const TOKEN_GROUPS = {
  typography: {
    label: 'Typography',
    tokens: [
      { key: 'font-display', label: 'Display Font', type: 'text' as const },
      { key: 'font-body', label: 'Body Font', type: 'text' as const },
      { key: 'font-mono', label: 'Mono Font', type: 'text' as const },
      { key: 'font-size-base', label: 'Base Size', type: 'text' as const },
      { key: 'font-size-scale', label: 'Type Scale', type: 'number' as const },
    ],
  },
  colors: {
    label: 'Colors',
    tokens: [
      { key: 'color-background', label: 'Background', type: 'color' as const },
      { key: 'color-surface', label: 'Surface', type: 'color' as const },
      { key: 'color-text-primary', label: 'Text Primary', type: 'color' as const },
      { key: 'color-text-secondary', label: 'Text Secondary', type: 'color' as const },
      { key: 'color-accent', label: 'Accent', type: 'color' as const },
      { key: 'color-accent-contrast', label: 'Accent Contrast', type: 'color' as const },
    ],
  },
  spacing: {
    label: 'Spacing',
    tokens: [
      { key: 'content-padding-top', label: 'Content Padding Top', type: 'text' as const },
      { key: 'content-padding-sides', label: 'Content Padding Sides', type: 'text' as const },
      { key: 'grid-gap', label: 'Grid Gap', type: 'text' as const },
      { key: 'space-unit', label: 'Base Unit', type: 'text' as const },
      { key: 'space-scale', label: 'Scale', type: 'number' as const },
    ],
  },
  effects: {
    label: 'Effects',
    tokens: [
      { key: 'radius-sm', label: 'Radius SM', type: 'text' as const },
      { key: 'radius-md', label: 'Radius MD', type: 'text' as const },
      { key: 'radius-lg', label: 'Radius LG', type: 'text' as const },
    ],
  },
};

const ASPECT_RATIO_OPTIONS = [
  { value: '16:9', label: '16:9 (Widescreen)' },
  { value: '16:10', label: '16:10 (Widescreen)' },
  { value: '4:3', label: '4:3 (Standard)' },
];

export function ThemeSection({ context }: InspectorSectionProps) {
  const { deck, onUpdate } = context;
  const theme = deck.theme;

  const handleTokenChange = (key: string, value: string | number | undefined) => {
    onUpdate({ type: 'theme', field: key, value });
  };

  const handleDeckChange = (field: 'title' | 'description', value: string) => {
    onUpdate({ type: 'deck', field, value });
  };

  // Build backdrop slide options
  const backdropOptions = useMemo(() => {
    const options = [{ value: '', label: 'None' }];
    Object.values(deck.slides).forEach(s => {
      options.push({ value: s.id, label: s.title || 'Untitled' });
    });
    return options;
  }, [deck.slides]);

  const renderTokenField = (token: { key: string; label: string; type: 'text' | 'color' | 'number' }) => {
    const value = theme.tokens[token.key as keyof typeof theme.tokens];

    if (token.type === 'color') {
      return (
        <ColorField
          key={token.key}
          label={token.label}
          value={(value as string) ?? ''}
          onChange={(v) => handleTokenChange(token.key, v)}
        />
      );
    }

    if (token.type === 'number') {
      return (
        <NumberField
          key={token.key}
          label={token.label}
          value={(value as number) ?? 0}
          onChange={(v) => handleTokenChange(token.key, v)}
          step={0.05}
          min={0.5}
          max={3}
        />
      );
    }

    return (
      <TextField
        key={token.key}
        label={token.label}
        value={(value as string) ?? ''}
        onChange={(v) => handleTokenChange(token.key, v)}
      />
    );
  };

  return (
    <>
      {/* Deck Properties */}
      <div className="inspector-section">
        <div className="inspector-section-header">Deck</div>
        <div className="inspector-section-content">
          <TextField
            label="Title"
            value={deck.meta.title}
            onChange={(v) => handleDeckChange('title', v)}
          />
          <TextField
            label="Description"
            value={deck.meta.description ?? ''}
            onChange={(v) => handleDeckChange('description', v)}
          />
          <SelectField
            label="Aspect Ratio"
            value={deck.aspectRatio}
            options={ASPECT_RATIO_OPTIONS}
            onChange={(v) => onUpdate({ type: 'deck', field: 'aspectRatio', value: v as '16:9' | '16:10' | '4:3' })}
          />
          <NumberField
            label="Grid Columns"
            value={deck.gridColumns}
            onChange={(v) => onUpdate({ type: 'deck', field: 'gridColumns', value: v })}
            min={4}
            max={16}
          />
          <SelectField
            label="Default Backdrop"
            value={deck.defaultBackdropSlideId ?? ''}
            options={backdropOptions}
            onChange={(v) => onUpdate({ type: 'deck', field: 'defaultBackdropSlideId', value: v || undefined })}
          />
        </div>
      </div>

      {/* Theme Name */}
      <div className="inspector-section">
        <div className="inspector-section-header">Theme</div>
        <div className="inspector-section-content">
          <TextField
            label="Name"
            value={theme.name ?? ''}
            onChange={(v) => handleTokenChange('name', v)}
            placeholder="Theme name"
          />
        </div>
      </div>

      {/* Token Groups */}
      {Object.entries(TOKEN_GROUPS).map(([groupKey, group]) => (
        <div key={groupKey} className="inspector-section">
          <div className="inspector-section-header">{group.label}</div>
          <div className="inspector-section-content">
            {group.tokens.map(renderTokenField)}
          </div>
        </div>
      ))}
    </>
  );
}
