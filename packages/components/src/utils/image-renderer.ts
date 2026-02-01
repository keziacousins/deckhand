/**
 * Shared image rendering utilities for deck components.
 * 
 * Provides consistent image display with sizing, darkening, and blur options.
 * Used by deck-slide (background) and deck-image components.
 */

export interface ImageRenderOptions {
  /** Asset ID to resolve */
  assetId?: string;
  /** JSON string of assets map */
  assetsJson?: string;
  /** Direct URL (fallback if no assetId) */
  url?: string;
  /** Sizing mode */
  size?: 'fill' | 'fit-width' | 'fit-height' | 'contain' | 'cover';
  /** Darken amount 0-100 (percentage) */
  darken?: number;
  /** Blur amount in pixels */
  blur?: number;
  /** CSS position (default: center) */
  position?: string;
}

/**
 * Resolve an asset ID to a URL using the assets map.
 */
export function resolveAssetUrl(assetId: string | undefined, assetsJson: string | undefined): string | undefined {
  if (!assetId || !assetsJson) return undefined;
  
  try {
    const assets = JSON.parse(assetsJson);
    return assets[assetId]?.url;
  } catch {
    return undefined;
  }
}

/**
 * Map size values to CSS background-size.
 */
export function sizeToCss(size: string | undefined): string {
  switch (size) {
    case 'fill':
    case 'cover':
      return 'cover';
    case 'fit-width':
      return '100% auto';
    case 'fit-height':
      return 'auto 100%';
    case 'contain':
      return 'contain';
    default:
      return 'cover';
  }
}

/**
 * Generate CSS styles for image container.
 */
export function generateImageContainerStyles(options: ImageRenderOptions): string {
  const url = options.url || resolveAssetUrl(options.assetId, options.assetsJson);
  if (!url) return '';

  const size = sizeToCss(options.size);
  const position = options.position || 'center';
  const blur = options.blur || 0;

  return `
    background-image: url(${url});
    background-size: ${size};
    background-position: ${position};
    background-repeat: no-repeat;
    ${blur > 0 ? `filter: blur(${blur}px);` : ''}
  `;
}

/**
 * Generate HTML for an image background with optional overlay.
 * Returns both the element HTML and associated styles.
 */
export function generateImageBackgroundHtml(options: ImageRenderOptions): {
  html: string;
  styles: string;
} {
  const url = options.url || resolveAssetUrl(options.assetId, options.assetsJson);
  
  if (!url) {
    return { html: '', styles: '' };
  }

  const size = sizeToCss(options.size);
  const position = options.position || 'center';
  const blur = options.blur || 0;
  const darken = options.darken || 0;

  const styles = `
    .image-background {
      position: absolute;
      inset: 0;
      background-image: url(${url});
      background-size: ${size};
      background-position: ${position};
      background-repeat: no-repeat;
      z-index: 0;
      pointer-events: none;
      ${blur > 0 ? `filter: blur(${blur}px);` : ''}
    }
    ${darken > 0 ? `
    .image-background-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, ${darken / 100});
      z-index: 0;
      pointer-events: none;
    }
    ` : ''}
  `;

  const html = `
    <div class="image-background"></div>
    ${darken > 0 ? '<div class="image-background-overlay"></div>' : ''}
  `;

  return { html, styles };
}

/**
 * Generate HTML for a foreground image (like deck-image).
 */
export function generateImageElementHtml(options: ImageRenderOptions & {
  alt?: string;
  caption?: string;
  maxHeight?: number;
}): {
  html: string;
  styles: string;
} {
  const url = options.url || resolveAssetUrl(options.assetId, options.assetsJson);
  const alt = options.alt || '';
  const caption = options.caption;
  const darken = options.darken || 0;
  const blur = options.blur || 0;
  const maxHeight = options.maxHeight;

  if (!url) {
    // Placeholder when no image
    const styles = `
      .image-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 200px;
        background: var(--deck-color-surface, #f1f5f9);
        border: 2px dashed var(--deck-color-border, #cbd5e1);
        border-radius: var(--deck-radius-md, 8px);
        color: var(--deck-color-text-secondary, #64748b);
        font-family: var(--deck-font-body, system-ui, sans-serif);
        font-size: var(--deck-font-size-body, 1rem);
      }
      .image-placeholder-icon {
        width: 48px;
        height: 48px;
        margin-bottom: 0.5em;
        opacity: 0.5;
      }
      .image-placeholder-content {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
    `;

    const html = `
      <div class="image-placeholder">
        <div class="image-placeholder-content">
          <svg class="image-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>No image selected</span>
        </div>
      </div>
    `;

    return { html, styles };
  }

  // Determine sizing mode
  const size = options.size || 'contain';

  const styles = `
    .image-container {
      position: relative;
      width: 100%;
    }
    .image-wrapper {
      position: relative;
      overflow: hidden;
      border-radius: var(--deck-radius-md, 8px);
      ${maxHeight ? `height: ${maxHeight}px;` : ''}
      ${size === 'contain' && maxHeight ? `
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--deck-color-background);
      ` : ''}
    }
    .image {
      display: block;
      ${size === 'contain' ? `
        ${maxHeight ? `
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
        ` : `
          width: 100%;
          height: auto;
        `}
      ` : size === 'cover' ? `
        width: 100%;
        height: 100%;
        object-fit: cover;
      ` : `
        width: 100%;
        height: 100%;
        object-fit: fill;
      `}
      ${blur > 0 ? `filter: blur(${blur}px);` : ''}
    }
    ${darken > 0 ? `
    .image-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, ${darken / 100});
      pointer-events: none;
      border-radius: var(--deck-radius-md, 8px);
    }
    ` : ''}
    .image-caption {
      margin-top: 0.75em;
      font-family: var(--deck-font-body, system-ui, sans-serif);
      font-size: var(--deck-font-size-small, 0.875rem);
      color: var(--deck-color-text-secondary, #64748b);
      text-align: center;
    }
  `;

  // Escape HTML in alt text
  const escapedAlt = alt.replace(/[&<>"']/g, (c) => {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return entities[c] || c;
  });

  const html = `
    <div class="image-container">
      <div class="image-wrapper">
        <img class="image" src="${url}" alt="${escapedAlt}" loading="lazy" />
        ${darken > 0 ? '<div class="image-overlay"></div>' : ''}
      </div>
      ${caption ? `<p class="image-caption">${caption.replace(/[&<>"']/g, (c) => {
        const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return entities[c] || c;
      })}</p>` : ''}
    </div>
  `;

  return { html, styles };
}
