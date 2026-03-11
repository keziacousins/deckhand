/**
 * KaTeX math extension for marked.
 *
 * Adds support for:
 * - `$$...$$` block math (rendered as display-mode equation)
 * - `$...$` inline math (rendered inline with text)
 *
 * Uses KaTeX for fast, synchronous rendering.
 */

import katex from 'katex';
import type { MarkedExtension, TokenizerAndRendererExtension } from 'marked';

const blockMath: TokenizerAndRendererExtension = {
  name: 'blockMath',
  level: 'block',
  start(src: string) {
    return src.indexOf('$$');
  },
  tokenizer(src: string) {
    const match = src.match(/^\$\$([\s\S]+?)\$\$/);
    if (match) {
      return {
        type: 'blockMath',
        raw: match[0],
        text: match[1].trim(),
      };
    }
  },
  renderer(token) {
    try {
      return `<div class="math math-block">${katex.renderToString(token.text, { displayMode: true, throwOnError: false })}</div>`;
    } catch {
      return `<div class="math math-block math-error">${token.text}</div>`;
    }
  },
};

const inlineMath: TokenizerAndRendererExtension = {
  name: 'inlineMath',
  level: 'inline',
  start(src: string) {
    return src.indexOf('$');
  },
  tokenizer(src: string) {
    // Match $...$ but not $$...$$ and not escaped \$
    const match = src.match(/^\$(?!\$)((?:[^$\\]|\\.)+?)\$/);
    if (match) {
      return {
        type: 'inlineMath',
        raw: match[0],
        text: match[1].trim(),
      };
    }
  },
  renderer(token) {
    try {
      return `<span class="math math-inline">${katex.renderToString(token.text, { displayMode: false, throwOnError: false })}</span>`;
    } catch {
      return `<span class="math math-inline math-error">${token.text}</span>`;
    }
  },
};

export const mathExtension: MarkedExtension = {
  extensions: [blockMath, inlineMath],
};
