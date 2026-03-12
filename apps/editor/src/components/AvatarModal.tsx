import { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import './AvatarModal.css';

interface AvatarModalProps {
  currentAvatarUrl: string | null;
  userName: string | null;
  userEmail: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return parts[0][0];
  }
  if (email) return email[0];
  return '?';
}

export function AvatarModal({
  currentAvatarUrl,
  userName,
  userEmail,
  onUpload,
  onDelete,
  onClose,
}: AvatarModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clean up object URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setError(null);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));

    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [previewUrl]);

  const handleUpload = useCallback(async () => {
    if (!pendingFile) return;
    setSaving(true);
    setError(null);
    try {
      await onUpload(pendingFile);
      onClose();
    } catch {
      setError('Failed to upload avatar');
    } finally {
      setSaving(false);
    }
  }, [pendingFile, onUpload, onClose]);

  const handleRemove = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await onDelete();
      onClose();
    } catch {
      setError('Failed to remove avatar');
    } finally {
      setSaving(false);
    }
  }, [onDelete, onClose]);

  const handleChoose = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // What to show in the preview circle
  const displayUrl = previewUrl || currentAvatarUrl;
  const hasNewFile = !!pendingFile;

  return (
    <Modal
      title="Profile photo"
      onClose={onClose}
      width="360px"
      footer={
        <div className="avatar-modal-footer">
          {currentAvatarUrl && !hasNewFile && (
            <button
              className="avatar-modal-btn avatar-modal-btn-danger"
              onClick={handleRemove}
              disabled={saving}
            >
              Remove
            </button>
          )}
          <div className="avatar-modal-footer-spacer" />
          <button
            className="avatar-modal-btn"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          {hasNewFile ? (
            <button
              className="avatar-modal-btn avatar-modal-btn-primary"
              onClick={handleUpload}
              disabled={saving}
            >
              {saving ? 'Uploading...' : 'Save'}
            </button>
          ) : (
            <button
              className="avatar-modal-btn avatar-modal-btn-primary"
              onClick={handleChoose}
            >
              Choose photo
            </button>
          )}
        </div>
      }
    >
      <div className="avatar-modal-body">
        <div className="avatar-modal-preview-container">
          {displayUrl ? (
            <img src={displayUrl} alt="" className="avatar-modal-preview-img" />
          ) : (
            <div className="avatar-modal-preview-initials">
              {getInitials(userName, userEmail)}
            </div>
          )}
        </div>

        {hasNewFile && (
          <button
            className="avatar-modal-choose-different"
            onClick={handleChoose}
            disabled={saving}
          >
            Choose a different photo
          </button>
        )}

        {error && <div className="avatar-modal-error">{error}</div>}

        <p className="avatar-modal-hint">
          Square images work best. Will be cropped to a circle and resized to 256px.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </Modal>
  );
}
