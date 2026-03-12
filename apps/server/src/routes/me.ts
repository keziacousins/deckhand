/**
 * /api/me routes — authenticated user profile management.
 */

import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { getAuthUser } from '../middleware/auth.js';
import { getUser, updateUser, updateUserAvatar } from '../db/users.js';
import { uploadObject, deleteObject, getObject } from '../storage.js';

const AVATAR_SIZE = 256; // px — square, covers 2x for 128px display

export const meRouter = Router();
export const avatarsRouter = Router();

function formatUser(user: { id: string; email: string; name: string | null; avatar_url: string | null; created_at: string; updated_at: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

// Avatar upload config — images only, 5MB max
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed for avatars`));
    }
  },
});

/**
 * GET /api/me — return current user's profile
 */
meRouter.get('/', async (req: Request, res: Response) => {
  const claims = getAuthUser(req);
  if (!claims) return res.status(401).json({ error: 'Not authenticated' });

  const user = await getUser(claims.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json(formatUser(user));
});

/**
 * PUT /api/me — update profile fields (name)
 */
meRouter.put('/', async (req: Request, res: Response) => {
  const claims = getAuthUser(req);
  if (!claims) return res.status(401).json({ error: 'Not authenticated' });

  const { name } = req.body;
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({ error: 'Name must be a non-empty string' });
  }

  const updates: { name?: string } = {};
  if (name !== undefined) updates.name = name.trim();

  const user = await updateUser(claims.sub, updates);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json(formatUser(user));
});

/**
 * POST /api/me/avatar — upload avatar image
 */
meRouter.post('/avatar', avatarUpload.single('file'), async (req: Request, res: Response) => {
  const claims = getAuthUser(req);
  if (!claims) return res.status(401).json({ error: 'Not authenticated' });

  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file provided' });

  // Delete old avatar if exists
  const existing = await getUser(claims.sub);
  if (existing?.avatar_storage_key) {
    try {
      await deleteObject(existing.avatar_storage_key);
    } catch {
      // Ignore — old file may already be gone
    }
  }

  // Normalize orientation, resize to 256x256 center-crop, convert to WebP
  const processed = await sharp(file.buffer)
    .rotate() // auto-rotate based on EXIF orientation
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'center' })
    .webp({ quality: 85 })
    .toBuffer();

  const storageKey = `avatars/${claims.sub}.webp`;

  await uploadObject(storageKey, processed, 'image/webp');

  const avatarUrl = `/api/avatars/${claims.sub}`;
  const user = await updateUserAvatar(claims.sub, avatarUrl, storageKey);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json(formatUser(user));
});

/**
 * GET /api/me/avatar — redirect to canonical avatar URL
 */
meRouter.get('/avatar', async (req: Request, res: Response) => {
  const claims = getAuthUser(req);
  if (!claims) return res.status(401).json({ error: 'Not authenticated' });
  res.redirect(`/api/avatars/${claims.sub}`);
});

/**
 * DELETE /api/me/avatar — remove avatar
 */
meRouter.delete('/avatar', async (req: Request, res: Response) => {
  const claims = getAuthUser(req);
  if (!claims) return res.status(401).json({ error: 'Not authenticated' });

  const user = await getUser(claims.sub);
  if (user?.avatar_storage_key) {
    try {
      await deleteObject(user.avatar_storage_key);
    } catch {
      // Ignore
    }
  }

  const updated = await updateUserAvatar(claims.sub, null, null);
  if (!updated) return res.status(404).json({ error: 'User not found' });

  res.json(formatUser(updated));
});

/**
 * GET /api/avatars/:userId — serve any user's avatar (authenticated).
 * Used by presence system so users can see each other's avatars.
 */
avatarsRouter.get('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = await getUser(userId);
  if (!user?.avatar_storage_key) return res.status(404).json({ error: 'No avatar' });

  try {
    const { body, contentType } = await getObject(user.avatar_storage_key);
    if (contentType) res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    body.pipe(res);
  } catch {
    res.status(404).json({ error: 'Avatar not found' });
  }
});
