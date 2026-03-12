/**
 * RemoteCursor: Renders a single remote user's cursor with smooth LERP interpolation.
 *
 * - Figma-style angled pointer (distinct from system cursor)
 * - User name badge at bottom-right of pointer
 * - Smooth lerp animation between received positions
 * - Fade out after inactivity
 */

import { useRef, useEffect, useState } from 'react';
import type { CursorPosition, UserInfo } from './types';
import { CURSOR_LERP_FACTOR, CURSOR_LERP_THRESHOLD, CURSOR_FADE_TIMEOUT_MS } from './constants';

export interface RemoteCursorProps {
  position: CursorPosition;
  user: UserInfo;
  lastUpdate: number;
}

const CURSOR_PATH = 'M0 0L0 20L5.5 15L9 24L12 23L8.5 14L16 14L0 0Z';

export function RemoteCursor({ position, user, lastUpdate }: RemoteCursorProps) {
  const [currentPos, setCurrentPos] = useState<CursorPosition>(position);
  const targetRef = useRef<CursorPosition>(position);
  const rafRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    targetRef.current = position;

    if (!isAnimatingRef.current) {
      isAnimatingRef.current = true;
      const animate = () => {
        const target = targetRef.current;
        setCurrentPos(current => {
          const dx = target.x - current.x;
          const dy = target.y - current.y;
          if (Math.sqrt(dx * dx + dy * dy) < CURSOR_LERP_THRESHOLD) {
            isAnimatingRef.current = false;
            return target;
          }
          return {
            x: current.x + dx * CURSOR_LERP_FACTOR,
            y: current.y + dy * CURSOR_LERP_FACTOR,
          };
        });
        if (isAnimatingRef.current) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [position.x, position.y]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Opacity fade based on age
  const timeSinceUpdate = Date.now() - lastUpdate;
  const fadeStart = CURSOR_FADE_TIMEOUT_MS * 0.8;
  let opacity = 1;
  if (timeSinceUpdate > fadeStart) {
    opacity = Math.max(0, 1 - (timeSinceUpdate - fadeStart) / (CURSOR_FADE_TIMEOUT_MS - fadeStart));
  }

  return (
    <div
      className="remote-cursor"
      style={{
        position: 'absolute',
        left: currentPos.x,
        top: currentPos.y,
        pointerEvents: 'none',
        zIndex: 9999,
        opacity,
        transition: 'opacity 0.3s ease-out',
      }}
    >
      <svg width="24" height="32" viewBox="0 0 24 32" fill="none"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
        <path d={CURSOR_PATH} fill={user.color} stroke="white" strokeWidth="1.5" />
      </svg>

      <div style={{
        position: 'absolute',
        left: 16,
        top: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        backgroundColor: user.color,
        color: 'white',
        padding: '2px 8px 2px 6px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}>
        <span>{user.name}</span>
      </div>
    </div>
  );
}
