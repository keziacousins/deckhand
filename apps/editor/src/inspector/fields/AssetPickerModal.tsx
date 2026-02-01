import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Asset } from '@deckhand/schema';
import './AssetPickerModal.css';

interface AssetPickerModalProps {
  assets: Asset[];
  selectedAssetId: string;
  onSelect: (asset: Asset) => void;
  onClose: () => void;
}

export function AssetPickerModal({ assets, selectedAssetId, onSelect, onClose }: AssetPickerModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  return createPortal(
    <div className="asset-picker-modal-backdrop" onClick={handleBackdropClick}>
      <div className="asset-picker-modal">
        <div className="asset-picker-modal-header">
          <span>Select Image</span>
          <button className="asset-picker-modal-close" onClick={onClose} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="asset-picker-modal-content">
          {assets.length === 0 ? (
            <div className="asset-picker-modal-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p>No images uploaded yet.</p>
              <p className="asset-picker-modal-hint">
                Upload images in the Assets tab to use them as backgrounds.
              </p>
            </div>
          ) : (
            <div className="asset-picker-modal-grid">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  className={`asset-picker-modal-item ${asset.id === selectedAssetId ? 'asset-picker-modal-item-selected' : ''}`}
                  onClick={() => onSelect(asset)}
                  title={asset.filename}
                  type="button"
                >
                  <img src={asset.url} alt={asset.filename} />
                  <div className="asset-picker-modal-item-name">{asset.filename}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
