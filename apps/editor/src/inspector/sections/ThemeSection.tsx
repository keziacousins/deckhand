import React from 'react';
import type { InspectorSectionProps } from '../types';
import { TextField } from '../fields/TextField';
import { ColorField } from '../fields/ColorField';
import { NumberField } from '../fields/NumberField';
import { Section } from '../components/Section';

// Token groups for organized display
const TOKEN_GROUPS = [
  {
    id: 'theme-typography',
    label: 'Typography',
    tokens: [
      { key: 'font-display', label: 'Display Font', type: 'text' as const },
      { key: 'font-body', label: 'Body Font', type: 'text' as const },
      { key: 'font-mono', label: 'Mono Font', type: 'text' as const },
      { key: 'font-size-base', label: 'Base Size', type: 'text' as const },
      { key: 'font-size-scale', label: 'Type Scale', type: 'number' as const },
    ],
  },
  {
    id: 'theme-colors',
    label: 'Colors',
    tokens: [
      { key: 'color-background', label: 'Background', type: 'color' as const, compact: true },
      { key: 'color-surface', label: 'Surface', type: 'color' as const, compact: true },
      { key: 'color-text-primary', label: 'Text', type: 'color' as const, compact: true },
      { key: 'color-text-secondary', label: 'Text 2nd', type: 'color' as const, compact: true },
      { key: 'color-accent', label: 'Accent', type: 'color' as const, compact: true },
      { key: 'color-accent-contrast', label: 'Accent Alt', type: 'color' as const, compact: true },
    ],
  },
  {
    id: 'theme-spacing',
    label: 'Spacing',
    tokens: [
      { key: 'content-padding-top', label: 'Padding Top', type: 'text' as const, compact: true },
      { key: 'content-padding-sides', label: 'Padding Sides', type: 'text' as const, compact: true },
      { key: 'grid-gap', label: 'Grid Gap', type: 'text' as const, compact: true },
      { key: 'space-unit', label: 'Base Unit', type: 'text' as const, compact: true },
      { key: 'space-scale', label: 'Scale', type: 'number' as const, compact: true },
    ],
  },
  {
    id: 'theme-effects',
    label: 'Effects',
    tokens: [
      { key: 'radius-sm', label: 'Radius SM', type: 'text' as const, compact: true },
      { key: 'radius-md', label: 'Radius MD', type: 'text' as const, compact: true },
      { key: 'radius-lg', label: 'Radius LG', type: 'text' as const, compact: true },
    ],
  },
];

export function ThemeSection({ context, stickyIndex = 0 }: InspectorSectionProps) {
  const { deck, onUpdate } = context;
  const theme = deck.theme;

  const handleTokenChange = (key: string, value: string | number | undefined) => {
    onUpdate({ type: 'theme', field: key, value });
  };

  const renderTokenField = (token: { key: string; label: string; type: 'text' | 'color' | 'number'; compact?: boolean }) => {
    const value = theme.tokens[token.key as keyof typeof theme.tokens];

    if (token.type === 'color') {
      return (
        <ColorField
          key={token.key}
          label={token.label}
          value={(value as string) ?? ''}
          onChange={(v) => handleTokenChange(token.key, v)}
          compact={token.compact}
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
          compact={token.compact}
        />
      );
    }

    return (
      <TextField
        key={token.key}
        label={token.label}
        value={(value as string) ?? ''}
        onChange={(v) => handleTokenChange(token.key, v)}
        compact={token.compact}
      />
    );
  };

  return (
    <>
      <Section id="theme-name" name="Theme" stickyIndex={stickyIndex} meta={theme.name || undefined}>
        <TextField
          label="Name"
          value={theme.name ?? ''}
          onChange={(v) => handleTokenChange('name', v)}
          placeholder="Theme name"
        />
      </Section>

      {TOKEN_GROUPS.map((group, i) => (
        <Section key={group.id} id={group.id} name={group.label} stickyIndex={stickyIndex + 1 + i}>
          {group.tokens.map(renderTokenField)}
        </Section>
      ))}
    </>
  );
}
