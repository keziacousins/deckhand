/**
 * PresenceBar: Shows connection status and active collaborators.
 *
 * - Connected alone: connection indicator (green dot)
 * - Connected with others: local user + remote user avatars
 * - Disconnected: red "Offline" indicator
 */

import type { UserInfo, RemoteUser } from './types';
import { getInitials } from './constants';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface PresenceBarProps {
  connectionStatus: ConnectionStatus;
  localUser: UserInfo;
  remoteUsers: RemoteUser[];
  followingUserId?: string | null;
  onFollowUser?: (userId: string | null) => void;
}

function UserAvatar({
  user,
  size = 24,
  isFollowing = false,
  onClick,
}: {
  user: UserInfo;
  size?: number;
  isFollowing?: boolean;
  onClick?: () => void;
}) {
  const cursorStyle = onClick ? 'pointer' : 'default';
  const followingStyle = isFollowing ? {
    boxShadow: `0 0 0 3px ${user.color}`,
    transform: 'scale(1.1)',
  } : {};

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        title={user.name}
        onClick={onClick}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: `2px solid ${user.color}`,
          boxSizing: 'border-box',
          cursor: cursorStyle,
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          ...followingStyle,
        }}
      />
    );
  }

  return (
    <div
      title={user.name}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: user.color,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 600,
        border: '2px solid white',
        boxSizing: 'border-box',
        boxShadow: isFollowing ? `0 0 0 3px ${user.color}` : '0 1px 2px rgba(0,0,0,0.15)',
        cursor: cursorStyle,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        transform: isFollowing ? 'scale(1.1)' : 'scale(1)',
      }}
    >
      {getInitials(user.name)}
    </div>
  );
}

function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  if (status === 'disconnected' || status === 'error') {
    return (
      <div
        title="Offline"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          padding: '0 10px',
          backgroundColor: 'rgba(220, 38, 38, 0.15)',
          color: '#ef4444',
          borderRadius: 14,
          fontSize: 11,
          fontWeight: 500,
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }} />
        <span>Offline</span>
      </div>
    );
  }

  if (status === 'connecting') {
    return (
      <div
        title="Connecting..."
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          padding: '0 10px',
          backgroundColor: 'rgba(234, 179, 8, 0.15)',
          color: '#eab308',
          borderRadius: 14,
          fontSize: 11,
          fontWeight: 500,
        }}
      >
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: 'currentColor',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <span>Connecting</span>
      </div>
    );
  }

  // Connected and synced — green dot
  return (
    <div
      title="Connected"
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: '#22c55e',
      }}
    />
  );
}

export function PresenceBar({
  connectionStatus,
  localUser,
  remoteUsers,
  followingUserId,
  onFollowUser,
}: PresenceBarProps) {
  const connected = connectionStatus === 'connected';
  const hasRemoteUsers = remoteUsers.length > 0;

  const handleAvatarClick = (userId: string) => {
    if (!onFollowUser) return;
    onFollowUser(followingUserId === userId ? null : userId);
  };

  return (
    <div
      className="presence-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 36,
      }}
    >
      {connected && hasRemoteUsers && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <UserAvatar user={localUser} />
          {remoteUsers.slice(0, 4).map((remote, index) => (
            <div
              key={remote.clientId}
              style={{
                marginLeft: -6,
                zIndex: followingUserId === remote.user.id
                  ? remoteUsers.length + 1
                  : remoteUsers.length - index,
              }}
            >
              <UserAvatar
                user={remote.user}
                isFollowing={followingUserId === remote.user.id}
                onClick={() => handleAvatarClick(remote.user.id)}
              />
            </div>
          ))}
          {remoteUsers.length > 4 && (
            <div style={{
              marginLeft: -6,
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface, #2a2a3e)',
              color: 'var(--text-secondary, #888)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 600,
              border: '2px solid white',
              boxSizing: 'border-box',
            }}>
              +{remoteUsers.length - 4}
            </div>
          )}
        </div>
      )}

      {(!hasRemoteUsers || !connected) && (
        <ConnectionIndicator status={connectionStatus} />
      )}
    </div>
  );
}
