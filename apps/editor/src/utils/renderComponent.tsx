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
  for (const [key, value] of Object.entries(component.props)) {
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
 * Render a component to a React element
 * 
 * Uses the component's type to look up metadata from the registry,
 * then converts props to HTML attributes and creates the element.
 */
export function renderComponent(
  component: Component,
  options: RenderOptions = {}
): React.ReactElement | null {
  const meta = registry.getMeta(component.type);
  
  // Even without meta, try to render - allows for components not yet in registry
  const attrs = propsToAttributes(component, meta, options);

  // Use createElement to dynamically create the custom element
  return React.createElement(component.type, {
    key: component.id,
    ...attrs,
  });
}
