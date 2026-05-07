/**
 * Asset upload and serving routes.
 * Assets are stored in S3-compatible storage (SeaweedFS in dev).
 */

import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

// Limit libvips thread pool — prevents resource exhaustion on concurrent uploads
sharp.concurrency(1);

import { pool, type AssetRow } from '../db/schema.js';

// ─── Background thumbnail processing queue ──────────────────────────────

interface ThumbnailJob {
  deckId: string;
  assetId: string;
  buffer: Buffer;
  mimeType: string;
}

const thumbnailQueue: ThumbnailJob[] = [];
let processingThumbnails = false;

async function enqueueThumbnail(job: ThumbnailJob): Promise<void> {
  thumbnailQueue.push(job);
  if (!processingThumbnails) drainThumbnailQueue();
}

async function drainThumbnailQueue(): Promise<void> {
  processingThumbnails = true;
  while (thumbnailQueue.length > 0) {
    const job = thumbnailQueue.shift()!;
    try {
      const processed = await processImage(job.buffer, job.mimeType);
      if (!processed) continue;

      await Promise.all([
        uploadObject(`${job.deckId}/${job.assetId}_thumb.webp`, processed.thumbnail, 'image/webp'),
        uploadObject(`${job.deckId}/${job.assetId}_preview.webp`, processed.preview, 'image/webp'),
      ]);

      await pool.query(
        'UPDATE assets SET width = $1, height = $2, has_thumbnail = true WHERE id = $3',
        [processed.width, processed.height, job.assetId]
      );

      console.log(`[Assets] Thumbnails ready for ${job.assetId}`);
    } catch (err) {
      console.error(`[Assets] Thumbnail generation failed for ${job.assetId}:`, err);
    }
  }
  processingThumbnails = false;
}
import { uploadObject, getObject, deleteObject, deleteByPrefix } from '../storage.js';
import { requireDeckRole } from '../middleware/permissions.js';

// Image proxy sizes
const THUMBNAIL_MAX = 200;  // Small thumbnail for asset tab
const PREVIEW_MAX = 800;    // Mid-size for canvas at low zoom

/** Process an image upload: extract dimensions, generate thumbnail + preview. */
async function processImage(buffer: Buffer, mimeType: string): Promise<{
  width: number;
  height: number;
  thumbnail: Buffer;
  preview: Buffer;
} | null> {
  // Only process raster images (not SVG, audio, video)
  const rasterTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!rasterTypes.includes(mimeType)) return null;

  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) return null;

    // Thumbnail — small WebP for asset tab
    const thumbnail = await sharp(buffer)
      .rotate() // auto-orient from EXIF
      .resize(THUMBNAIL_MAX, THUMBNAIL_MAX, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toBuffer();

    // Preview — mid-size WebP for canvas
    const preview = await sharp(buffer)
      .rotate()
      .resize(PREVIEW_MAX, PREVIEW_MAX, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    return {
      width: metadata.width,
      height: metadata.height,
      thumbnail,
      preview,
    };
  } catch (err) {
    console.warn('[Assets] Image processing failed, storing original only:', err);
    return null;
  }
}

const router = Router();

/** Fetch a single asset row by ID and deck ID, or null if not found. */
async function getAssetRow(assetId: string, deckId: string): Promise<AssetRow | null> {
  const { rows } = await pool.query(
    'SELECT * FROM assets WHERE id = $1 AND deck_id = $2',
    [assetId, deckId]
  );
  return (rows[0] as AssetRow | undefined) ?? null;
}

// Multer with memory storage (buffer, no temp files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'video/mp4',
      'video/webm',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

/**
 * GET /api/decks/:deckId/assets
 * List all assets for a deck
 */
router.get('/decks/:deckId/assets', requireDeckRole('owner', 'editor', 'viewer'), async (req: Request, res: Response) => {
  const { deckId } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT * FROM assets WHERE deck_id = $1 ORDER BY created_at DESC',
      [deckId]
    );

    const assets = (rows as AssetRow[]).map((row) => ({
      id: row.id,
      deckId: row.deck_id,
      filename: row.filename,
      mimeType: row.mime_type,
      size: row.size,
      width: row.width,
      height: row.height,
      hasThumbnail: row.has_thumbnail,
      createdAt: row.created_at,
      url: `/api/decks/${deckId}/assets/${row.id}`,
      thumbnailUrl: row.has_thumbnail
        ? `/api/decks/${deckId}/assets/${row.id}/thumbnail`
        : undefined,
      previewUrl: row.has_thumbnail
        ? `/api/decks/${deckId}/assets/${row.id}/preview`
        : undefined,
    }));

    res.json(assets);
  } catch (error) {
    console.error('[Assets] Error listing assets:', error);
    res.status(500).json({ error: 'Failed to list assets' });
  }
});

/**
 * POST /api/decks/:deckId/assets
 * Upload a new asset
 */
