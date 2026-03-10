import { useState, useEffect, useCallback } from 'react';
import {
  getDeck,
  listShares,
  addShare,
  updateShare,
  removeShare,
  setPublicAccess,
  type DeckShare,
  type PublicAccess,
} from '../api/decks';
import './ShareDialog.css';

interface ShareDialogProps {
  deckId: string;
  onClose: () => void;
}

export function ShareDialog({ deckId, onClose }: ShareDialogProps) {
  const [shares, setShares] = useState<DeckShare[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [publicAccess, setPublicAccessState] = useState<PublicAccess>('none');
  const [copied, setCopied] = useState(false);

  const fetchShares = useCallback(async () => {
    try {
      const data = await listShares(deckId);
      setShares(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shares');
    }
  }, [deckId]);

  // Fetch current public access state
  useEffect(() => {
    getDeck(deckId)
      .then((deck) => setPublicAccessState((deck.publicAccess as PublicAccess) || 'none'))
      .catch(() => { /* defaults to 'none' */ });
  }, [deckId]);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const handleTogglePublic = async () => {
    const newAccess: PublicAccess = publicAccess === 'none' ? 'present' : 'none';
    try {
      const result = await setPublicAccess(deckId, newAccess);
      setPublicAccessState(result.publicAccess);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update public access');
    }
  };

  const publicUrl = `${window.location.origin}/present/${deckId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError(null);
    setLoading(true);
    try {
      const share = await addShare(deckId, email.trim(), role);
      setShares((prev) => [...prev, share]);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add share');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (shareId: string, newRole: 'editor' | 'viewer') => {
    try {
      await updateShare(deckId, shareId, newRole);
      setShares((prev) =>
        prev.map((s) => (s.id === shareId ? { ...s, role: newRole } : s))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleRemove = async (shareId: string) => {
    try {
      await removeShare(deckId, shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove share');
    }
  };

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="share-dialog-header">
          <h2>Share Deck</h2>
          <button className="share-dialog-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="share-dialog-body">
          {/* Public link section */}
          <div className="share-public-section">
            <div className="share-public-toggle">
              <label className="share-public-label">
                <span>Anyone with the link can view</span>
                <button
                  className={`share-toggle-btn ${publicAccess !== 'none' ? 'share-toggle-on' : ''}`}
                  onClick={handleTogglePublic}
                  type="button"
                >
                  <span className="share-toggle-knob" />
                </button>
              </label>
            </div>
            {publicAccess !== 'none' && (
              <div className="share-public-link">
                <input
                  className="share-public-url"
                  type="text"
                  value={publicUrl}
                  readOnly
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button className="share-copy-btn" onClick={handleCopyLink} type="button">
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>

          <form className="share-add-form" onSubmit={handleAdd}>
            <input
              className="share-email-input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              className="share-role-select"
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="share-add-btn" type="submit" disabled={loading || !email.trim()}>
              Share
            </button>
          </form>

          {error && <div className="share-error">{error}</div>}

          <div className="share-list">
            {shares.length === 0 ? (
              <div className="share-list-empty">No one else has access</div>
            ) : (
              shares.map((share) => (
                <div key={share.id} className="share-item">
                  <div className="share-item-info">
                    <div className="share-item-name">{share.name || share.email || share.userId}</div>
                    {share.name && share.email && (
                      <div className="share-item-email">{share.email}</div>
                    )}
                  </div>
                  <select
                    className="share-item-role"
                    value={share.role}
                    onChange={(e) => handleRoleChange(share.id, e.target.value as 'editor' | 'viewer')}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    className="share-item-remove"
                    onClick={() => handleRemove(share.id)}
                    title="Remove access"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
