import { useCallback, useRef, useState } from 'react';
import type { InspectorSectionProps } from '../types';
import type { Asset } from '@deckhand/schema';
import { Section } from '../components/Section';
import './AssetsSection.css';

// Counter for unique upload IDs when multiple files are uploaded simultaneously
let uploadCounter = 0;

interface UploadingAsset {
  id: string;
  filename: string;
  progress: number;
}

export function AssetsSection({ context, stickyIndex = 0 }: InspectorSectionProps) {
  const { deck, onUpdate } = context;
  const deckId = deck.meta.id;
  const assets = deck.assets ?? {};
  const assetList = Object.values(assets);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<UploadingAsset[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const uploadFile = useCallback(async (file: File) => {
    const tempId = `uploading-${Date.now()}-${uploadCounter++}`;
    
    setUploading((prev) => [...prev, { id: tempId, filename: file.name, progress: 0 }]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/decks/${deckId}/assets`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const asset = await response.json();

      // Add asset to deck
      onUpdate({
        type: 'addAsset',
        asset: {
          id: asset.id,
          filename: asset.filename,
          mimeType: asset.mimeType,
          size: asset.size,
          url: asset.url,
          uploaded: new Date().toISOString(),
        } as Asset,
      });

    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading((prev) => prev.filter((u) => u.id !== tempId));
    }
  }, [deckId, onUpdate]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(uploadFile);
  }, [uploadFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = ''; // Reset so same file can be selected again
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDelete = useCallback(async (assetId: string) => {
    const assetToDelete = assets[assetId];
    if (!assetToDelete) return;

    try {
      const response = await fetch(`/api/decks/${deckId}/assets/${assetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }

      // Remove asset from deck
      const newAssets = { ...assets };
      delete newAssets[assetId];
      
      onUpdate({
        type: 'deck',
        field: 'assets',
        value: newAssets,
      });

      // Clean up any slide references to this asset's URL
      const assetUrl = assetToDelete.url;
      for (const slide of Object.values(deck.slides)) {
        if (slide.style?.backgroundImage === assetUrl) {
          onUpdate({
            type: 'slide',
            slideId: slide.id,
            field: 'style',
            value: { 
              backgroundImage: undefined,
              backgroundSize: undefined,
              backgroundDarken: undefined,
              backgroundBlur: undefined,
            },
          });
        }
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  }, [deckId, assets, deck.slides, onUpdate]);

  return (
    <>
      <Section id="assets-upload" name="Upload" stickyIndex={stickyIndex}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*,video/*"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <div
          className={`assets-upload-zone ${dragOver ? 'assets-upload-zone-active' : ''}`}
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="assets-upload-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 4v12M12 4l-4 4M12 4l4 4M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="assets-upload-text">
            Drop files here or click to upload
          </div>
          <div className="assets-upload-hint">
            Images, audio, video (max 50MB)
          </div>
        </div>

        {/* Uploading progress */}
        {uploading.length > 0 && (
          <div className="assets-uploading">
            {uploading.map((u) => (
              <div key={u.id} className="assets-uploading-item">
                <span className="assets-uploading-name">{u.filename}</span>
                <span className="assets-uploading-status">Uploading...</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {assetList.length > 0 && (
        <Section id="assets-library" name="Library" stickyIndex={stickyIndex + 1} meta={`${assetList.length}`}>
          <div className="assets-grid">
            {assetList.map((asset) => (
              <div key={asset.id} className="asset-item" title={asset.filename}>
                <div className="asset-thumbnail">
                  {asset.mimeType?.startsWith('image/') ? (
                    <img src={asset.url} alt={asset.filename} />
                  ) : (
                    <div className="asset-icon">
                      {asset.mimeType?.startsWith('audio/') ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : asset.mimeType?.startsWith('video/') ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="asset-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(asset.id);
                  }}
                  title="Delete asset"
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <div className="asset-name">{asset.filename}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {assetList.length === 0 && uploading.length === 0 && (
        <div className="assets-empty">
          No assets yet. Upload images, audio, or video to use in your slides.
        </div>
      )}
    </>
  );
}
