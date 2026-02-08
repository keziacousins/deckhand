import React, { useRef, useCallback } from 'react';
import type { InspectorSectionProps } from '../types';
import { scrollHeaderToSticky } from '../types';
import { TextField } from '../fields/TextField';
import { ColorField } from '../fields/ColorField';
import { NumberField } from '../fields/NumberField';
import { useInspectorExpansion } from '../context/InspectorExpansionContext';

const HEADER_HEIGHT = 37;

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
      { key: 'color-background', label: 'Background', type: 'color' as const },
      { key: 'color-surface', label: 'Surface', type: 'color' as const },
      { key: 'color-text-primary', label: 'Text Primary', type: 'color' as const },
      { key: 'color-text-secondary', label: 'Text Secondary', type: 'color' as const },
      { key: 'color-accent', label: 'Accent', type: 'color' as const },
      { key: 'color-accent-contrast', label: 'Accent Contrast', type: 'color' as const },
    ],
  },
  {
    id: 'theme-spacing',
    label: 'Spacing',
    tokens: [
      { key: 'content-padding-top', label: 'Content Padding Top', type: 'text' as const },
      { key: 'content-padding-sides', label: 'Content Padding Sides', type: 'text' as const },
      { key: 'grid-gap', label: 'Grid Gap', type: 'text' as const },
      { key: 'space-unit', label: 'Base Unit', type: 'text' as const },
      { key: 'space-scale', label: 'Scale', type: 'number' as const },
    ],
  },
  {
    id: 'theme-effects',
    label: 'Effects',
    tokens: [
      { key: 'radius-sm', label: 'Radius SM', type: 'text' as const },
      { key: 'radius-md', label: 'Radius MD', type: 'text' as const },
      { key: 'radius-lg', label: 'Radius LG', type: 'text' as const },
    ],
  },
];

export function ThemeSection({ context, stickyIndex = 0 }: InspectorSectionProps) {
  const { deck, onUpdate } = context;
  const theme = deck.theme;
  const { isExpanded, expand, toggle } = useInspectorExpansion();
  const headerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleHeaderClick = useCallback((sectionId: string) => {
    expand(sectionId);
    const header = headerRefs.current.get(sectionId);
    if (header) setTimeout(() => scrollHeaderToSticky(header), 250);
  }, [expand]);

  const handleTokenChange = (key: string, value: string | number | undefined) => {
    onUpdate({ type: 'theme', field: key, value });
  };

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

  const themeSectionId = 'theme-name';
  const themeExpanded = isExpanded(themeSectionId);

  return (
    <>
      {/* Theme Name */}
      <div
        ref={(el) => { if (el) headerRefs.current.set(themeSectionId, el); else headerRefs.current.delete(themeSectionId); }}
        className="section-header"
        data-expanded={themeExpanded}
        style={{ '--sticky-top': `${stickyIndex * HEADER_HEIGHT}px`, '--sticky-index': stickyIndex } as React.CSSProperties}
        onClick={() => handleHeaderClick(themeSectionId)}
      >
        <button className="section-header-expand" onClick={(e) => { e.stopPropagation(); toggle(themeSectionId); }} title={themeExpanded ? 'Collapse' : 'Expand'}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={themeExpanded ? 'section-header-chevron-expanded' : ''}>
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="section-header-title">
          <span className="section-header-name">Theme</span>
          {!themeExpanded && theme.name && (
            <span className="section-header-meta">{theme.name}</span>
          )}
        </div>
      </div>
      <div className="section-body" data-expanded={themeExpanded}>
        <div className="section-body-inner">
          <div className="section-body-overflow">
            <div className="section-body-content">
              <TextField
                label="Name"
                value={theme.name ?? ''}
                onChange={(v) => handleTokenChange('name', v)}
                placeholder="Theme name"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Token Groups */}
      {TOKEN_GROUPS.map((group, i) => {
        const groupExpanded = isExpanded(group.id);
        const groupStickyIndex = stickyIndex + 1 + i;
        return (
          <React.Fragment key={group.id}>
            <div
              ref={(el) => { if (el) headerRefs.current.set(group.id, el); else headerRefs.current.delete(group.id); }}
              className="section-header"
              data-expanded={groupExpanded}
              style={{ '--sticky-top': `${groupStickyIndex * HEADER_HEIGHT}px`, '--sticky-index': groupStickyIndex } as React.CSSProperties}
              onClick={() => handleHeaderClick(group.id)}
            >
              <button className="section-header-expand" onClick={(e) => { e.stopPropagation(); toggle(group.id); }} title={groupExpanded ? 'Collapse' : 'Expand'}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={groupExpanded ? 'section-header-chevron-expanded' : ''}>
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="section-header-title">
                <span className="section-header-name">{group.label}</span>
              </div>
            </div>
            <div className="section-body" data-expanded={groupExpanded}>
              <div className="section-body-inner">
                <div className="section-body-overflow">
                  <div className="section-body-content">
                    {group.tokens.map(renderTokenField)}
                  </div>
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
}
