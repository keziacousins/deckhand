/**
 * Collaboration constants for cursor tracking and presence.
 */

// Cursor broadcast settings
export const CURSOR_BROADCAST_INTERVAL_MS = 100;
export const CURSOR_BURST_INTERVAL_MS = 16; // ~60fps
export const CURSOR_BURST_COUNT = 6;
export const CURSOR_BURST_RESET_MS = 200;
export const CURSOR_FADE_TIMEOUT_MS = 20000;
export const CURSOR_REMOVE_TIMEOUT_MS = 30000;
export const CURSOR_LERP_FACTOR = 0.3;
export const CURSOR_LERP_THRESHOLD = 0.5;

// Viewport broadcast settings (for follow mode)
export const VIEWPORT_BROADCAST_INTERVAL_MS = 200;
export const VIEWPORT_BURST_INTERVAL_MS = 50;
export const VIEWPORT_BURST_COUNT = 6;
export const VIEWPORT_BURST_RESET_MS = 300;
/**
 * Predefined colors for users (assigned based on ID hash).
 * Chosen to be visually distinct and work on light backgrounds.
 */
const USER_COLORS = [
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#3F51B5', // Indigo
  '#2196F3', // Blue
  '#00BCD4', // Cyan
  '#009688', // Teal
  '#4CAF50', // Green
  '#FF9800', // Orange
  '#FF5722', // Deep Orange
  '#795548', // Brown
] as const;

/** Get a deterministic color for a user based on their ID. */
export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

/** Get two-letter initials from a display name. */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed.substring(0, 2).toUpperCase();
}
