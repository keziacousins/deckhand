/**
 * useProfile: Fetches and manages the current user's profile from /api/me.
 * Provides avatar URL and profile update methods.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../api/decks';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UseProfileResult {
  profile: UserProfile | null;
  isLoading: boolean;
  updateName: (name: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  deleteAvatar: () => Promise<void>;
}

/** Append cache-bust param to avatar URLs so browsers fetch the new image after re-upload */
function bustAvatarCache(profile: UserProfile): UserProfile {
  if (!profile.avatarUrl) return profile;
  const sep = profile.avatarUrl.includes('?') ? '&' : '?';
  return { ...profile, avatarUrl: `${profile.avatarUrl}${sep}v=${Date.now()}` };
}

export function useProfile(token: string | null): UseProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  // Fetch profile when token becomes available
  useEffect(() => {
    if (!token) {
      setProfile(null);
      fetchedRef.current = false;
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    setIsLoading(true);
    apiFetch('/api/me')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      })
      .then((data) => setProfile(bustAvatarCache(data)))
      .catch((err) => console.warn('[Profile] Fetch failed:', err))
      .finally(() => setIsLoading(false));
  }, [token]);

  const updateName = useCallback(async (name: string) => {
    const res = await apiFetch('/api/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to update name');
    const data = await res.json();
    setProfile(bustAvatarCache(data));
  }, []);

  const uploadAvatar = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiFetch('/api/me/avatar', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload avatar');
    const data = await res.json();
    setProfile(bustAvatarCache(data));
  }, []);

  const deleteAvatar = useCallback(async () => {
    const res = await apiFetch('/api/me/avatar', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete avatar');
    const data = await res.json();
    setProfile(data); // no avatar to bust
  }, []);

  return { profile, isLoading, updateName, uploadAvatar, deleteAvatar };
}
