import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { authenticate } from '../middleware/auth';
import { requireRoles, ROLES } from '../middleware/rbac';
import { logAudit } from '../middleware/audit';

const router = Router();
router.use(authenticate);

const personSchema = z.object({
  firstName: z.string().min(1).max(100),
  middleName: z.string().optional(),
  lastName: z.string().min(1).max(100),
  maidenName: z.string().optional(),
  baptismalName: z.string().optional(),
  fatherName: z.string().min(1, 'Father name is required'),
  motherName: z.string().min(1, 'Mother name is required'),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive', 'deceased', 'transferred']).optional(),
  primaryFamilyId: z.string().uuid().optional(),
});

// GET /people (search)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { search, page = '1', limit = '20' } = req.query;
  const p = Math.max(1, parseInt(page as string));
  const lim = Math.min(100, Math.max(1, parseInt(limit as string)));
  const offset = (p - 1) * lim;

  // Scope to parish via family membership — avoids leaking parish-less people
  const parishScope = `EXISTS (
    SELECT 1 FROM family_memberships fm2
    JOIN families f2 ON fm2.family_id = f2.id
    WHERE fm2.person_id = p.id AND f2.parish_id = $1
  )`;

  const conditions: string[] = [parishScope];
  const params: unknown[] = [req.user!.parishId];
  let idx = 2;

  if (search) {
    conditions.push(`(
      p.first_name ILIKE $${idx} OR p.last_name ILIKE $${idx}
      OR p.maiden_name ILIKE $${idx} OR p.baptismal_name ILIKE $${idx}
      OR (p.first_name || ' ' || p.last_name) ILIKE $${idx}
    )`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.join(' AND ');

  try {
    const [countRes, dataRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM people p WHERE ${where}`,
        params
      ),
      pool.query(
        `SELECT p.*, f.family_name
         FROM people p
         LEFT JOIN families f ON p.primary_family_id = f.id
         WHERE ${where}
         ORDER BY p.last_name, p.first_name
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, lim, offset]
      ),
    ]);
    res.json({ data: dataRes.rows, total: parseInt(countRes.rows[0].count), page: p });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /people
router.post('/', requireRoles(ROLES.ADMIN, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  const parsed = personSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  const { firstName, middleName, lastName, maidenName, baptismalName, fatherName, motherName, dob, gender, email, phone, status = 'active', primaryFamilyId } = parsed.data;
  try {
    const result = await pool.query(
      `INSERT INTO people (primary_family_id, first_name, middle_name, last_name, maiden_name, baptismal_name, father_name, mother_name, dob, gender, email, phone, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [primaryFamilyId, firstName, middleName, lastName, maidenName, baptismalName, fatherName, motherName, dob || null, gender, email || null, phone, status]
    );
    await logAudit(req, 'person', result.rows[0].id, 'CREATE', undefined, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /people/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const personRes = await pool.query(
      `SELECT p.*, f.family_name
       FROM people p
       LEFT JOIN families f ON p.primary_family_id = f.id
       WHERE p.id = $1 AND EXISTS (
         SELECT 1 FROM family_memberships fm
         JOIN families f2 ON fm.family_id = f2.id
         WHERE fm.person_id = p.id AND f2.parish_id = $2
       )`,
      [req.params.id, req.user!.parishId]
    );
    if (!personRes.rows[0]) { res.status(404).json({ error: 'Person not found' }); return; }

    const sacramentsRes = await pool.query(
      `SELECT s.*, st.code, st.name as sacrament_name, st.sequence_order,
              p2.name as parish_name,
              json_agg(json_build_object('name', sp.name, 'role', sp.role)) FILTER (WHERE sp.id IS NOT NULL) as sponsors
       FROM sacraments s
       JOIN sacrament_types st ON s.sacrament_type_id = st.id
       LEFT JOIN parishes p2 ON s.parish_id = p2.id
       LEFT JOIN sacrament_sponsors sp ON s.id = sp.sacrament_id
       WHERE s.person_id = $1
       GROUP BY s.id, st.code, st.name, st.sequence_order, p2.name
       ORDER BY st.sequence_order`,
      [req.params.id]
    );

    const familiesRes = await pool.query(
      `SELECT f.id, f.family_name, fm.relationship
       FROM families f
       JOIN family_memberships fm ON f.id = fm.family_id
       WHERE fm.person_id = $1`,
      [req.params.id]
    );

    res.json({ ...personRes.rows[0], sacraments: sacramentsRes.rows, families: familiesRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /people/:id
router.put('/:id', requireRoles(ROLES.ADMIN, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  const parsed = personSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  try {
    const before = await pool.query('SELECT * FROM people WHERE id = $1', [req.params.id]);
    if (!before.rows[0]) { res.status(404).json({ error: 'Person not found' }); return; }

    const d = parsed.data;
    const result = await pool.query(
      `UPDATE people SET
         first_name = COALESCE($1, first_name),
         middle_name = COALESCE($2, middle_name),
         last_name = COALESCE($3, last_name),
         maiden_name = COALESCE($4, maiden_name),
         baptismal_name = COALESCE($5, baptismal_name),
         father_name = COALESCE($6, father_name),
         mother_name = COALESCE($7, mother_name),
         dob = COALESCE($8, dob),
         gender = COALESCE($9, gender),
         email = COALESCE($10, email),
         phone = COALESCE($11, phone),
         status = COALESCE($12, status),
         updated_at = NOW()
       WHERE id = $13 RETURNING *`,
      [d.firstName, d.middleName, d.lastName, d.maidenName, d.baptismalName,
       d.fatherName, d.motherName,
       d.dob || null, d.gender, d.email || null, d.phone, d.status, req.params.id]
    );
    await logAudit(req, 'person', req.params.id, 'UPDATE', before.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /people/:id
router.delete('/:id', requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  try {
    const before = await pool.query('SELECT * FROM people WHERE id = $1', [req.params.id]);
    if (!before.rows[0]) { res.status(404).json({ error: 'Person not found' }); return; }

    await pool.query('DELETE FROM people WHERE id = $1 AND EXISTS (SELECT 1 FROM family_memberships fm JOIN families f ON fm.family_id = f.id WHERE fm.person_id = $1 AND f.parish_id = $2)', [req.params.id, req.user!.parishId]);
    await logAudit(req, 'person', req.params.id, 'DELETE', before.rows[0], undefined);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
