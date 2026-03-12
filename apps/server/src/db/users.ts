import { pool, type UserRow } from './schema.js';

/**
 * Upsert a user from Kratos registration webhook.
 * Uses ON CONFLICT to handle duplicate webhook deliveries.
 */
export async function upsertUser(
  id: string,
  email: string,
  name: string | null
): Promise<UserRow> {
  const { rows } = await pool.query(
    `INSERT INTO users (id, email, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       name = EXCLUDED.name,
       updated_at = NOW()
     RETURNING *`,
    [id, email, name]
  );
  return rows[0];
}

/**
 * Get a user by Kratos identity ID.
 */
export async function getUser(id: string): Promise<UserRow | null> {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/**
 * Update a user's display name.
 */
export async function updateUserName(id: string, name: string): Promise<UserRow | null> {
  const { rows } = await pool.query(
    `UPDATE users SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, name]
  );
  return rows[0] ?? null;
}

/**
 * Update a user's profile fields (name only — avatar handled separately).
 */
export async function updateUser(
  id: string,
  updates: { name?: string }
): Promise<UserRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    sets.push(`name = $${++paramIndex}`);
    values.push(updates.name);
  }

  if (sets.length === 0) return getUser(id);

  values.unshift(id); // $1 = id
  sets.push('updated_at = NOW()');

  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

/**
 * Update a user's avatar URL and storage key.
 */
export async function updateUserAvatar(
  id: string,
  avatarUrl: string | null,
  avatarStorageKey: string | null
): Promise<UserRow | null> {
  const { rows } = await pool.query(
    `UPDATE users SET avatar_url = $2, avatar_storage_key = $3, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, avatarUrl, avatarStorageKey]
  );
  return rows[0] ?? null;
}

/**
 * Get a user by email.
 */
export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] ?? null;
}
