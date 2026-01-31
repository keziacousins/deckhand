/**
 * Component Registry
 * 
 * Central registry for all deck components. Handles:
 * - Component registration with custom elements
 * - Metadata lookup for the inspector
 * - Category-based filtering for component picker
 */

import type { DeckComponentClass } from './base';
import type { ComponentMeta, ComponentCategory } from './types';

class ComponentRegistry {
  private components = new Map<string, DeckComponentClass>();
  private registered = false;

  /**
   * Register a component class.
   * Does NOT define the custom element yet - call registerAll() for that.
   */
  add(component: DeckComponentClass): void {
    if (!component.meta) {
      console.warn(`Component ${component.name} missing static meta`);
      return;
    }
    this.components.set(component.meta.type, component);
  }

  /**
   * Register all components as custom elements.
   * Safe to call multiple times.
   */
  registerAll(): void {
    if (this.registered) return;
    
    for (const [type, component] of this.components) {
      if (!customElements.get(type)) {
        customElements.define(type, component);
      }
    }
    
    this.registered = true;
  }

  /**
   * Get a component class by type
   */
  get(type: string): DeckComponentClass | undefined {
    return this.components.get(type);
  }

  /**
   * Get component metadata by type
   */
  getMeta(type: string): ComponentMeta | undefined {
    return this.components.get(type)?.meta;
  }

  /**
   * Get all registered component types
   */
  getTypes(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Get all component metadata
   */
  getAllMeta(): ComponentMeta[] {
    return Array.from(this.components.values()).map(c => c.meta);
  }

  /**
   * Get components by category
   */
  getByCategory(category: ComponentCategory): ComponentMeta[] {
    return this.getAllMeta().filter(m => m.category === category);
  }

  /**
   * Get all categories with their components
   */
  getGroupedByCategory(): Record<ComponentCategory, ComponentMeta[]> {
    const grouped: Record<string, ComponentMeta[]> = {};
    
    for (const meta of this.getAllMeta()) {
      if (!grouped[meta.category]) {
        grouped[meta.category] = [];
      }
      grouped[meta.category].push(meta);
    }
    
    return grouped as Record<ComponentCategory, ComponentMeta[]>;
  }

  /**
   * Check if a component type is registered
   */
  has(type: string): boolean {
    return this.components.has(type);
  }

  /**
   * Get required custom tokens for a set of component types
   */
  getRequiredTokens(types: string[]): string[] {
    const tokens = new Set<string>();
    
    for (const type of types) {
      const meta = this.getMeta(type);
      if (meta?.requiredTokens) {
        for (const token of meta.requiredTokens) {
          tokens.add(token);
        }
      }
    }
    
    return Array.from(tokens);
  }
}

/**
 * Global component registry instance
 */
export const registry = new ComponentRegistry();

/**
 * Helper to register a component
 */
export function registerComponent(component: DeckComponentClass): void {
  registry.add(component);
}

/**
 * Helper to register multiple components at once
 */
export function registerComponents(...components: DeckComponentClass[]): void {
  for (const component of components) {
    registry.add(component);
  }
}
