import { useCallback, useRef, useState } from 'react';
import type { InspectorSectionProps } from '../types';
import { scrollHeaderToSticky } from '../types';
import type { Asset } from '@deckhand/schema';
import { useInspectorExpansion } from '../context/InspectorExpansionContext';
import './AssetsSection.css';

const HEADER_HEIGHT = 37;

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
  const { isExpanded, expand, toggle } = useInspectorExpansion();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [uploading, setUploading] = useState<UploadingAsset[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const uploadExpanded = isExpanded('assets-upload');
  const libraryExpanded = isExpanded('assets-library');

  const handleHeaderClick = useCallback((sectionId: string) => {
    expand(sectionId);
    const header = headerRefs.current.get(sectionId);
    if (header) setTimeout(() => scrollHeaderToSticky(header), 250);
  }, [expand]);

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

  const uploadStickyIndex = stickyIndex;
  const libraryStickyIndex = stickyIndex + 1;

  return (
    <>
      {/* Upload section */}
      <div
        ref={(el) => { if (el) headerRefs.current.set('assets-upload', el); else headerRefs.current.delete('assets-upload'); }}
        className="section-header"
        data-expanded={uploadExpanded}
        style={{ '--sticky-top': `${uploadStickyIndex * HEADER_HEIGHT}px`, '--sticky-index': uploadStickyIndex } as React.CSSProperties}
        onClick={() => handleHeaderClick('assets-upload')}
      >
        <button className="section-header-expand" onClick={(e) => { e.stopPropagation(); toggle('assets-upload'); }} title={uploadExpanded ? 'Collapse' : 'Expand'}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={uploadExpanded ? 'section-header-chevron-expanded' : ''}>
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="section-header-title">
          <span className="section-header-name">Upload</span>
        </div>
      </div>
      <div className="section-body" data-expanded={uploadExpanded}>
        <div className="section-body-inner">
          <div className="section-body-overflow">
            <div className="section-body-content">
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
            </div>
          </div>
        </div>
      </div>

      {/* Library section */}
      {assetList.length > 0 && (
        <>
          <div
            ref={(el) => { if (el) headerRefs.current.set('assets-library', el); else headerRefs.current.delete('assets-library'); }}
            className="section-header"
            data-expanded={libraryExpanded}
            style={{ '--sticky-top': `${libraryStickyIndex * HEADER_HEIGHT}px`, '--sticky-index': libraryStickyIndex } as React.CSSProperties}
            onClick={() => handleHeaderClick('assets-library')}
          >
            <button className="section-header-expand" onClick={(e) => { e.stopPropagation(); toggle('assets-library'); }} title={libraryExpanded ? 'Collapse' : 'Expand'}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={libraryExpanded ? 'section-header-chevron-expanded' : ''}>
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="section-header-title">
              <span className="section-header-name">Library</span>
              <span className="section-header-meta">{assetList.length}</span>
            </div>
          </div>
          <div className="section-body" data-expanded={libraryExpanded}>
            <div className="section-body-inner">
              <div className="section-body-overflow">
                <div className="section-body-content">
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
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {assetList.length === 0 && uploading.length === 0 && (
        <div className="assets-empty">
          No assets yet. Upload images, audio, or video to use in your slides.
        </div>
      )}
    </>
  );
}
