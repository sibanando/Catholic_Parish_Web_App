import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import pool from '../db/pool';
import { authenticate } from '../middleware/auth';
import { requireRoles, ROLES } from '../middleware/rbac';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function generateTokens(payload: { userId: string; email: string; parishId: string; roles: string[] }) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
  });
  return { accessToken, refreshToken };
}

// POST /auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;

  try {
    const userRes = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.parish_id, u.is_active, u.first_name, u.last_name,
              array_agg(r.name) as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.email = $1
       GROUP BY u.id`,
      [email]
    );

    const user = userRes.rows[0];
    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const roles = (user.roles as string[]).filter(Boolean);
    const payload = { userId: user.id, email: user.email, parishId: user.parish_id, roles };
    const { accessToken, refreshToken } = generateTokens(payload);

    const refreshHash = await bcrypt.hash(refreshToken, 8);
    await pool.query('UPDATE users SET refresh_token_hash = $1 WHERE id = $2', [refreshHash, user.id]);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        parishId: user.parish_id,
        roles,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(401).json({ error: 'Refresh token required' });
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      userId: string; email: string; parishId: string; roles: string[];
    };

    const userRes = await pool.query(
      'SELECT id, refresh_token_hash, is_active FROM users WHERE id = $1',
      [payload.userId]
    );
    const user = userRes.rows[0];
    if (!user || !user.is_active || !user.refresh_token_hash) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const valid = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const { accessToken, refreshToken: newRefresh } = generateTokens({
      userId: payload.userId, email: payload.email, parishId: payload.parishId, roles: payload.roles,
    });
    const newHash = await bcrypt.hash(newRefresh, 8);
    await pool.query('UPDATE users SET refresh_token_hash = $1 WHERE id = $2', [newHash, user.id]);

    res.json({ accessToken, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// GET /users (admin only)
router.get('/users', authenticate, requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.created_at,
              array_agg(r.name) as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.parish_id = $1
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      [req.user!.parishId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users (admin only)
router.post('/users', authenticate, requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    roles: z.array(z.string()).min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { email, password, firstName, lastName, roles } = parsed.data;
  try {
    const hash = await bcrypt.hash(password, 12);
    const userRes = await pool.query(
      `INSERT INTO users (parish_id, email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.user!.parishId, email, hash, firstName, lastName]
    );
    const userId = userRes.rows[0].id;

    for (const roleName of roles) {
      const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', [roleName]);
      if (roleRes.rows[0]) {
        await pool.query('INSERT INTO user_roles VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, roleRes.rows[0].id]);
      }
    }

    res.status(201).json({ id: userId, email, firstName, lastName, roles });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException & { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// PUT /users/:id (admin only)
router.put('/users/:id', authenticate, requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
    roles: z.array(z.string()).min(1).optional(),
    password: z.string().min(8).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  const { firstName, lastName, isActive, roles, password } = parsed.data;
  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1 AND parish_id = $2', [req.params.id, req.user!.parishId]);
    if (!userCheck.rows[0]) { res.status(404).json({ error: 'User not found' }); return; }

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (firstName !== undefined) { sets.push(`first_name = $${idx++}`); params.push(firstName); }
    if (lastName !== undefined) { sets.push(`last_name = $${idx++}`); params.push(lastName); }
    if (isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(isActive); }
    if (password !== undefined) { sets.push(`password_hash = $${idx++}`); params.push(await bcrypt.hash(password, 12)); }

    if (sets.length > 0) {
      sets.push(`updated_at = NOW()`);
      await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, [...params, req.params.id]);
    }

    if (roles !== undefined) {
      await pool.query('DELETE FROM user_roles WHERE user_id = $1', [req.params.id]);
      for (const roleName of roles) {
        const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', [roleName]);
        if (roleRes.rows[0]) {
          await pool.query('INSERT INTO user_roles VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, roleRes.rows[0].id]);
        }
      }
    }

    const updated = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.created_at,
              array_agg(r.name) as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.id = $1 GROUP BY u.id`,
      [req.params.id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /users/:id (admin only)
router.delete('/users/:id', authenticate, requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.params.id === req.user!.userId) { res.status(400).json({ error: 'Cannot delete your own account' }); return; }
    const result = await pool.query('DELETE FROM users WHERE id = $1 AND parish_id = $2 RETURNING id', [req.params.id, req.user!.parishId]);
    if (!result.rows[0]) { res.status(404).json({ error: 'User not found' }); return; }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
