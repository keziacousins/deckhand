import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useProfile } from '../hooks/useProfile';
import { AvatarModal } from './AvatarModal';
import './AppBar.css';

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return parts[0][0];
  }
  if (email) return email[0];
  return '?';
}

export function AppBar() {
  const { user, token, logout } = useAuth();
  const { profile, uploadAvatar, deleteAvatar } = useProfile(token);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<'name' | 'password' | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setSettingsPanel(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  if (!user) return null;

  const avatarUrl = profile?.avatarUrl;

  return (
    <div className="app-bar">
      <a href="/#/" className="app-bar-logo">Deckhand</a>
      <div className="app-bar-user" ref={menuRef}>
        <button
          className="app-bar-avatar"
          onClick={() => { setMenuOpen(!menuOpen); setSettingsPanel(null); }}
          aria-label="User menu"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="app-bar-avatar-img" />
          ) : (
            getInitials(user.name, user.email)
          )}
        </button>
        {menuOpen && (
          <div className="app-bar-menu">
            <div className="app-bar-menu-user">
              <div className="app-bar-menu-name">{user.name || 'No name set'}</div>
              <div className="app-bar-menu-email">{user.email || user.sub}</div>
            </div>
            {settingsPanel === 'name' ? (
              <NameForm
                currentName={user.name}
                onClose={() => setSettingsPanel(null)}
              />
            ) : settingsPanel === 'password' ? (
              <PasswordForm onClose={() => setSettingsPanel(null)} />
            ) : (
              <div className="app-bar-menu-items">
                <button className="app-bar-menu-item" onClick={() => {
                  setMenuOpen(false);
                  setShowAvatarModal(true);
                }}>
                  Change avatar
                </button>
                <button className="app-bar-menu-item" onClick={() => setSettingsPanel('name')}>
                  Change name
                </button>
                <button className="app-bar-menu-item" onClick={() => setSettingsPanel('password')}>
                  Change password
                </button>
                <div className="app-bar-menu-separator" />
                <button className="app-bar-menu-item" onClick={logout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showAvatarModal && (
        <AvatarModal
          currentAvatarUrl={avatarUrl ?? null}
          userName={user.name}
          userEmail={user.email}
          onUpload={uploadAvatar}
          onDelete={deleteAvatar}
          onClose={() => setShowAvatarModal(false)}
        />
      )}
    </div>
  );
}

function NameForm({ currentName, onClose }: { currentName: string | null; onClose: () => void }) {
  const { refreshSession } = useAuth();
  const [name, setName] = useState(currentName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/settings/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update name');
        return;
      }
      await refreshSession();
      onClose();
    } catch {
      setError('Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="app-bar-settings-form" onSubmit={handleSubmit}>
      <label className="app-bar-settings-label">Display name</label>
      <input
        className="app-bar-settings-input"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      {error && <div className="app-bar-settings-error">{error}</div>}
      <div className="app-bar-settings-actions">
        <button type="button" className="app-bar-settings-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="app-bar-settings-btn app-bar-settings-btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function PasswordForm({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to change password');
        return;
      }
      onClose();
    } catch {
      setError('Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="app-bar-settings-form" onSubmit={handleSubmit}>
      <label className="app-bar-settings-label">New password</label>
      <input
        className="app-bar-settings-input"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
      />
      <label className="app-bar-settings-label">Confirm password</label>
      <input
        className="app-bar-settings-input"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {error && <div className="app-bar-settings-error">{error}</div>}
      <div className="app-bar-settings-actions">
        <button type="button" className="app-bar-settings-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="app-bar-settings-btn app-bar-settings-btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Change'}
        </button>
      </div>
    </form>
  );
}
