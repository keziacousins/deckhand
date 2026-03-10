/**
 * Generic Component Renderer
 * 
 * Renders any deck component without hardcoded switch statements.
 * Uses component metadata from the registry to map props to HTML attributes.
 */

import React from 'react';
import { registry } from '@deckhand/components';
import type { ComponentMeta } from '@deckhand/components';
import type { Component, Asset } from '@deckhand/schema';

interface RenderOptions {
  /** Include data-component-id and selection class for editor mode */
  editorMode?: boolean;
  /** Currently selected component ID (for applying selection styling) */
  selectedComponentId?: string;
  /** Assets map for resolving asset IDs to URLs */
  assets?: Record<string, Asset>;
}

/**
 * Convert camelCase to kebab-case for HTML attributes
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Convert component props to HTML attributes based on metadata
 */
function propsToAttributes(
  component: Component,
  meta: ComponentMeta | undefined,
  options: RenderOptions
): Record<string, string | undefined> {
  const attrs: Record<string, string | undefined> = {};
  let hasAssetProp = false;

  // Editor-mode attributes
  if (options.editorMode) {
    attrs['data-component-id'] = component.id;
    if (options.selectedComponentId === component.id) {
      attrs['class'] = 'component-selected';
    }
  }

  // Convert each prop based on meta type
  for (const [key, value] of Object.entries(component.props ?? {})) {
    if (value === undefined || value === null) continue;

    const attrName = camelToKebab(key);
    const propMeta = meta?.properties[key];

    if (!propMeta) {
      // Unknown prop - stringify if object/array, otherwise direct
      attrs[attrName] = typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
      continue;
    }

    switch (propMeta.type) {
      case 'boolean':
        // Booleans: 'true' or undefined (omit attribute)
        attrs[attrName] = value ? 'true' : undefined;
        break;
      case 'number':
        attrs[attrName] = String(value);
        break;
      case 'richtext':
        // Rich text is an array of spans - JSON stringify
        attrs[attrName] = JSON.stringify(value);
        break;
      case 'asset':
        // Asset IDs are passed as-is; component will resolve via assets attribute
        attrs[attrName] = String(value);
        hasAssetProp = true;
        break;
      default:
        // string, text, enum, color, alignment, spacing
        // Arrays/objects that aren't richtext
        if (typeof value === 'object') {
          attrs[attrName] = JSON.stringify(value);
        } else {
          attrs[attrName] = String(value);
        }
    }
  }

  // If component has asset properties, include the assets map
  if (hasAssetProp && options.assets) {
    attrs['assets'] = JSON.stringify(options.assets);
  }

  return attrs;
}

/**
 * Check if a component is a floating container (has anchorX or anchorY set)
 */
function isFloatingComponent(component: Component): boolean {
  if (component.type !== 'deck-container') return false;
  const props = component.props as Record<string, unknown>;
  return !!(props.anchorX || props.anchorY);
}

interface RenderComponentOptions extends RenderOptions {
  /** All components in the slide, needed for rendering container children */
  allComponents?: Component[];
  /** Component IDs that have links (for rendering link badge in editor) */
  linkedComponentIds?: Set<string>;
  /** When true, sets the `linked` attribute on the component for hover glow */
  linked?: boolean;
}

/**
 * Render a component to a React element
 * 
 * Uses the component's type to look up metadata from the registry,
 * then converts props to HTML attributes and creates the element.
 * 
 * For containers (deck-container), recursively renders child components inside.
 */
export function renderComponent(
  component: Component,
  options: RenderComponentOptions = {}
): React.ReactElement | null {
  // Guard against partially-synced components (e.g. during LLM streaming)
  if (!component.type) return null;

  const meta = registry.getMeta(component.type);

  // Even without meta, try to render - allows for components not yet in registry
  const attrs = propsToAttributes(component, meta, options);

  // Floating containers go in the "floating" slot (outside content padding)
  if (isFloatingComponent(component)) {
    attrs['slot'] = 'floating';
  }

  // Set linked attribute for Shadow DOM hover glow
  if (options.linked) {
    attrs['linked'] = 'true';
  }

  // For containers, render children inside
  if (component.type === 'deck-container' && options.allComponents) {
    const children = options.allComponents.filter(c => c.parentId === component.id);
    const childOptions = { ...options, linked: undefined };
    const childElements = children.map(child => 
      renderComponent(child, childOptions)
    );
    
    return wrapIfLinked(
      React.createElement(
        component.type,
        { key: component.id, ...attrs },
        ...childElements
      ),
      component,
      options,
    );
  }

  // Use createElement to dynamically create the custom element
  return wrapIfLinked(
    React.createElement(component.type, {
      key: component.id,
      ...attrs,
    }),
    component,
    options,
  );
}

/** Link icon badge — small chain-link SVG */
const LinkBadge = React.createElement(
  'div',
  {
    className: 'component-link-badge',
    title: 'Linked to another slide',
  },
  React.createElement(
    'svg',
    { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }),
    React.createElement('path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }),
  )
);

/**
 * If the component has a link, wrap it in a div with a link badge.
 * The wrapper inherits grid-width and data-component-id so slotting and
 * click-to-select still work.
 */
function wrapIfLinked(
  element: React.ReactElement,
  component: Component,
  options: RenderComponentOptions,
): React.ReactElement {
  if (!options.linkedComponentIds?.has(component.id)) return element;

  // Move grid-width and data-component-id to the wrapper so
  // <deck-slide>'s ::slotted() rules and click-to-select still work.
  const props = component.props as Record<string, unknown>;
  const gridWidth = props.gridWidth;
  const borderRadius = props.borderRadius as string | undefined;

  const wrapperStyle: React.CSSProperties = { position: 'relative' };
  if (borderRadius && borderRadius !== 'none') {
    const radiusMap: Record<string, string> = {
      sm: '4px',
      md: '8px',
      lg: '16px',
      full: '50%',
      pill: '9999px',
    };
    wrapperStyle.borderRadius = radiusMap[borderRadius] ?? '0';
  }

  const wrapperAttrs: Record<string, unknown> = {
    key: component.id,
    className: 'component-link-wrapper',
    style: wrapperStyle,
  };
  if (gridWidth !== undefined) {
    wrapperAttrs['grid-width'] = String(gridWidth);
  }
  if (options.editorMode) {
    wrapperAttrs['data-component-id'] = component.id;
  }

  // Strip grid-width and data-component-id from inner element so they
  // don't duplicate on the slotted element
  const innerProps = { ...element.props };
  delete innerProps['grid-width'];
  delete innerProps['data-component-id'];
  const innerElement = React.cloneElement(element, innerProps);

  return React.createElement('div', wrapperAttrs, innerElement, LinkBadge);
}

/**
 * Get top-level components (those without a parentId)
 */
export function getTopLevelComponents(components: Component[]): Component[] {
  return components.filter(c => !c.parentId);
}
