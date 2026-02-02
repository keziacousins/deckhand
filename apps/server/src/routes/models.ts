/**
 * Models API route - list available Claude models.
 */

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { config, isLLMEnabled } from '../config.js';

const router = Router();

// Default model to use
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

// Cache models list for 5 minutes
let cachedModels: Array<{ id: string; name: string }> | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * GET /api/models
 * 
 * List available Claude models from the API.
 */
router.get('/', async (_req, res) => {
  if (!isLLMEnabled()) {
    return res.status(503).json({ 
      error: 'LLM features not available. Set ANTHROPIC_API_KEY in server environment.' 
    });
  }

  // Return cached models if fresh
  if (cachedModels && Date.now() - cacheTime < CACHE_TTL_MS) {
    return res.json({ models: cachedModels, defaultModel: DEFAULT_MODEL });
  }

  try {
    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    const response = await anthropic.models.list();
    
    // Filter to chat models and format nicely
    const models = response.data
      .filter(m => m.id.includes('claude'))
      .map(m => ({
        id: m.id,
        name: formatModelName(m.id),
      }))
      .sort((a, b) => {
        // Sort by model family then version (newest first)
        const aFamily = getModelFamily(a.id);
        const bFamily = getModelFamily(b.id);
        if (aFamily !== bFamily) {
          return bFamily.localeCompare(aFamily);
        }
        return b.id.localeCompare(a.id);
      });

    cachedModels = models;
    cacheTime = Date.now();

    res.json({ models, defaultModel: DEFAULT_MODEL });
  } catch (error) {
    console.error('[Models] Error fetching models:', error);
    
    // Return fallback list if API fails
    const fallbackModels = [
      { id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku' },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet' },
      { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    ];
    
    res.json({ models: fallbackModels, defaultModel: DEFAULT_MODEL, fallback: true });
  }
});

/**
 * Format model ID into a readable name.
 */
function formatModelName(id: string): string {
  // claude-sonnet-4-20250514 -> Claude Sonnet 4
  // claude-3-5-sonnet-20241022 -> Claude 3.5 Sonnet
  // claude-3-haiku-20240307 -> Claude 3 Haiku
  
  const parts = id.split('-');
  
  // Find version number(s) and model type
  let version = '';
  let type = '';
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part === 'opus' || part === 'sonnet' || part === 'haiku') {
      type = part.charAt(0).toUpperCase() + part.slice(1);
    } else if (/^\d+$/.test(part) && part.length <= 2) {
      version += (version ? '.' : '') + part;
    }
  }
  
  return `Claude ${version} ${type}`.trim();
}

/**
 * Get model family for sorting (newer families first).
 */
function getModelFamily(id: string): string {
  if (id.includes('sonnet-4') || id.includes('opus-4') || id.includes('haiku-4')) {
    return '4';
  }
  if (id.includes('3-5')) {
    return '3.5';
  }
  if (id.includes('3-')) {
    return '3';
  }
  return '0';
}

export default router;
