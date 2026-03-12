/**
 * RemoteCursors: Container that renders all remote users' cursors.
 *
 * Must be rendered as a child of <ReactFlow> so it can use useViewport()
 * to transform flow coordinates to screen coordinates.
 */

import { useViewport } from '@xyflow/react';
import { RemoteCursor } from './RemoteCursor';
import type { RemoteUser } from './types';

export interface RemoteCursorsProps {
  remoteUsers: RemoteUser[];
}

export function RemoteCursors({ remoteUsers }: RemoteCursorsProps) {
  const viewport = useViewport();

  const usersWithCursors = remoteUsers.filter(u => u.cursor !== null);
  if (usersWithCursors.length === 0) return null;

  return (
    <div
      className="remote-cursors-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 9999,
      }}
    >
      {usersWithCursors.map(user => {
        const screenX = user.cursor!.x * viewport.zoom + viewport.x;
        const screenY = user.cursor!.y * viewport.zoom + viewport.y;

        return (
          <RemoteCursor
            key={user.clientId}
            position={{ x: screenX, y: screenY }}
            user={user.user}
            lastUpdate={user.lastUpdate}
          />
        );
      })}
    </div>
  );
}
