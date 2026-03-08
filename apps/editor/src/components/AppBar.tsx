import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
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
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  if (!user) return null;

  return (
    <div className="app-bar">
      <a href="/#/" className="app-bar-logo">Deckhand</a>
      <div className="app-bar-user" ref={menuRef}>
        <button
          className="app-bar-avatar"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="User menu"
        >
          {getInitials(user.name, user.email)}
        </button>
        {menuOpen && (
          <div className="app-bar-menu">
            <div className="app-bar-menu-user">
              {user.name && <div className="app-bar-menu-name">{user.name}</div>}
              {user.email && <div className="app-bar-menu-email">{user.email}</div>}
            </div>
            <button className="app-bar-menu-item" onClick={logout}>
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
