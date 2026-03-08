/**
 * Deck permission middleware.
 * Checks the authenticated user's role on a deck before allowing access.
 */

import type { Request, Response, NextFunction } from 'express';
import { getDeckRole } from '../db/shares.js';
import { getAuthUser } from './auth.js';
import type { DeckRole } from '../db/schema.js';

declare global {
  namespace Express {
    interface Request {
      deckRole?: DeckRole;
    }
  }
}

/**
 * Middleware factory: requires the user to have one of the specified roles
 * on the deck identified by :id or :deckId in the route params.
 */
export function requireDeckRole(...roles: DeckRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const deckId = req.params.id || req.params.deckId;
    if (!deckId) {
      return res.status(400).json({ error: 'Missing deck ID' });
    }

    const role = await getDeckRole(deckId, user.sub);
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.deckRole = role;
    next();
  };
}
