/**
 * Hook that handles server-initiated slide capture commands via WebSocket.
 * When the server (via LLM tool) requests a slide screenshot, this hook
 * captures it using html-to-image and responds with the base64 data URL.
 * No server upload — the image is passed directly to the LLM.
 */

import { useEffect } from 'react';
import { toJpeg } from 'html-to-image';
import type { ControlMessage } from '../sync/useYDoc';

interface UseCaptureHandlerOptions {
  deckId: string;
  onMessage: (type: string, handler: (msg: ControlMessage) => void) => () => void;
  sendMessage: (msg: ControlMessage) => void;
}

// Capture settings tuned for LLM consumption — enough to understand
// layout and read text, but small enough to keep token cost reasonable.
// At 1x pixelRatio a 1920x1080 slide produces ~100-200KB JPEG.
const CAPTURE_PIXEL_RATIO = 1;
const CAPTURE_QUALITY = 0.8;

export function useCaptureHandler({ deckId, onMessage, sendMessage }: UseCaptureHandlerOptions) {
  useEffect(() => {
    return onMessage('command:capture-slide', async (msg) => {
      const requestId = msg.requestId as string;
      const slideId = msg.slideId as string;

      try {
        const slideElement = document.querySelector(
          `[data-id="${slideId}"] .slide-node-detail`
        ) as HTMLElement | null;

        if (!slideElement) {
          sendMessage({ type: 'response:capture-slide', requestId, error: 'Slide not found in DOM' });
          return;
        }

        await document.fonts.ready;

        const dataUrl = await toJpeg(slideElement, {
          quality: CAPTURE_QUALITY,
          pixelRatio: CAPTURE_PIXEL_RATIO,
          backgroundColor: '#000000',
          includeQueryParams: true,
        });

        // Send base64 data URL directly — no upload needed
        sendMessage({ type: 'response:capture-slide', requestId, dataUrl });
      } catch (error) {
        sendMessage({
          type: 'response:capture-slide',
          requestId,
          error: error instanceof Error ? error.message : 'Capture failed',
        });
      }
    });
  }, [deckId, onMessage, sendMessage]);
}
