/**
 * ConnectionStatus: Shows connection status as a pill in the header.
 * 
 * Displays different states:
 * - Connected: Small green dot
 * - Syncing: Yellow pill with "Syncing..."
 * - Disconnected: Red pill with "Offline" or error message
 */

import './ConnectionStatus.css';

type Status = 'connecting' | 'connected' | 'disconnected' | 'error';

interface ConnectionStatusProps {
  status: Status;
  error?: string | null;
}

export function ConnectionStatus({ status, error }: ConnectionStatusProps) {
  // Connected and synced - just show a small green dot
  if (status === 'connected') {
    return (
      <div className="connection-status connection-status-connected" title="Connected">
        <span className="connection-dot connection-dot-success" />
      </div>
    );
  }

  // Connecting/syncing
  if (status === 'connecting') {
    return (
      <div className="connection-status connection-status-warning" title="Connecting...">
        <span className="connection-dot connection-dot-warning connection-dot-pulse" />
        <span className="connection-label">Connecting</span>
      </div>
    );
  }

  // Disconnected or error
  const message = error || 'Offline';
  const isError = status === 'error';
  
  return (
    <div 
      className={`connection-status ${isError ? 'connection-status-error' : 'connection-status-warning'}`}
      title={message}
    >
      <span className={`connection-dot ${isError ? 'connection-dot-error' : 'connection-dot-warning'} connection-dot-pulse`} />
      <span className="connection-label">{message.length > 20 ? 'Offline' : message}</span>
    </div>
  );
}
