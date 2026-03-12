/**
 * usePresence: Hook for cursor, viewport, and presence tracking via YJS awareness.
 *
 * Handles:
 * - Broadcasting local cursor position (throttled with burst mode)
 * - Broadcasting local viewport (throttled with burst mode)
 * - Subscribing to remote users' cursor/viewport positions
 * - User identity (id, name, color)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import {
  CURSOR_BROADCAST_INTERVAL_MS,
  CURSOR_BURST_INTERVAL_MS,
  CURSOR_BURST_COUNT,
  CURSOR_BURST_RESET_MS,
  CURSOR_FADE_TIMEOUT_MS,
  VIEWPORT_BROADCAST_INTERVAL_MS,
  VIEWPORT_BURST_INTERVAL_MS,
  VIEWPORT_BURST_COUNT,
  VIEWPORT_BURST_RESET_MS,
  getUserColor,
} from './constants';
import type { CursorPosition, ViewportState, UserInfo, RemoteUser } from './types';

export interface UsePresenceOptions {
  awareness: Awareness | null;
  localUser: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  /** Who the local user is following — broadcast so others can detect cycles */
  followingUserId?: string | null;
  enabled?: boolean;
}

export interface UsePresenceResult {
  updateCursor: (position: CursorPosition | null) => void;
  updateViewport: (viewport: ViewportState) => void;
  remoteUsers: RemoteUser[];
  localUserInfo: UserInfo;
}