router.post(
  '/decks/:deckId/assets',
  requireDeckRole('owner', 'editor'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    const { deckId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    try {
      const assetId = `asset-${crypto.randomUUID().slice(0, 8)}`;
      const ext = path.extname(file.originalname).toLowerCase();
      const storageKey = `${deckId}/${assetId}${ext}`;

      // Upload original to S3
      await uploadObject(storageKey, file.buffer, file.mimetype);

      // Insert into database immediately (no thumbnail yet)
      await pool.query(
        `INSERT INTO assets (id, deck_id, filename, mime_type, size, has_thumbnail, storage_key)
         VALUES ($1, $2, $3, $4, $5, false, $6)`,
        [assetId, deckId, file.originalname, file.mimetype, file.size, storageKey]
      );

      const asset = {
        id: assetId,
        deckId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        width: null,
        height: null,
        hasThumbnail: false,
        url: `/api/decks/${deckId}/assets/${assetId}`,
      };

      console.log(`[Assets] Uploaded ${file.originalname} as ${assetId} for deck ${deckId}`);
      res.status(201).json(asset);

      // Queue thumbnail generation in background
      enqueueThumbnail({ deckId, assetId, buffer: file.buffer, mimeType: file.mimetype });
    } catch (error) {
      console.error('[Assets] Error uploading asset:', error);
      res.status(500).json({ error: 'Failed to upload asset' });
    }
  }
);

/**
 * GET /api/decks/:deckId/assets/:assetId
 * Serve an asset file
 */
router.get('/decks/:deckId/assets/:assetId', requireDeckRole('owner', 'editor', 'viewer'), async (req: Request, res: Response) => {
  const { deckId, assetId } = req.params;

  try {
    const row = await getAssetRow(assetId, deckId);

    if (!row) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    const { body, contentType } = await getObject(row.storage_key);
    res.setHeader('Content-Type', contentType || row.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    body.pipe(res);
  } catch (error) {
    console.error('[Assets] Error serving asset:', error);
    res.status(500).json({ error: 'Failed to serve asset' });
  }
});

/**
 * GET /api/decks/:deckId/assets/:assetId/thumbnail
 * GET /api/decks/:deckId/assets/:assetId/preview
 * Serve a sized variant (thumbnail = 200px WebP, preview = 800px WebP)
 */
router.get('/decks/:deckId/assets/:assetId/:variant(thumbnail|preview)', requireDeckRole('owner', 'editor', 'viewer'), async (req: Request, res: Response) => {
  const { deckId, assetId, variant } = req.params;

  try {
    const row = await getAssetRow(assetId, deckId);

    if (!row || !row.has_thumbnail) {
      res.status(404).json({ error: `${variant.charAt(0).toUpperCase() + variant.slice(1)} not found` });
      return;
    }

    const suffix = variant === 'thumbnail' ? '_thumb.webp' : '_preview.webp';
    const storageKey = `${deckId}/${assetId}${suffix}`;
    const { body } = await getObject(storageKey);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    body.pipe(res);
  } catch (error) {
    console.error(`[Assets] Error serving ${variant}:`, error);
    res.status(500).json({ error: `Failed to serve ${variant}` });
  }
});

/**
 * DELETE /api/decks/:deckId/assets/:assetId
 * Delete an asset
 */
router.delete('/decks/:deckId/assets/:assetId', requireDeckRole('owner', 'editor'), async (req: Request, res: Response) => {
  const { deckId, assetId } = req.params;

  try {
    const row = await getAssetRow(assetId, deckId);

    if (!row) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    // Delete from S3 (original + any variants)
    const deletions = [deleteObject(row.storage_key)];
    if (row.has_thumbnail) {
      deletions.push(deleteObject(`${deckId}/${assetId}_thumb.webp`));
      deletions.push(deleteObject(`${deckId}/${assetId}_preview.webp`));
    }
    await Promise.all(deletions);

    // Delete from database
    await pool.query('DELETE FROM assets WHERE id = $1 AND deck_id = $2', [assetId, deckId]);

    console.log(`[Assets] Deleted ${assetId} from deck ${deckId}`);
    res.status(204).send();
  } catch (error) {
    console.error('[Assets] Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

/**
 * POST /api/decks/:deckId/cover
 * Upload a cover image for the deck (replaces any existing cover)
 */
router.post(
  '/decks/:deckId/cover',
  requireDeckRole('owner', 'editor'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    const { deckId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!file.mimetype.startsWith('image/')) {
      res.status(400).json({ error: 'Cover must be an image' });
      return;
    }

    try {
      // Delete old cover if exists
      await deleteByPrefix(`${deckId}/cover`);

      // Upload new cover
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const storageKey = `${deckId}/cover${ext}`;
      await uploadObject(storageKey, file.buffer, file.mimetype);

      // Update database with cover URL and storage key
      const coverUrl = `/api/decks/${deckId}/cover`;
      await pool.query(
        'UPDATE decks SET cover_url = $1, cover_storage_key = $2, updated_at = NOW() WHERE id = $3',
        [coverUrl, storageKey, deckId]
      );

      console.log(`[Assets] Updated cover for deck ${deckId}`);
      res.json({ coverUrl });
    } catch (error) {
      console.error('[Assets] Error uploading cover:', error);
      res.status(500).json({ error: 'Failed to upload cover' });
    }
  }
);

/**
 * GET /api/decks/:deckId/cover
 * Serve the deck's cover image
 */
router.get('/decks/:deckId/cover', requireDeckRole('owner', 'editor', 'viewer'), async (req: Request, res: Response) => {
  const { deckId } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT cover_storage_key FROM decks WHERE id = $1',
      [deckId]
    );
    const row = rows[0] as { cover_storage_key: string | null } | undefined;

    if (!row?.cover_storage_key) {
      res.status(404).json({ error: 'Cover not found' });
      return;
    }

    const { body, contentType } = await getObject(row.cover_storage_key);
    res.setHeader('Content-Type', contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    body.pipe(res);
  } catch (error) {
    console.error('[Assets] Error serving cover:', error);
    res.status(500).json({ error: 'Failed to serve cover' });
  }
});

export default router;
