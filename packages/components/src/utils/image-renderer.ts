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
 * Map borderRadius prop to CSS value.
 */
export function borderRadiusToCss(radius: string | undefined): string {
  switch (radius) {
    case 'sm':
      return 'var(--deck-radius-sm, 4px)';
    case 'md':
      return 'var(--deck-radius-md, 8px)';
    case 'lg':
      return 'var(--deck-radius-lg, 16px)';
    case 'full':
      return '50%';
    case 'pill':
      return '9999px';
    case 'none':
    default:
      return '0';
  }
}

/**
 * Map shadow preset + optional color to CSS box-shadow value.
 * 
 * Uses a two-layer shadow for natural depth. The shadowColor is used
 * with varying alpha for each layer.
 */
export function shadowToCss(shadow: string | undefined, shadowColor?: string): string {
  const color = shadowColor || 'rgba(0,0,0,0.2)';

  // Parse color to RGB components — supports hex (#rgb, #rrggbb) and rgb()/rgba()
  let r = '0', g = '0', b = '0';
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      r = String(parseInt(hex[0] + hex[0], 16));
      g = String(parseInt(hex[1] + hex[1], 16));
      b = String(parseInt(hex[2] + hex[2], 16));
    } else {
      r = String(parseInt(hex.slice(0, 2), 16));
      g = String(parseInt(hex.slice(2, 4), 16));
      b = String(parseInt(hex.slice(4, 6), 16));
    }
  } else if (rgbMatch) {
    r = rgbMatch[1];
    g = rgbMatch[2];
    b = rgbMatch[3];
  }

  switch (shadow) {
    case 'sm':
      return `0 2px 4px rgba(${r},${g},${b},0.2), 0 1px 3px rgba(${r},${g},${b},0.15)`;
    case 'md':
      return `0 6px 12px rgba(${r},${g},${b},0.2), 0 3px 6px rgba(${r},${g},${b},0.12)`;
    case 'lg':
      return `0 15px 35px rgba(${r},${g},${b},0.25), 0 6px 15px rgba(${r},${g},${b},0.15)`;
    case 'none':
    default:
      return 'none';
  }
}

/**
 * Generate HTML for a foreground image (like deck-image).
 */
export function generateImageElementHtml(options: ImageRenderOptions & {
  alt?: string;
  caption?: string;
  maxWidth?: number;
  maxHeight?: number;
  align?: 'left' | 'center' | 'right';
  color?: string; // SVG fill color (for currentColor SVGs)
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  borderWidth?: number;
  borderColor?: string;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  shadowColor?: string;
}): {
  html: string;
  styles: string;
} {
  const url = options.url || resolveAssetUrl(options.assetId, options.assetsJson);
  const alt = options.alt || '';
  const caption = options.caption;
  const darken = options.darken || 0;
  const blur = options.blur || 0;
  const maxWidth = options.maxWidth;
  const maxHeight = options.maxHeight;
  const align = options.align || 'left';
  const color = options.color;
  const borderRadius = borderRadiusToCss(options.borderRadius);
  const borderWidth = options.borderWidth || 0;
  const borderColor = options.borderColor || '#000';
  const boxShadow = shadowToCss(options.shadow, options.shadowColor);

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

  // Alignment styles for the wrapper
  const alignStyles = maxWidth ? (
    align === 'center' ? 'margin-left: auto; margin-right: auto;' :
    align === 'right' ? 'margin-left: auto; margin-right: 0;' :
    'margin-left: 0; margin-right: auto;'
  ) : '';

  // Color styles for SVG support (currentColor)
  const colorStyles = color ? `color: ${color}; --icon-color: ${color};` : '';

  const styles = `
    .image-container {
      position: relative;
      width: 100%;
      ${colorStyles}
    }
    .image-wrapper {
      position: relative;
      overflow: hidden;
      border-radius: ${borderRadius};
      ${borderWidth > 0 ? `border: ${borderWidth}px solid ${borderColor};` : ''}
      ${boxShadow !== 'none' ? `box-shadow: ${boxShadow};` : ''}
      ${maxWidth ? `max-width: ${maxWidth}px;` : ''}
      ${maxHeight ? `height: ${maxHeight}px;` : ''}
      ${alignStyles}
      ${size === 'contain' && maxHeight ? `
        display: flex;
        align-items: center;
        justify-content: center;
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
      border-radius: ${borderRadius};
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
