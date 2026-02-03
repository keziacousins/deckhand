/**
 * Asset upload and serving routes.
 */

import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db, type AssetRow } from '../db/schema.js';
import { paths, ensureDeckAssetDir } from '../config.js';

const router = Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const deckId = req.params.deckId;
    const assetDir = ensureDeckAssetDir(deckId);
    cb(null, assetDir);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename: assetId.ext
    const assetId = `asset-${crypto.randomUUID().slice(0, 8)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${assetId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (_req, file, cb) => {
    // Allow images, audio, video
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
router.get('/decks/:deckId/assets', (req: Request, res: Response) => {
  const { deckId } = req.params;

  try {
    const stmt = db.prepare(`
      SELECT * FROM assets WHERE deck_id = ? ORDER BY created_at DESC
    `);
    const rows = stmt.all(deckId) as AssetRow[];

    const assets = rows.map((row) => ({
      id: row.id,
      deckId: row.deck_id,
      filename: row.filename,
      mimeType: row.mime_type,
      size: row.size,
      width: row.width,
      height: row.height,
      hasThumbnail: row.has_thumbnail === 1,
      createdAt: row.created_at,
      url: `/api/decks/${deckId}/assets/${row.id}`,
      thumbnailUrl: row.has_thumbnail === 1
        ? `/api/decks/${deckId}/assets/${row.id}/thumbnail`
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
  upload.single('file'),
  async (req: Request, res: Response) => {
    const { deckId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    try {
      // Extract asset ID from filename (before extension)
      const assetId = path.basename(file.filename, path.extname(file.filename));

      // Get image dimensions if applicable
      let width: number | null = null;
      let height: number | null = null;

      if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') {
        // TODO: Use sharp to get dimensions and generate thumbnail
        // For now, we'll skip this
      }

      // Insert into database
      const stmt = db.prepare(`
        INSERT INTO assets (id, deck_id, filename, mime_type, size, width, height, has_thumbnail)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        assetId,
        deckId,
        file.originalname,
        file.mimetype,
        file.size,
        width,
        height,
        0 // has_thumbnail
      );

      const asset = {
        id: assetId,
        deckId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        width,
        height,
        hasThumbnail: false,
        url: `/api/decks/${deckId}/assets/${assetId}`,
      };

      console.log(`[Assets] Uploaded ${file.originalname} as ${assetId} for deck ${deckId}`);
      res.status(201).json(asset);
    } catch (error) {
      console.error('[Assets] Error uploading asset:', error);
      // Clean up file on error
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      res.status(500).json({ error: 'Failed to upload asset' });
    }
  }
);

/**
 * GET /api/decks/:deckId/assets/:assetId
 * Serve an asset file
 */
router.get('/decks/:deckId/assets/:assetId', (req: Request, res: Response) => {
  const { deckId, assetId } = req.params;

  try {
    // Get asset metadata
    const stmt = db.prepare('SELECT * FROM assets WHERE id = ? AND deck_id = ?');
    const row = stmt.get(assetId, deckId) as AssetRow | undefined;

    if (!row) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    // Find the file (we need to check with extension)
    const assetDir = paths.deckAssets(deckId);
    const files = fs.readdirSync(assetDir);
    const assetFile = files.find((f) => f.startsWith(assetId));

    if (!assetFile) {
      res.status(404).json({ error: 'Asset file not found' });
      return;
    }

    const filePath = path.join(assetDir, assetFile);
    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    res.sendFile(filePath);
  } catch (error) {
    console.error('[Assets] Error serving asset:', error);
    res.status(500).json({ error: 'Failed to serve asset' });
  }
});

/**
 * DELETE /api/decks/:deckId/assets/:assetId
 * Delete an asset
 */
router.delete('/decks/:deckId/assets/:assetId', (req: Request, res: Response) => {
  const { deckId, assetId } = req.params;

  try {
    // Get asset metadata first
    const selectStmt = db.prepare('SELECT * FROM assets WHERE id = ? AND deck_id = ?');
    const row = selectStmt.get(assetId, deckId) as AssetRow | undefined;

    if (!row) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    // Delete from database
    const deleteStmt = db.prepare('DELETE FROM assets WHERE id = ? AND deck_id = ?');
    deleteStmt.run(assetId, deckId);

    // Delete file(s) from disk
    const assetDir = paths.deckAssets(deckId);
    const files = fs.readdirSync(assetDir);
    for (const file of files) {
      if (file.startsWith(assetId)) {
        fs.unlinkSync(path.join(assetDir, file));
      }
    }

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
  upload.single('file'),
  async (req: Request, res: Response) => {
    const { deckId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Validate it's an image
    if (!file.mimetype.startsWith('image/')) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: 'Cover must be an image' });
      return;
    }

    try {
      // Delete old cover file if exists
      const assetDir = paths.deckAssets(deckId);
      const existingFiles = fs.readdirSync(assetDir);
      for (const f of existingFiles) {
        if (f.startsWith('cover.')) {
          fs.unlinkSync(path.join(assetDir, f));
        }
      }

      // Rename uploaded file to cover.ext
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const coverFilename = `cover${ext}`;
      const coverPath = path.join(assetDir, coverFilename);
      fs.renameSync(file.path, coverPath);

      // Update database with cover URL
      const coverUrl = `/api/decks/${deckId}/cover`;
      const stmt = db.prepare("UPDATE decks SET cover_url = ?, updated_at = datetime('now') WHERE id = ?");
      stmt.run(coverUrl, deckId);

      console.log(`[Assets] Updated cover for deck ${deckId}`);
      res.json({ coverUrl });
    } catch (error) {
      console.error('[Assets] Error uploading cover:', error);
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      res.status(500).json({ error: 'Failed to upload cover' });
    }
  }
);

/**
 * GET /api/decks/:deckId/cover
 * Serve the deck's cover image
 */
router.get('/decks/:deckId/cover', (req: Request, res: Response) => {
  const { deckId } = req.params;

  try {
    const assetDir = paths.deckAssets(deckId);
    
    if (!fs.existsSync(assetDir)) {
      res.status(404).json({ error: 'Cover not found' });
      return;
    }

    const files = fs.readdirSync(assetDir);
    const coverFile = files.find(f => f.startsWith('cover.'));

    if (!coverFile) {
      res.status(404).json({ error: 'Cover not found' });
      return;
    }

    const coverPath = path.join(assetDir, coverFile);
    const ext = path.extname(coverFile).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache (covers change)
    res.sendFile(coverPath);
  } catch (error) {
    console.error('[Assets] Error serving cover:', error);
    res.status(500).json({ error: 'Failed to serve cover' });
  }
});

export default router;
