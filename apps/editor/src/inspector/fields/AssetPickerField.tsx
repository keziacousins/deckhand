import { useState, useCallback } from 'react';
import type { Asset } from '@deckhand/schema';
import { AssetPickerModal } from './AssetPickerModal';
import { AuthImage } from '../../components/AuthImage';
import './AssetPickerField.css';

interface AssetPickerFieldProps {
  label: string;
  value: string; // Asset ID or empty string
  assets: Record<string, Asset>;
  onChange: (value: string) => void;
}

export function AssetPickerField({ label, value, assets, onChange }: AssetPickerFieldProps) {
  const [showModal, setShowModal] = useState(false);

  // Find the asset by ID
  const selectedAsset = value ? assets[value] : undefined;

  const handleSelect = useCallback((asset: Asset) => {
    onChange(asset.id);
    setShowModal(false);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  const handleOpenModal = useCallback(() => {
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
  }, []);

  // Filter to only image assets
  const imageAssets = Object.values(assets).filter((a) => 
    a.mimeType?.startsWith('image/')
  );

  return (
    <div className="inspector-field asset-picker-field">
      <label className="inspector-field-label">{label}</label>
      <div className="asset-picker-preview">
        {selectedAsset ? (
          <>
            <div className="asset-picker-thumbnail">
              <AuthImage src={selectedAsset.url} alt={selectedAsset.filename} />
            </div>
            <div className="asset-picker-info">
              <span className="asset-picker-filename">{selectedAsset.filename}</span>
              <div className="asset-picker-actions">
                <button 
                  className="asset-picker-btn"
                  onClick={handleOpenModal}
                  type="button"
                >
                  Change
                </button>
                <button 
                  className="asset-picker-btn asset-picker-btn-clear"
                  onClick={handleClear}
                  type="button"
                >
                  Clear
                </button>
              </div>
            </div>
          </>
        ) : (
          <button 
            className="asset-picker-select-btn"
            onClick={handleOpenModal}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
              <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Select image</span>
          </button>
        )}
      </div>

      {showModal && (
        <AssetPickerModal
          assets={imageAssets}
          selectedAssetId={value}
          onSelect={handleSelect}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
