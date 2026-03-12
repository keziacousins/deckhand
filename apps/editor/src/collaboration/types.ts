/** Cursor position in ReactFlow coordinates */
export interface CursorPosition {
  x: number;
  y: number;
}

/** Viewport state for follow mode */
export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

/** User info for presence display */
export interface UserInfo {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
}

/** Full awareness state for a user */
export interface UserAwarenessState {
  user: UserInfo;
  cursor: CursorPosition | null;
  viewport: ViewportState | null;
  lastUpdate: number;
}

/** Remote user with their awareness state */
export interface RemoteUser {
  clientId: number;
  user: UserInfo;
  cursor: CursorPosition | null;
  viewport: ViewportState | null;
  lastUpdate: number;
  /** Who this user is following (null if not following anyone) */
  followingUserId: string | null;
}
