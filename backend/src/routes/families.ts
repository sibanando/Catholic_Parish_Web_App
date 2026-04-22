import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { authenticate } from '../middleware/auth';
import { requireRoles, ROLES } from '../middleware/rbac';
import { logAudit } from '../middleware/audit';

const router = Router();
router.use(authenticate);

const familySchema = z.object({
  familyName: z.string().min(1).max(255),
  address: z.string().optional(),
  status: z.enum(['active', 'inactive', 'transferred', 'deceased']).optional(),
  notes: z.string().optional(),
});

// GET /families
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { search, status, page = '1', limit = '20' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  const conditions: string[] = ['f.parish_id = $1'];
  const params: unknown[] = [req.user!.parishId];
  let idx = 2;

  if (search) { conditions.push(`f.family_name ILIKE $${idx++}`); params.push(`%${search}%`); }
  if (status) { conditions.push(`f.status = $${idx++}`); params.push(status); }

  const where = conditions.join(' AND ');
  try {
    const countRes = await pool.query(`SELECT COUNT(*) FROM families f WHERE ${where}`, params);
    const result = await pool.query(
      `SELECT f.*, COUNT(fm.id) as member_count
       FROM families f
       LEFT JOIN family_memberships fm ON f.id = fm.family_id
       WHERE ${where}
       GROUP BY f.id
       ORDER BY f.family_name
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit as string), offset]
    );
    res.json({ data: result.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page as string) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /families
router.post('/', requireRoles(ROLES.ADMIN, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  const parsed = familySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  const { familyName, address, status = 'active', notes } = parsed.data;
  try {
    const result = await pool.query(
      `INSERT INTO families (parish_id, family_name, address, status, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user!.parishId, familyName, address, status, notes]
    );
    await logAudit(req, 'family', result.rows[0].id, 'CREATE', undefined, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /families/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const familyRes = await pool.query(
      'SELECT * FROM families WHERE id = $1 AND parish_id = $2',
      [req.params.id, req.user!.parishId]
    );
    if (!familyRes.rows[0]) { res.status(404).json({ error: 'Family not found' }); return; }

    const membersRes = await pool.query(
      `SELECT p.*, fm.relationship,
              (SELECT json_agg(json_build_object(
                'id', s.id, 'code', st.code, 'name', st.name, 'date', s.date, 'status', s.status
              ) ORDER BY st.sequence_order)
               FROM sacraments s
               JOIN sacrament_types st ON s.sacrament_type_id = st.id
               WHERE s.person_id = p.id) as sacraments
       FROM people p
       JOIN family_memberships fm ON p.id = fm.person_id
       WHERE fm.family_id = $1
       ORDER BY fm.relationship, p.last_name`,
      [req.params.id]
    );

    res.json({ ...familyRes.rows[0], members: membersRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /families/:id
router.put('/:id', requireRoles(ROLES.ADMIN, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  const parsed = familySchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  try {
    const before = await pool.query('SELECT * FROM families WHERE id = $1', [req.params.id]);
    if (!before.rows[0]) { res.status(404).json({ error: 'Family not found' }); return; }

    const { familyName, address, status, notes } = parsed.data;
    const result = await pool.query(
      `UPDATE families SET
         family_name = COALESCE($1, family_name),
         address = COALESCE($2, address),
         status = COALESCE($3, status),
         notes = COALESCE($4, notes),
         updated_at = NOW()
       WHERE id = $5 AND parish_id = $6 RETURNING *`,
      [familyName, address, status, notes, req.params.id, req.user!.parishId]
    );
    await logAudit(req, 'family', req.params.id, 'UPDATE', before.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /families/:id/members
router.post('/:id/members', requireRoles(ROLES.ADMIN, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    personId: z.string().uuid(),
    relationship: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  try {
    const result = await pool.query(
      'INSERT INTO family_memberships (family_id, person_id, relationship) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *',
      [req.params.id, parsed.data.personId, parsed.data.relationship]
    );
    // Set primary_family_id on the person if not already assigned
    await pool.query(
      'UPDATE people SET primary_family_id = $1 WHERE id = $2 AND primary_family_id IS NULL',
      [req.params.id, parsed.data.personId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /families/:id
router.delete('/:id', requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  try {
    const before = await pool.query('SELECT * FROM families WHERE id = $1 AND parish_id = $2', [req.params.id, req.user!.parishId]);
    if (!before.rows[0]) { res.status(404).json({ error: 'Family not found' }); return; }

    await pool.query('DELETE FROM families WHERE id = $1 AND parish_id = $2', [req.params.id, req.user!.parishId]);
    await logAudit(req, 'family', req.params.id, 'DELETE', before.rows[0], undefined);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
