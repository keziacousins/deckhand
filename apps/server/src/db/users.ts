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
 * Get a user by email.
 */
export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] ?? null;
}
