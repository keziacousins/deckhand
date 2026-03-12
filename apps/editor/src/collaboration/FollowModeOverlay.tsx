/**
 * FollowModeOverlay: Bottom notification when following another user's viewport.
 * Shows the followed user's name with a Stop button.
 */

import type { UserInfo } from './types';
import { getInitials } from './constants';

export interface FollowModeOverlayProps {
  user: UserInfo;
  onStop: () => void;
}

export function FollowModeOverlay({ user, onStop }: FollowModeOverlayProps) {
  return (
    <div
      className="follow-mode-overlay"
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px 8px 8px',
        backgroundColor: 'var(--bg-panel, #1e1e2e)',
        border: `2px solid ${user.color}`,
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        zIndex: 10000,
        pointerEvents: 'auto',
      }}
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.name}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: `2px solid ${user.color}`,
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <div style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          backgroundColor: user.color,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600,
        }}>
          {getInitials(user.name)}
        </div>
      )}

      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary, #fff)' }}>
        Following {user.name}
      </span>

      <button
        onClick={onStop}
        style={{
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 500,
          backgroundColor: 'var(--bg-surface, #2a2a3e)',
          border: '1px solid var(--border-subtle, #444)',
          borderRadius: 6,
          color: 'var(--text-secondary, #888)',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = 'var(--bg-surface-hover, #333)';
          (e.target as HTMLButtonElement).style.color = 'var(--text-primary, #fff)';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = 'var(--bg-surface, #2a2a3e)';
          (e.target as HTMLButtonElement).style.color = 'var(--text-secondary, #888)';
        }}
      >
        Stop
      </button>
    </div>
  );
}