export function usePresence({
  awareness,
  localUser,
  followingUserId: localFollowingUserId = null,
  enabled = true,
}: UsePresenceOptions): UsePresenceResult {
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);

  // Throttle refs for cursor
  const lastCursorBroadcastRef = useRef(0);
  const pendingCursorRef = useRef<CursorPosition | null>(null);
  const cursorTimeoutRef = useRef<number | null>(null);
  const cursorBurstCountRef = useRef(0);

  // Throttle refs for viewport
  const lastViewportBroadcastRef = useRef(0);
  const pendingViewportRef = useRef<ViewportState | null>(null);
  const viewportTimeoutRef = useRef<number | null>(null);
  const viewportBurstCountRef = useRef(0);

  const localUserInfo: UserInfo = {
    id: localUser.id,
    name: localUser.name,
    color: getUserColor(localUser.id),
    avatarUrl: localUser.avatarUrl,
  };

  // Stable ref so callbacks don't need awareness in deps
  const awarenessRef = useRef(awareness);
  awarenessRef.current = awareness;

  const localUserInfoRef = useRef(localUserInfo);
  localUserInfoRef.current = localUserInfo;

  // Helper to merge updates into local awareness state
  const updateLocalState = useCallback((updates: Record<string, unknown>) => {
    const a = awarenessRef.current;
    if (!a) return;
    const current = a.getLocalState() || {};
    a.setLocalState({ ...current, ...updates, lastUpdate: Date.now() });
  }, []);

  // Initialize local awareness state
  useEffect(() => {
    if (!awareness || !enabled) return;

    awareness.setLocalState({
      user: localUserInfoRef.current,
      cursor: null,
      viewport: null,
      followingUserId: localFollowingUserId,
      lastUpdate: Date.now(),
    });

    return () => {
      awareness.setLocalState(null);
    };
  }, [awareness, enabled]);

  // Broadcast followingUserId changes
  useEffect(() => {
    if (!awareness || !enabled) return;
    updateLocalState({ followingUserId: localFollowingUserId });
  }, [awareness, enabled, localFollowingUserId, updateLocalState]);

  // Re-announce periodically (handles server restarts / stale state)
  useEffect(() => {
    if (!awareness || !enabled) return;
    const interval = setInterval(() => {
      const a = awarenessRef.current;
      if (!a) return;
      const current = a.getLocalState();
      if (current) {
        a.setLocalState({ ...current, user: localUserInfoRef.current, lastUpdate: Date.now() });
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [awareness, enabled]);

  // Subscribe to remote awareness changes
  useEffect(() => {
    if (!awareness || !enabled) return;

    const handleChange = () => {
      const a = awarenessRef.current;
      if (!a) return;
      const states = a.getStates();
      const localClientId = a.clientID;
      const now = Date.now();

      const users: RemoteUser[] = [];
      states.forEach((state, clientId) => {
        if (clientId === localClientId) return;
        if (!state.user) return;

        const lastUpdate = state.lastUpdate ?? 0;
        const isIdle = now - lastUpdate > CURSOR_FADE_TIMEOUT_MS;

        users.push({
          clientId,
          user: {
            id: state.user.id ?? `user-${clientId}`,
            name: state.user.name ?? 'Anonymous',
            color: state.user.color ?? getUserColor(`user-${clientId}`),
            avatarUrl: state.user.avatarUrl,
          },
          cursor: isIdle ? null : (state.cursor ?? null),
          viewport: state.viewport ?? null,
          lastUpdate,
          followingUserId: state.followingUserId ?? null,
        });
      });

      setRemoteUsers(users);
    };

    handleChange();
    awareness.on('change', handleChange);

    // Periodic refresh for fade/cleanup
    const cleanupInterval = setInterval(handleChange, CURSOR_FADE_TIMEOUT_MS / 4);

    return () => {
      awareness.off('change', handleChange);
      clearInterval(cleanupInterval);
    };
  }, [awareness, enabled]);

  // Throttled cursor broadcast with burst mode
  const updateCursor = useCallback((position: CursorPosition | null) => {
    if (!awarenessRef.current || !enabled) return;

    const now = Date.now();
    pendingCursorRef.current = position;

    if (now - lastCursorBroadcastRef.current > CURSOR_BURST_RESET_MS) {
      cursorBurstCountRef.current = 0;
    }

    const inBurst = cursorBurstCountRef.current < CURSOR_BURST_COUNT;
    const interval = inBurst ? CURSOR_BURST_INTERVAL_MS : CURSOR_BROADCAST_INTERVAL_MS;

    if (now - lastCursorBroadcastRef.current >= interval) {
      updateLocalState({ cursor: position });
      lastCursorBroadcastRef.current = now;
      cursorBurstCountRef.current++;
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
        cursorTimeoutRef.current = null;
      }
    } else if (!cursorTimeoutRef.current) {
      const remaining = interval - (now - lastCursorBroadcastRef.current);
      cursorTimeoutRef.current = window.setTimeout(() => {
        updateLocalState({ cursor: pendingCursorRef.current });
        lastCursorBroadcastRef.current = Date.now();
        cursorBurstCountRef.current++;
        cursorTimeoutRef.current = null;
      }, remaining);
    }
  }, [enabled, updateLocalState]);

  // Throttled viewport broadcast with burst mode
  const updateViewport = useCallback((viewport: ViewportState) => {
    if (!awarenessRef.current || !enabled) return;

    const now = Date.now();
    pendingViewportRef.current = viewport;

    if (now - lastViewportBroadcastRef.current > VIEWPORT_BURST_RESET_MS) {
      viewportBurstCountRef.current = 0;
    }

    const inBurst = viewportBurstCountRef.current < VIEWPORT_BURST_COUNT;
    const interval = inBurst ? VIEWPORT_BURST_INTERVAL_MS : VIEWPORT_BROADCAST_INTERVAL_MS;

    if (now - lastViewportBroadcastRef.current >= interval) {
      updateLocalState({ viewport });
      lastViewportBroadcastRef.current = now;
      viewportBurstCountRef.current++;
      if (viewportTimeoutRef.current) {
        clearTimeout(viewportTimeoutRef.current);
        viewportTimeoutRef.current = null;
      }
    } else if (!viewportTimeoutRef.current) {
      const remaining = interval - (now - lastViewportBroadcastRef.current);
      viewportTimeoutRef.current = window.setTimeout(() => {
        updateLocalState({ viewport: pendingViewportRef.current });
        lastViewportBroadcastRef.current = Date.now();
        viewportBurstCountRef.current++;
        viewportTimeoutRef.current = null;
      }, remaining);
    }
  }, [enabled, updateLocalState]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
      if (viewportTimeoutRef.current) clearTimeout(viewportTimeoutRef.current);
    };
  }, []);

  return {
    updateCursor,
    updateViewport,
    remoteUsers,
    localUserInfo,
  };
}
