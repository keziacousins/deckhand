/**
 * Hook for capturing deck cover images from the canvas.
 * Uses html-to-image to screenshot the cover slide and upload to server.
 */

import { useCallback, useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import { getCoverSlideId, type Deck } from '@deckhand/schema';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

interface UseCoverCaptureOptions {
  deck: Deck | null;
  deckId: string | null;
}

interface UseCoverCaptureReturn {
  captureCover: () => Promise<void>;
  isCapturing: boolean;
}

/**
 * Hook to capture and upload deck cover images.
 * Call captureCover() on deck load and when navigating away.
 */
export function useCoverCapture({ deck, deckId }: UseCoverCaptureOptions): UseCoverCaptureReturn {
  const isCapturingRef = useRef(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const captureCover = useCallback(async () => {
    if (!deck || !deckId || isCapturingRef.current) return;

    const coverSlideId = getCoverSlideId(deck);
    if (!coverSlideId) return;

    // Find the slide element in the DOM
    // React Flow renders slide nodes with data-id attribute, content is in .slide-node-detail
    const slideElement = document.querySelector(
      `[data-id="${coverSlideId}"] .slide-node-detail`
    ) as HTMLElement | null;

    if (!slideElement) {
      console.log('[CoverCapture] Cover slide element not found:', coverSlideId);
      return;
    }

    isCapturingRef.current = true;
    setIsCapturing(true);

    try {
      console.log('[CoverCapture] Capturing cover for deck:', deckId);

      // Wait for fonts to be ready
      await document.fonts.ready;

      // Small delay to ensure rendering is complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Capture using html-to-image (better Shadow DOM support)
      const dataUrl = await toJpeg(slideElement, {
        quality: 0.9,
        pixelRatio: 2, // Higher resolution for quality thumbnails
        backgroundColor: '#000000',
        includeQueryParams: true,
      });

      // Convert data URL to blob
      const blobResponse = await fetch(dataUrl);
      const blob = await blobResponse.blob();

      // Upload to server
      const formData = new FormData();
      formData.append('file', blob, 'cover.jpg');

      const uploadResponse = await fetch(`${API_BASE}/api/decks/${deckId}/cover`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const result = await uploadResponse.json();
      console.log('[CoverCapture] Cover uploaded:', result.coverUrl);
    } catch (error) {
      console.error('[CoverCapture] Error capturing cover:', error);
    } finally {
      isCapturingRef.current = false;
      setIsCapturing(false);
    }
  }, [deck, deckId]);

  return {
    captureCover,
    isCapturing,
  };
}
