import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { authenticate } from '../middleware/auth';
import { requireRoles, ROLES } from '../middleware/rbac';
import { logAudit } from '../middleware/audit';

const router = Router();
router.use(authenticate);

const sacramentSchema = z.object({
  personId: z.string().uuid(),
  sacramentTypeId: z.string().uuid(),
  date: z.string().optional(),
  celebrant: z.string().optional(),
  celebrantRole: z.string().optional(),
  registerVolume: z.string().optional(),
  registerPage: z.string().optional(),
  place: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
  sponsors: z.array(z.object({ name: z.string(), role: z.string() })).optional(),
  brideData: z.object({
    name: z.string().min(1),
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
});

// GET /sacrament-types
router.get('/types', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM sacrament_types ORDER BY sequence_order');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /sacraments
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { typeCode, personId, personName, celebrant, dateFrom, dateTo, status, page = '1', limit = '20' } = req.query;
  const p = Math.max(1, parseInt(page as string));
  const lim = Math.min(100, Math.max(1, parseInt(limit as string)));
  const offset = (p - 1) * lim;
  const conditions: string[] = ['s.parish_id = $1'];
  const params: unknown[] = [req.user!.parishId];
  let idx = 2;

  if (typeCode) { conditions.push(`st.code = $${idx++}`); params.push(typeCode); }
  if (personId) { conditions.push(`s.person_id = $${idx++}`); params.push(personId); }
  if (personName) { conditions.push(`(p.first_name ILIKE $${idx} OR p.last_name ILIKE $${idx} OR (p.first_name || ' ' || p.last_name) ILIKE $${idx})`); params.push(`%${personName}%`); idx++; }
  if (celebrant) { conditions.push(`s.celebrant ILIKE $${idx++}`); params.push(`%${celebrant}%`); }
  if (dateFrom) { conditions.push(`s.date >= $${idx++}`); params.push(dateFrom); }
  if (dateTo) { conditions.push(`s.date <= $${idx++}`); params.push(dateTo); }
  if (status) { conditions.push(`s.status = $${idx++}`); params.push(status); }

  const where = conditions.join(' AND ');
  try {
    const [countRes, dataRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM sacraments s
         JOIN sacrament_types st ON s.sacrament_type_id = st.id
         JOIN people p ON s.person_id = p.id
         WHERE ${where}`,
        params
      ),
      pool.query(
        `SELECT s.*, st.code, st.name as sacrament_name, st.sequence_order,
                p.first_name, p.last_name
         FROM sacraments s
         JOIN sacrament_types st ON s.sacrament_type_id = st.id
         JOIN people p ON s.person_id = p.id
         WHERE ${where}
         ORDER BY s.date DESC NULLS LAST
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

// POST /sacraments
router.post('/', requireRoles(ROLES.ADMIN, ROLES.CLERK, ROLES.PRIEST), async (req: Request, res: Response): Promise<void> => {
  const parsed = sacramentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  const { personId, sacramentTypeId, date, celebrant, celebrantRole, registerVolume, registerPage, place, notes, status = 'completed', sponsors, brideData } = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO sacraments (person_id, sacrament_type_id, parish_id, date, celebrant, celebrant_role, register_volume, register_page, place, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [personId, sacramentTypeId, req.user!.parishId, date || null, celebrant, celebrantRole, registerVolume, registerPage, place, notes, status]
    );
    const sacramentId = result.rows[0].id;

    if (sponsors?.length) {
      for (const sp of sponsors) {
        await client.query(
          'INSERT INTO sacrament_sponsors (sacrament_id, name, role) VALUES ($1,$2,$3)',
          [sacramentId, sp.name, sp.role]
        );
      }
    }

    // Handle bride data for Matrimony
    if (brideData) {
      const typeRes = await client.query('SELECT code FROM sacrament_types WHERE id = $1', [sacramentTypeId]);
      if (typeRes.rows[0]?.code === 'MATRIMONY') {
        const nameParts = brideData.name.trim().split(' ');
        const brideFirst = nameParts[0];
        const brideLast = nameParts.slice(1).join(' ') || nameParts[0];
        const brideRes = await client.query(
          `INSERT INTO people (first_name, last_name, father_name, mother_name) VALUES ($1,$2,$3,$4) RETURNING id`,
          [brideFirst, brideLast, brideData.fatherName || null, brideData.motherName || null]
        );
        const brideId = brideRes.rows[0].id;
        if (brideData.address?.trim()) {
          const famRes = await client.query(
            `INSERT INTO families (parish_id, family_name, address) VALUES ($1,$2,$3) RETURNING id`,
            [req.user!.parishId, brideData.name.trim(), brideData.address.trim()]
          );
          await client.query(
            'INSERT INTO family_memberships (family_id, person_id, relationship) VALUES ($1,$2,$3)',
            [famRes.rows[0].id, brideId, 'head']
          );
          await client.query('UPDATE people SET primary_family_id = $1 WHERE id = $2', [famRes.rows[0].id, brideId]);
        }
        await client.query(
          `INSERT INTO marriages (sacrament_id, spouse1_person_id, spouse2_person_id) VALUES ($1,$2,$3)`,
          [sacramentId, personId, brideId]
        );
      }
    }

    await client.query('COMMIT');
    await logAudit(req, 'sacrament', sacramentId, 'CREATE', undefined, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /sacraments/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT s.*, st.code, st.name as sacrament_name,
              p.first_name, p.last_name, p.dob,
              json_agg(json_build_object('id', sp.id, 'name', sp.name, 'role', sp.role)) FILTER (WHERE sp.id IS NOT NULL) as sponsors
       FROM sacraments s
       JOIN sacrament_types st ON s.sacrament_type_id = st.id
       JOIN people p ON s.person_id = p.id
       LEFT JOIN sacrament_sponsors sp ON s.id = sp.sacrament_id
       WHERE s.id = $1
       GROUP BY s.id, st.code, st.name, p.first_name, p.last_name, p.dob`,
      [req.params.id]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Sacrament not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /sacraments/:id/bride — create or update bride info for a Matrimony sacrament
router.patch('/:id/bride', requireRoles(ROLES.ADMIN, ROLES.CLERK, ROLES.PRIEST), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1),
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
    address: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  const { name, fatherName, motherName, address } = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify it's a completed MATRIMONY sacrament belonging to this parish
    const sacRes = await client.query(
      `SELECT s.person_id, st.code FROM sacraments s
       JOIN sacrament_types st ON s.sacrament_type_id = st.id
       WHERE s.id = $1 AND s.parish_id = $2`,
      [req.params.id, req.user!.parishId]
    );
    if (!sacRes.rows[0]) { res.status(404).json({ error: 'Sacrament not found' }); return; }
    if (sacRes.rows[0].code !== 'MATRIMONY') { res.status(400).json({ error: 'Not a Matrimony sacrament' }); return; }

    const nameParts = name.trim().split(' ');
    const brideFirst = nameParts[0];
    const brideLast = nameParts.slice(1).join(' ') || nameParts[0];

    // Check existing marriage row
    const existingM = await client.query('SELECT * FROM marriages WHERE sacrament_id = $1', [req.params.id]);
    let brideId: string;

    if (existingM.rows[0]?.spouse2_person_id) {
      // Update existing bride person
      brideId = existingM.rows[0].spouse2_person_id;
      await client.query(
        'UPDATE people SET first_name=$1, last_name=$2, father_name=$3, mother_name=$4 WHERE id=$5',
        [brideFirst, brideLast, fatherName || null, motherName || null, brideId]
      );
    } else {
      // Create new bride person
      const brideRes = await client.query(
        'INSERT INTO people (first_name, last_name, father_name, mother_name) VALUES ($1,$2,$3,$4) RETURNING id',
        [brideFirst, brideLast, fatherName || null, motherName || null]
      );
      brideId = brideRes.rows[0].id;
    }

    // Handle address
    if (address?.trim()) {
      const personRes = await client.query('SELECT primary_family_id FROM people WHERE id=$1', [brideId]);
      if (personRes.rows[0]?.primary_family_id) {
        await client.query('UPDATE families SET address=$1 WHERE id=$2', [address.trim(), personRes.rows[0].primary_family_id]);
      } else {
        const famRes = await client.query(
          'INSERT INTO families (parish_id, family_name, address) VALUES ($1,$2,$3) RETURNING id',
          [req.user!.parishId, name.trim(), address.trim()]
        );
        await client.query('INSERT INTO family_memberships (family_id, person_id, relationship) VALUES ($1,$2,$3)', [famRes.rows[0].id, brideId, 'head']);
        await client.query('UPDATE people SET primary_family_id=$1 WHERE id=$2', [famRes.rows[0].id, brideId]);
      }
    }

    // Upsert marriages row
    if (existingM.rows[0]) {
      await client.query('UPDATE marriages SET spouse2_person_id=$1 WHERE sacrament_id=$2', [brideId, req.params.id]);
    } else {
      await client.query(
        'INSERT INTO marriages (sacrament_id, spouse1_person_id, spouse2_person_id) VALUES ($1,$2,$3)',
        [req.params.id, sacRes.rows[0].person_id, brideId]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /sacraments/:id
router.put('/:id', requireRoles(ROLES.ADMIN, ROLES.CLERK, ROLES.PRIEST), async (req: Request, res: Response): Promise<void> => {
  const parsed = sacramentSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  try {
    const before = await pool.query('SELECT * FROM sacraments WHERE id = $1', [req.params.id]);
    if (!before.rows[0]) { res.status(404).json({ error: 'Sacrament not found' }); return; }

    const d = parsed.data;
    const result = await pool.query(
      `UPDATE sacraments SET
         date = COALESCE($1, date),
         celebrant = COALESCE($2, celebrant),
         celebrant_role = COALESCE($3, celebrant_role),
         register_volume = COALESCE($4, register_volume),
         register_page = COALESCE($5, register_page),
         place = COALESCE($6, place),
         notes = COALESCE($7, notes),
         status = COALESCE($8, status),
         updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [d.date || null, d.celebrant, d.celebrantRole, d.registerVolume, d.registerPage, d.place, d.notes, d.status, req.params.id]
    );
    await logAudit(req, 'sacrament', req.params.id, 'UPDATE', before.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
