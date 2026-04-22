import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { authenticate } from '../middleware/auth';
import { requireRoles, ROLES } from '../middleware/rbac';
import { logAudit } from '../middleware/audit';
import { generateExcelBuffer } from '../utils/excel';
import { generatePDF, renderTemplate, ensureCertDir } from '../utils/pdf';
import { numberToWordsOdia, numberToWordsEnglish } from '../utils/number-to-words';

const router = Router();
router.use(authenticate);

// ── Donation Types ──────────────────────────────────────────

// GET /types
router.get('/types', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT * FROM donation_types WHERE parish_id = $1 ORDER BY sort_order, name',
      [req.user!.parishId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /types (admin only)
router.post('/types', requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(100),
    nameOdia: z.string().max(100).optional(),
    isRecurring: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  const { code, name, nameOdia, isRecurring, sortOrder } = parsed.data;
  try {
    const result = await pool.query(
      `INSERT INTO donation_types (parish_id, code, name, name_odia, is_recurring, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user!.parishId, code, name, nameOdia || null, isRecurring ?? false, sortOrder ?? 0]
    );
    await logAudit(req, 'donation_type', result.rows[0].id, 'CREATE', undefined, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Donation type code already exists for this parish' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// PUT /types/:id (admin only)
router.put('/types/:id', requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    nameOdia: z.string().max(100).optional(),
    isRecurring: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  try {
    const before = await pool.query('SELECT * FROM donation_types WHERE id = $1 AND parish_id = $2', [req.params.id, req.user!.parishId]);
    if (!before.rows[0]) { res.status(404).json({ error: 'Donation type not found' }); return; }

    const { name, nameOdia, isRecurring, sortOrder } = parsed.data;
    const result = await pool.query(
      `UPDATE donation_types SET
        name = COALESCE($1, name), name_odia = COALESCE($2, name_odia),
        is_recurring = COALESCE($3, is_recurring), sort_order = COALESCE($4, sort_order),
        updated_at = NOW()
       WHERE id = $5 AND parish_id = $6 RETURNING *`,
      [name, nameOdia, isRecurring, sortOrder, req.params.id, req.user!.parishId]
    );
    await logAudit(req, 'donation_type', req.params.id, 'UPDATE', before.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Wards ───────────────────────────────────────────────────

// GET /wards
router.get('/wards', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT * FROM wards WHERE parish_id = $1 ORDER BY sort_order, ward_name',
      [req.user!.parishId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /wards (admin only)
router.post('/wards', requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    wardName: z.string().min(1).max(100),
    wardNameOdia: z.string().max(100).optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  try {
    const result = await pool.query(
      `INSERT INTO wards (parish_id, ward_name, ward_name_odia, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user!.parishId, parsed.data.wardName, parsed.data.wardNameOdia || null, parsed.data.sortOrder ?? 0]
    );
    await logAudit(req, 'ward', result.rows[0].id, 'CREATE', undefined, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /wards/:id (admin only)
router.put('/wards/:id', requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    wardName: z.string().min(1).max(100).optional(),
    wardNameOdia: z.string().max(100).optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  try {
    const before = await pool.query('SELECT * FROM wards WHERE id = $1 AND parish_id = $2', [req.params.id, req.user!.parishId]);
    if (!before.rows[0]) { res.status(404).json({ error: 'Ward not found' }); return; }

    const result = await pool.query(
      `UPDATE wards SET ward_name = COALESCE($1, ward_name), ward_name_odia = COALESCE($2, ward_name_odia),
        sort_order = COALESCE($3, sort_order), updated_at = NOW()
       WHERE id = $4 AND parish_id = $5 RETURNING *`,
      [parsed.data.wardName, parsed.data.wardNameOdia, parsed.data.sortOrder, req.params.id, req.user!.parishId]
    );
    await logAudit(req, 'ward', req.params.id, 'UPDATE', before.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Units ───────────────────────────────────────────────────

// GET /units
router.get('/units', async (req: Request, res: Response): Promise<void> => {
  try {
    const { wardId } = req.query;
    let query = 'SELECT u.*, w.ward_name FROM units u LEFT JOIN wards w ON u.ward_id = w.id WHERE u.parish_id = $1';
    const params: unknown[] = [req.user!.parishId];
    if (wardId) { query += ' AND u.ward_id = $2'; params.push(wardId); }
    query += ' ORDER BY u.sort_order, u.unit_name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /units (admin only)
router.post('/units', requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    wardId: z.string().uuid(),
    unitName: z.string().min(1).max(100),
    unitNameOdia: z.string().max(100).optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  try {
    const result = await pool.query(
      `INSERT INTO units (parish_id, ward_id, unit_name, unit_name_odia, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user!.parishId, parsed.data.wardId, parsed.data.unitName, parsed.data.unitNameOdia || null, parsed.data.sortOrder ?? 0]
    );
    await logAudit(req, 'unit', result.rows[0].id, 'CREATE', undefined, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /units/:id (admin only)
router.put('/units/:id', requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    unitName: z.string().min(1).max(100).optional(),
    unitNameOdia: z.string().max(100).optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  try {
    const before = await pool.query('SELECT * FROM units WHERE id = $1 AND parish_id = $2', [req.params.id, req.user!.parishId]);
    if (!before.rows[0]) { res.status(404).json({ error: 'Unit not found' }); return; }

    const result = await pool.query(
      `UPDATE units SET unit_name = COALESCE($1, unit_name), unit_name_odia = COALESCE($2, unit_name_odia),
        sort_order = COALESCE($3, sort_order), updated_at = NOW()
       WHERE id = $4 AND parish_id = $5 RETURNING *`,
      [parsed.data.unitName, parsed.data.unitNameOdia, parsed.data.sortOrder, req.params.id, req.user!.parishId]
    );
    await logAudit(req, 'unit', req.params.id, 'UPDATE', before.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Donation Family Info ────────────────────────────────────

// GET /family-info/:familyId
router.get('/family-info/:familyId', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT dfi.*, w.ward_name, w.ward_name_odia, u.unit_name, u.unit_name_odia
       FROM donation_family_info dfi
       LEFT JOIN wards w ON dfi.ward_id = w.id
       LEFT JOIN units u ON dfi.unit_id = u.id
       WHERE dfi.family_id = $1 AND dfi.parish_id = $2`,
      [req.params.familyId, req.user!.parishId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /family-info (create or upsert)
router.post('/family-info', requireRoles(ROLES.ADMIN, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    familyId: z.string().uuid(),
    cardNumber: z.string().max(50).optional(),
    wardId: z.string().uuid().optional().nullable(),
    unitId: z.string().uuid().optional().nullable(),
    monthlyPledge: z.number().min(0).optional(),
    phone: z.string().max(50).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  const { familyId, cardNumber, wardId, unitId, monthlyPledge, phone } = parsed.data;
  try {
    const result = await pool.query(
      `INSERT INTO donation_family_info (family_id, parish_id, card_number, ward_id, unit_id, monthly_pledge, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (family_id) DO UPDATE SET
         card_number = COALESCE(EXCLUDED.card_number, donation_family_info.card_number),
         ward_id = COALESCE(EXCLUDED.ward_id, donation_family_info.ward_id),
         unit_id = COALESCE(EXCLUDED.unit_id, donation_family_info.unit_id),
         monthly_pledge = COALESCE(EXCLUDED.monthly_pledge, donation_family_info.monthly_pledge),
         phone = COALESCE(EXCLUDED.phone, donation_family_info.phone),
         updated_at = NOW()
       RETURNING *`,
      [familyId, req.user!.parishId, cardNumber || null, wardId || null, unitId || null, monthlyPledge ?? 0, phone || null]
    );
    await logAudit(req, 'donation_family_info', result.rows[0].id, 'CREATE', undefined, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /family-info/:familyId
router.put('/family-info/:familyId', requireRoles(ROLES.ADMIN, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    cardNumber: z.string().max(50).optional(),
    wardId: z.string().uuid().optional().nullable(),
    unitId: z.string().uuid().optional().nullable(),
    monthlyPledge: z.number().min(0).optional(),
    phone: z.string().max(50).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  try {
    const before = await pool.query(
      'SELECT * FROM donation_family_info WHERE family_id = $1 AND parish_id = $2',
      [req.params.familyId, req.user!.parishId]
    );
    if (!before.rows[0]) { res.status(404).json({ error: 'Donation family info not found' }); return; }

    const { cardNumber, wardId, unitId, monthlyPledge, phone } = parsed.data;
    const result = await pool.query(
      `UPDATE donation_family_info SET
        card_number = COALESCE($1, card_number), ward_id = COALESCE($2, ward_id),
        unit_id = COALESCE($3, unit_id), monthly_pledge = COALESCE($4, monthly_pledge),
        phone = COALESCE($5, phone), updated_at = NOW()
       WHERE family_id = $6 AND parish_id = $7 RETURNING *`,
      [cardNumber, wardId, unitId, monthlyPledge, phone, req.params.familyId, req.user!.parishId]
    );
    await logAudit(req, 'donation_family_info', result.rows[0].id, 'UPDATE', before.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Donations CRUD ──────────────────────────────────────────

// GET / (list donations with filters)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { familyId, month, year, typeId, wardId, unitId, page = '1', limit = '20' } = req.query;
    const p = Math.max(1, parseInt(page as string));
    const lim = Math.min(1000, Math.max(1, parseInt(limit as string)));
    const offset = (p - 1) * lim;

    let where = 'd.parish_id = $1';
    const params: unknown[] = [req.user!.parishId];
    let idx = 2;

    if (familyId) { where += ` AND d.family_id = $${idx++}`; params.push(familyId); }
    if (month) { where += ` AND d.month = $${idx++}`; params.push(parseInt(month as string)); }
    if (year) { where += ` AND d.year = $${idx++}`; params.push(parseInt(year as string)); }
    if (typeId) { where += ` AND d.donation_type_id = $${idx++}`; params.push(typeId); }
    if (wardId) {
      where += ` AND dfi.ward_id = $${idx++}`;
      params.push(wardId);
    }
    if (unitId) {
      where += ` AND dfi.unit_id = $${idx++}`;
      params.push(unitId);
    }

    const countQ = `SELECT COUNT(*) FROM donations d
      LEFT JOIN donation_family_info dfi ON d.family_id = dfi.family_id
      WHERE ${where}`;
    const dataQ = `SELECT d.*, f.family_name, dt.name as donation_type_name, dt.name_odia as donation_type_name_odia,
        dfi.card_number, w.ward_name, u.unit_name
      FROM donations d
      JOIN families f ON d.family_id = f.id
      JOIN donation_types dt ON d.donation_type_id = dt.id
      LEFT JOIN donation_family_info dfi ON d.family_id = dfi.family_id
      LEFT JOIN wards w ON dfi.ward_id = w.id
      LEFT JOIN units u ON dfi.unit_id = u.id
      WHERE ${where}
      ORDER BY d.donation_date DESC, d.created_at DESC
      LIMIT $${idx++} OFFSET $${idx}`;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQ, params),
      pool.query(dataQ, [...params, lim, offset]),
    ]);

    res.json({ data: dataRes.rows, total: parseInt(countRes.rows[0].count), page: p });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / (record donation)
router.post('/', requireRoles(ROLES.ADMIN, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    familyId: z.string().uuid(),
    donationTypeId: z.string().uuid(),
    donationDate: z.string(),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(2100),
    amount: z.number().positive(),
    remarks: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  const { familyId, donationTypeId, donationDate, month, year, amount, remarks } = parsed.data;
  try {
    const result = await pool.query(
      `INSERT INTO donations (family_id, parish_id, donation_type_id, donation_date, month, year, amount, remarks, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [familyId, req.user!.parishId, donationTypeId, donationDate, month, year, amount, remarks || null, req.user!.userId]
    );
    await logAudit(req, 'donation', result.rows[0].id, 'CREATE', undefined, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id (update donation)
router.put('/:id', requireRoles(ROLES.ADMIN, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    donationTypeId: z.string().uuid().optional(),
    donationDate: z.string().optional(),
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(2000).max(2100).optional(),
    amount: z.number().positive().optional(),
    remarks: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  try {
    const before = await pool.query('SELECT * FROM donations WHERE id = $1 AND parish_id = $2', [req.params.id, req.user!.parishId]);
    if (!before.rows[0]) { res.status(404).json({ error: 'Donation not found' }); return; }

    const { donationTypeId, donationDate, month, year, amount, remarks } = parsed.data;
    const result = await pool.query(
      `UPDATE donations SET
        donation_type_id = COALESCE($1, donation_type_id), donation_date = COALESCE($2, donation_date),
        month = COALESCE($3, month), year = COALESCE($4, year), amount = COALESCE($5, amount),
        remarks = COALESCE($6, remarks), updated_at = NOW()
       WHERE id = $7 AND parish_id = $8 RETURNING *`,
      [donationTypeId, donationDate, month, year, amount, remarks, req.params.id, req.user!.parishId]
    );
    await logAudit(req, 'donation', req.params.id, 'UPDATE', before.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id (admin only)
router.delete('/:id', requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  try {
    const before = await pool.query('SELECT * FROM donations WHERE id = $1 AND parish_id = $2', [req.params.id, req.user!.parishId]);
    if (!before.rows[0]) { res.status(404).json({ error: 'Donation not found' }); return; }
    await pool.query('DELETE FROM donations WHERE id = $1 AND parish_id = $2', [req.params.id, req.user!.parishId]);
    await logAudit(req, 'donation', req.params.id, 'DELETE', before.rows[0], undefined);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Family Grid & Summary ───────────────────────────────────

// GET /family/:familyId/grid?year=2026
router.get('/family/:familyId/grid', async (req: Request, res: Response): Promise<void> => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const result = await pool.query(
      `SELECT d.id, d.month, d.donation_type_id, dt.name as donation_type_name, dt.name_odia as donation_type_name_odia,
              d.amount, d.donation_date, d.remarks, d.receipt_number, dt.sort_order
       FROM donations d
       JOIN donation_types dt ON d.donation_type_id = dt.id
       WHERE d.family_id = $1 AND d.parish_id = $2 AND d.year = $3
       ORDER BY d.month, dt.sort_order`,
      [req.params.familyId, req.user!.parishId, year]
    );
    res.json({ year, grid: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /family/:familyId/summary?year=2026
router.get('/family/:familyId/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const [donationRes, memberMonthsRes] = await Promise.all([
      pool.query(
        `SELECT dt.name, dt.name_odia, COALESCE(SUM(d.amount), 0) as total
         FROM donation_types dt
         LEFT JOIN donations d ON d.donation_type_id = dt.id AND d.family_id = $1 AND d.year = $3
         WHERE dt.parish_id = $2
         GROUP BY dt.id, dt.name, dt.name_odia, dt.sort_order
         ORDER BY dt.sort_order`,
        [req.params.familyId, req.user!.parishId, year]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT d.month) as member_months, COALESCE(SUM(d.amount), 0) as member_total
         FROM donation_types dt
         JOIN donations d ON d.donation_type_id = dt.id AND d.family_id = $1 AND d.year = $3
         WHERE dt.parish_id = $2 AND dt.code = 'MEMBER'`,
        [req.params.familyId, req.user!.parishId, year]
      ),
    ]);
    const grandTotal = donationRes.rows.reduce((sum: number, r: { total: string }) => sum + parseFloat(r.total), 0);
    const memberMonths = parseInt(memberMonthsRes.rows[0]?.member_months) || 0;
    const memberTotal = parseFloat(memberMonthsRes.rows[0]?.member_total) || 0;
    const monthlyRate = memberMonths > 0 ? memberTotal / memberMonths : 0;
    const annualPledge = Math.round(monthlyRate * 12 * 100) / 100;

    res.json({
      year,
      byType: donationRes.rows,
      grandTotal,
      annualPledge,
      balance: annualPledge - memberTotal,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /family/:familyId/export?year=2026
router.get('/family/:familyId/export', requireRoles(ROLES.ADMIN, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const parishId = req.user!.parishId;
    const familyId = req.params.familyId;

    const [familyRes, typesRes, donationsRes, infoRes] = await Promise.all([
      pool.query('SELECT family_name FROM families WHERE id = $1 AND parish_id = $2', [familyId, parishId]),
      pool.query('SELECT id, name FROM donation_types WHERE parish_id = $1 ORDER BY sort_order', [parishId]),
      pool.query(
        `SELECT d.month, d.donation_type_id, SUM(d.amount) as amount
         FROM donations d WHERE d.family_id = $1 AND d.parish_id = $2 AND d.year = $3
         GROUP BY d.month, d.donation_type_id`,
        [familyId, parishId, year]
      ),
      pool.query('SELECT card_number, monthly_pledge FROM donation_family_info WHERE family_id = $1 AND parish_id = $2', [familyId, parishId]),
    ]);

    if (!familyRes.rows[0]) { res.status(404).json({ error: 'Family not found' }); return; }

    const familyName = familyRes.rows[0].family_name;
    const types = typesRes.rows;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const rows = monthNames.map((mName, i) => {
      const m = i + 1;
      const row: Record<string, unknown> = { 'Sl. No.': m, Month: mName };
      let rowTotal = 0;
      for (const t of types) {
        const cell = donationsRes.rows.find((d: { month: number; donation_type_id: string }) => d.month === m && d.donation_type_id === t.id);
        const amt = cell ? parseFloat(cell.amount) : 0;
        row[t.name] = amt;
        rowTotal += amt;
      }
      row['Total'] = rowTotal;
      return row;
    });

    // Add totals row
    const totalsRow: Record<string, unknown> = { 'Sl. No.': '', Month: 'TOTAL' };
    let grandTotal = 0;
    for (const t of types) {
      const typeTotal = rows.reduce((s, r) => s + (r[t.name] as number), 0);
      totalsRow[t.name] = typeTotal;
      grandTotal += typeTotal;
    }
    totalsRow['Total'] = grandTotal;
    rows.push(totalsRow);

    const cardNumber = infoRes.rows[0]?.card_number || '';
    const pledge = infoRes.rows[0]?.monthly_pledge || 0;

    const buffer = generateExcelBuffer(rows, `${familyName} - ${year}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${familyName.replace(/\s+/g, '_')}_donations_${year}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Dashboard ───────────────────────────────────────────────

// GET /dashboard?year=2026
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const parishId = req.user!.parishId;

    const [annualRes, monthlyRes, typeRes, topRes, familyCountRes, donorCountRes, defaulterRes] = await Promise.all([
      pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM donations WHERE parish_id = $1 AND year = $2', [parishId, year]),
      pool.query(
        `SELECT month, COALESCE(SUM(amount), 0) as total
         FROM donations WHERE parish_id = $1 AND year = $2
         GROUP BY month ORDER BY month`,
        [parishId, year]
      ),
      pool.query(
        `SELECT dt.name, dt.name_odia, COALESCE(SUM(d.amount), 0) as total
         FROM donation_types dt
         LEFT JOIN donations d ON d.donation_type_id = dt.id AND d.year = $2 AND d.parish_id = $1
         WHERE dt.parish_id = $1
         GROUP BY dt.id, dt.name, dt.name_odia, dt.sort_order ORDER BY dt.sort_order`,
        [parishId, year]
      ),
      pool.query(
        `SELECT f.id as family_id, f.family_name, COALESCE(SUM(d.amount), 0) as total
         FROM families f JOIN donations d ON d.family_id = f.id
         WHERE d.parish_id = $1 AND d.year = $2
         GROUP BY f.id ORDER BY total DESC LIMIT 10`,
        [parishId, year]
      ),
      pool.query('SELECT COUNT(*) FROM families WHERE parish_id = $1 AND status = $2', [parishId, 'active']),
      pool.query(
        'SELECT COUNT(DISTINCT family_id) FROM donations WHERE parish_id = $1 AND year = $2',
        [parishId, year]
      ),
      pool.query(
        `SELECT COUNT(*) FROM donation_family_info dfi
         LEFT JOIN (SELECT family_id, SUM(amount) as total FROM donations WHERE parish_id = $1 AND year = $2 GROUP BY family_id) d
           ON dfi.family_id = d.family_id
         WHERE dfi.parish_id = $1 AND dfi.monthly_pledge > 0
           AND COALESCE(d.total, 0) < (dfi.monthly_pledge * EXTRACT(MONTH FROM CURRENT_DATE))`,
        [parishId, year]
      ),
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyMap = new Map(monthlyRes.rows.map((r: { month: number; total: string }) => [r.month, parseFloat(r.total)]));
    const monthlyTotals = monthNames.map((name, i) => ({
      month: i + 1, monthName: name, total: monthlyMap.get(i + 1) || 0,
    }));

    res.json({
      year,
      annualTotal: parseFloat(annualRes.rows[0].total),
      monthlyTotals,
      typeBreakdown: typeRes.rows.map((r: { name: string; name_odia: string; total: string }) => ({
        name: r.name, nameOdia: r.name_odia, total: parseFloat(r.total),
      })),
      topDonors: topRes.rows.map((r: { family_id: string; family_name: string; total: string }) => ({
        familyId: r.family_id, familyName: r.family_name, total: parseFloat(r.total),
      })),
      totalFamilies: parseInt(familyCountRes.rows[0].count),
      activeDonors: parseInt(donorCountRes.rows[0].count),
      defaulterCount: parseInt(defaulterRes.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Register ────────────────────────────────────────────────

// GET /register (monthly detail register)
router.get('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year, page = '1', limit = '50' } = req.query;
    const p = Math.max(1, parseInt(page as string));
    const lim = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (p - 1) * lim;

    let where = 'd.parish_id = $1';
    const params: unknown[] = [req.user!.parishId];
    let idx = 2;
    if (month) { where += ` AND d.month = $${idx++}`; params.push(parseInt(month as string)); }
    if (year) { where += ` AND d.year = $${idx++}`; params.push(parseInt(year as string)); }

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM donations d WHERE ${where}`, params),
      pool.query(
        `SELECT d.*, f.family_name, dt.name as donation_type_name, dt.name_odia as donation_type_name_odia,
                dfi.card_number
         FROM donations d
         JOIN families f ON d.family_id = f.id
         JOIN donation_types dt ON d.donation_type_id = dt.id
         LEFT JOIN donation_family_info dfi ON d.family_id = dfi.family_id
         WHERE ${where}
         ORDER BY d.donation_date DESC
         LIMIT $${idx++} OFFSET $${idx}`,
        [...params, lim, offset]
      ),
    ]);

    res.json({ data: dataRes.rows, total: parseInt(countRes.rows[0].count), page: p });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /register/export
router.get('/register/export', requireRoles(ROLES.ADMIN, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query;
    let where = 'd.parish_id = $1';
    const params: unknown[] = [req.user!.parishId];
    let idx = 2;
    if (month) { where += ` AND d.month = $${idx++}`; params.push(parseInt(month as string)); }
    if (year) { where += ` AND d.year = $${idx++}`; params.push(parseInt(year as string)); }

    const result = await pool.query(
      `SELECT d.donation_date as "Date", f.family_name as "Family Name", dfi.card_number as "Card No",
              dt.name as "Donation Type", d.amount as "Amount", d.receipt_number as "Receipt No", d.remarks as "Remarks"
       FROM donations d
       JOIN families f ON d.family_id = f.id
       JOIN donation_types dt ON d.donation_type_id = dt.id
       LEFT JOIN donation_family_info dfi ON d.family_id = dfi.family_id
       WHERE ${where}
       ORDER BY d.donation_date`,
      params
    );

    const buffer = generateExcelBuffer(result.rows, 'Register');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=register-${year || 'all'}-${month || 'all'}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Receipts ────────────────────────────────────────────────

// GET /receipts
router.get('/receipts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { familyId, page = '1', limit = '20' } = req.query;
    const p = Math.max(1, parseInt(page as string));
    const lim = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (p - 1) * lim;

    let where = 'r.parish_id = $1';
    const params: unknown[] = [req.user!.parishId];
    let idx = 2;
    if (familyId) { where += ` AND r.family_id = $${idx++}`; params.push(familyId); }

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM donation_receipts r WHERE ${where}`, params),
      pool.query(
        `SELECT r.*, f.family_name
         FROM donation_receipts r
         JOIN families f ON r.family_id = f.id
         WHERE ${where}
         ORDER BY r.created_at DESC
         LIMIT $${idx++} OFFSET $${idx}`,
        [...params, lim, offset]
      ),
    ]);

    res.json({ data: dataRes.rows, total: parseInt(countRes.rows[0].count), page: p });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /receipts (generate receipt)
router.post('/receipts', requireRoles(ROLES.ADMIN, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    donationId: z.string().uuid().optional(),
    familyId: z.string().uuid(),
    amount: z.number().positive(),
    dateIssued: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  const { donationId, familyId, amount, dateIssued } = parsed.data;
  try {
    const yr = new Date(dateIssued).getFullYear();
    const nextNum = await pool.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM '[0-9]+$') AS INT)), 0) + 1 as next_num
       FROM donation_receipts WHERE parish_id = $1 AND EXTRACT(YEAR FROM date_issued) = $2`,
      [req.user!.parishId, yr]
    );
    const receiptNumber = `RCP-${yr}-${String(nextNum.rows[0].next_num).padStart(4, '0')}`;

    const result = await pool.query(
      `INSERT INTO donation_receipts (receipt_number, donation_id, family_id, parish_id, amount,
        amount_in_words_odia, amount_in_words_english, date_issued, issued_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [receiptNumber, donationId || null, familyId, req.user!.parishId, amount,
       numberToWordsOdia(amount), numberToWordsEnglish(amount), dateIssued, req.user!.userId]
    );

    if (donationId) {
      await pool.query('UPDATE donations SET receipt_number = $1 WHERE id = $2', [receiptNumber, donationId]);
    }

    await logAudit(req, 'donation_receipt', result.rows[0].id, 'CREATE', undefined, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /receipts/:id
router.get('/receipts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT r.*, f.family_name, p.name as parish_name, p.address as parish_address, p.logo_path
       FROM donation_receipts r
       JOIN families f ON r.family_id = f.id
       JOIN parishes p ON r.parish_id = p.id
       WHERE r.id = $1 AND r.parish_id = $2`,
      [req.params.id, req.user!.parishId]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Receipt not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /receipts/:id/pdf
router.get('/receipts/:id/pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT r.*, f.family_name, dfi.card_number, p.name as parish_name, p.address as parish_address, p.logo_path
       FROM donation_receipts r
       JOIN families f ON r.family_id = f.id
       JOIN parishes p ON r.parish_id = p.id
       LEFT JOIN donation_family_info dfi ON r.family_id = dfi.family_id
       WHERE r.id = $1 AND r.parish_id = $2`,
      [req.params.id, req.user!.parishId]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Receipt not found' }); return; }

    const r = result.rows[0];
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Oriya:wght@400;700&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Noto Sans Oriya', sans-serif; max-width: 600px; margin: 20px auto; padding: 20px; border: 2px solid #800020; }
  .header { text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 10px; margin-bottom: 20px; }
  .header h1 { color: #800020; margin: 0; font-size: 18px; }
  .header h2 { color: #333; margin: 5px 0; font-size: 14px; }
  .field { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dotted #ccc; }
  .label { font-weight: bold; color: #800020; }
  .amount-words { background: #FFF8DC; padding: 10px; margin: 10px 0; border-radius: 4px; }
  .footer { text-align: right; margin-top: 40px; }
</style></head><body>
  <div class="header">
    <h1>${r.parish_name || 'Parish'}</h1>
    <h2>${r.parish_address || ''}</h2>
    <h2>ରସିଦ / RECEIPT</h2>
  </div>
  <div class="field"><span class="label">ରସିଦ ନମ୍ବର / Receipt No:</span><span>${r.receipt_number}</span></div>
  <div class="field"><span class="label">ତାରିଖ / Date:</span><span>${new Date(r.date_issued).toLocaleDateString('en-IN')}</span></div>
  <div class="field"><span class="label">ପରିବାର / Family:</span><span>${r.family_name}</span></div>
  ${r.card_number ? `<div class="field"><span class="label">କାର୍ଡ ନଂ / Card No:</span><span>${r.card_number}</span></div>` : ''}
  <div class="field"><span class="label">ପରିମାଣ / Amount:</span><span style="font-size:18px;font-weight:bold">₹${parseFloat(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
  <div class="amount-words">
    <div><strong>ଓଡ଼ିଆରେ:</strong> ${r.amount_in_words_odia}</div>
    <div><strong>In Words:</strong> ${r.amount_in_words_english}</div>
  </div>
  <div class="footer">
    <p>________________</p>
    <p>ସ୍ୱାକ୍ଷର / Signature</p>
  </div>
</body></html>`;

    const dir = await ensureCertDir();
    const filePath = `${dir}/receipt-${r.receipt_number}.pdf`;
    await generatePDF(html, filePath);

    res.download(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Reports ─────────────────────────────────────────────────

// GET /reports/ward-collection?year=2026
router.get('/reports/ward-collection', async (req: Request, res: Response): Promise<void> => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const result = await pool.query(
      `SELECT w.ward_name, w.ward_name_odia, u.unit_name, u.unit_name_odia,
              COALESCE(SUM(d.amount), 0) as total, COUNT(DISTINCT d.family_id) as families
       FROM wards w
       LEFT JOIN units u ON u.ward_id = w.id
       LEFT JOIN donation_family_info dfi ON dfi.ward_id = w.id AND (u.id IS NULL OR dfi.unit_id = u.id)
       LEFT JOIN donations d ON d.family_id = dfi.family_id AND d.year = $2
       WHERE w.parish_id = $1
       GROUP BY w.id, w.ward_name, w.ward_name_odia, w.sort_order, u.id, u.unit_name, u.unit_name_odia, u.sort_order
       ORDER BY w.sort_order, u.sort_order`,
      [req.user!.parishId, year]
    );
    res.json({ year, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reports/family-summary?year=2026
router.get('/reports/family-summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const result = await pool.query(
      `SELECT f.id, f.family_name, dfi.card_number, dfi.monthly_pledge,
              w.ward_name, u.unit_name,
              COALESCE(SUM(d.amount), 0) as ytd_total
       FROM families f
       LEFT JOIN donation_family_info dfi ON dfi.family_id = f.id
       LEFT JOIN wards w ON dfi.ward_id = w.id
       LEFT JOIN units u ON dfi.unit_id = u.id
       LEFT JOIN donations d ON d.family_id = f.id AND d.year = $2
       WHERE f.parish_id = $1 AND f.status = 'active'
       GROUP BY f.id, dfi.card_number, dfi.monthly_pledge, w.ward_name, u.unit_name
       ORDER BY f.family_name`,
      [req.user!.parishId, year]
    );
    res.json({ year, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reports/defaulters?year=2026
router.get('/reports/defaulters', async (req: Request, res: Response): Promise<void> => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const result = await pool.query(
      `SELECT f.id, f.family_name, dfi.card_number, dfi.monthly_pledge, dfi.phone,
              w.ward_name, u.unit_name,
              COALESCE(d_sum.total, 0) as ytd_total,
              (dfi.monthly_pledge * $3) as expected_ytd,
              (dfi.monthly_pledge * $3) - COALESCE(d_sum.total, 0) as balance_due
       FROM donation_family_info dfi
       JOIN families f ON dfi.family_id = f.id
       LEFT JOIN wards w ON dfi.ward_id = w.id
       LEFT JOIN units u ON dfi.unit_id = u.id
       LEFT JOIN (
         SELECT family_id, SUM(amount) as total FROM donations WHERE parish_id = $1 AND year = $2 GROUP BY family_id
       ) d_sum ON dfi.family_id = d_sum.family_id
       WHERE dfi.parish_id = $1 AND dfi.monthly_pledge > 0
         AND COALESCE(d_sum.total, 0) < (dfi.monthly_pledge * $3)
       ORDER BY (dfi.monthly_pledge * $3 - COALESCE(d_sum.total, 0)) DESC`,
      [req.user!.parishId, year, currentMonth]
    );
    res.json({ year, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reports/festival-collection?year=2026
router.get('/reports/festival-collection', async (req: Request, res: Response): Promise<void> => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const result = await pool.query(
      `SELECT d.month, f.family_name, dfi.card_number, d.amount, d.donation_date, d.remarks
       FROM donations d
       JOIN families f ON d.family_id = f.id
       JOIN donation_types dt ON d.donation_type_id = dt.id
       LEFT JOIN donation_family_info dfi ON d.family_id = dfi.family_id
       WHERE d.parish_id = $1 AND d.year = $2 AND dt.code = 'FESTIVAL'
       ORDER BY d.donation_date`,
      [req.user!.parishId, year]
    );

    const totalRes = await pool.query(
      `SELECT COALESCE(SUM(d.amount), 0) as total
       FROM donations d JOIN donation_types dt ON d.donation_type_id = dt.id
       WHERE d.parish_id = $1 AND d.year = $2 AND dt.code = 'FESTIVAL'`,
      [req.user!.parishId, year]
    );

    res.json({ year, data: result.rows, total: parseFloat(totalRes.rows[0].total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reports/year-comparison?year1=2025&year2=2026
router.get('/reports/year-comparison', async (req: Request, res: Response): Promise<void> => {
  try {
    const year1 = parseInt(req.query.year1 as string) || new Date().getFullYear() - 1;
    const year2 = parseInt(req.query.year2 as string) || new Date().getFullYear();

    const result = await pool.query(
      `SELECT month,
              SUM(CASE WHEN year = $2 THEN amount ELSE 0 END) as year1_total,
              SUM(CASE WHEN year = $3 THEN amount ELSE 0 END) as year2_total
       FROM donations WHERE parish_id = $1 AND year IN ($2, $3)
       GROUP BY month ORDER BY month`,
      [req.user!.parishId, year1, year2]
    );

    res.json({ year1, year2, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reports/export?type=family-summary&year=2026
router.get('/reports/export', requireRoles(ROLES.ADMIN, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, year: yearStr } = req.query;
    const year = parseInt(yearStr as string) || new Date().getFullYear();
    let data: Record<string, unknown>[] = [];
    let sheetName = 'Report';

    if (type === 'family-summary') {
      const result = await pool.query(
        `SELECT f.family_name as "Family Name", dfi.card_number as "Card No",
                w.ward_name as "Ward", u.unit_name as "Unit",
                dfi.monthly_pledge as "Monthly Pledge", COALESCE(SUM(d.amount), 0) as "YTD Total"
         FROM families f
         LEFT JOIN donation_family_info dfi ON dfi.family_id = f.id
         LEFT JOIN wards w ON dfi.ward_id = w.id LEFT JOIN units u ON dfi.unit_id = u.id
         LEFT JOIN donations d ON d.family_id = f.id AND d.year = $2
         WHERE f.parish_id = $1 AND f.status = 'active'
         GROUP BY f.id, dfi.card_number, dfi.monthly_pledge, w.ward_name, u.unit_name ORDER BY f.family_name`,
        [req.user!.parishId, year]
      );
      data = result.rows;
      sheetName = 'Family Summary';
    } else if (type === 'defaulters') {
      const currentMonth = new Date().getMonth() + 1;
      const result = await pool.query(
        `SELECT f.family_name as "Family Name", dfi.card_number as "Card No", dfi.phone as "Phone",
                w.ward_name as "Ward", dfi.monthly_pledge as "Monthly Pledge",
                COALESCE(d_sum.total, 0) as "YTD Paid",
                (dfi.monthly_pledge * $3) - COALESCE(d_sum.total, 0) as "Balance Due"
         FROM donation_family_info dfi
         JOIN families f ON dfi.family_id = f.id
         LEFT JOIN wards w ON dfi.ward_id = w.id
         LEFT JOIN (SELECT family_id, SUM(amount) as total FROM donations WHERE parish_id = $1 AND year = $2 GROUP BY family_id) d_sum
           ON dfi.family_id = d_sum.family_id
         WHERE dfi.parish_id = $1 AND dfi.monthly_pledge > 0
           AND COALESCE(d_sum.total, 0) < (dfi.monthly_pledge * $3)
         ORDER BY (dfi.monthly_pledge * $3 - COALESCE(d_sum.total, 0)) DESC`,
        [req.user!.parishId, year, currentMonth]
      );
      data = result.rows;
      sheetName = 'Defaulters';
    } else if (type === 'ward-collection') {
      const result = await pool.query(
        `SELECT w.ward_name as "Ward", u.unit_name as "Unit",
                COALESCE(SUM(d.amount), 0) as "Total", COUNT(DISTINCT d.family_id) as "Families"
         FROM wards w LEFT JOIN units u ON u.ward_id = w.id
         LEFT JOIN donation_family_info dfi ON dfi.ward_id = w.id AND (u.id IS NULL OR dfi.unit_id = u.id)
         LEFT JOIN donations d ON d.family_id = dfi.family_id AND d.year = $2
         WHERE w.parish_id = $1
         GROUP BY w.id, w.ward_name, w.sort_order, u.id, u.unit_name, u.sort_order
         ORDER BY w.sort_order, u.sort_order`,
        [req.user!.parishId, year]
      );
      data = result.rows;
      sheetName = 'Ward Collection';
    } else if (type === 'festival-collection') {
      const festType = await pool.query(
        `SELECT id FROM donation_types WHERE parish_id = $1 AND code = 'FESTIVAL'`,
        [req.user!.parishId]
      );
      if (festType.rows.length > 0) {
        const result = await pool.query(
          `SELECT d.donation_date as "Date", f.family_name as "Family Name",
                  dfi.card_number as "Card No", d.amount as "Amount", d.remarks as "Remarks"
           FROM donations d
           JOIN families f ON d.family_id = f.id
           LEFT JOIN donation_family_info dfi ON dfi.family_id = f.id
           WHERE d.parish_id = $1 AND d.year = $2 AND d.donation_type_id = $3
           ORDER BY d.donation_date`,
          [req.user!.parishId, year, festType.rows[0].id]
        );
        data = result.rows;
      }
      sheetName = 'Festival Collection';
    } else if (type === 'peters-pence') {
      const ppType = await pool.query(
        `SELECT id FROM donation_types WHERE parish_id = $1 AND code = 'PETERS_PENCE'`,
        [req.user!.parishId]
      );
      if (ppType.rows.length > 0) {
        const result = await pool.query(
          `SELECT d.donation_date as "Date", f.family_name as "Family Name",
                  dfi.card_number as "Card No", d.amount as "Amount", d.remarks as "Remarks"
           FROM donations d
           JOIN families f ON d.family_id = f.id
           LEFT JOIN donation_family_info dfi ON dfi.family_id = f.id
           WHERE d.parish_id = $1 AND d.year = $2 AND d.donation_type_id = $3
           ORDER BY d.donation_date`,
          [req.user!.parishId, year, ppType.rows[0].id]
        );
        data = result.rows;
      }
      sheetName = "Peter's Pence";
    } else {
      res.status(400).json({ error: 'Invalid report type' });
      return;
    }

    const buffer = generateExcelBuffer(data, sheetName);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-${year}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Seed default donation types ─────────────────────────────

// POST /seed-types (admin only — one-time setup)
router.post('/seed-types', requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  try {
    const defaults = [
      { code: 'MEMBER', name: 'Member Donation', name_odia: null, is_recurring: true, sort_order: 1 },
      { code: 'SPECIAL', name: 'Special Donation', name_odia: null, is_recurring: false, sort_order: 2 },
      { code: 'FESTIVAL', name: 'Festival Donation', name_odia: null, is_recurring: false, sort_order: 3 },
      { code: 'OTHER', name: 'Others', name_odia: null, is_recurring: false, sort_order: 4 },
      { code: 'PETERS_PENCE', name: "Peter's Pence (Holy Father's Offering)", name_odia: null, is_recurring: false, sort_order: 5 },
    ];

    for (const dt of defaults) {
      await pool.query(
        `INSERT INTO donation_types (parish_id, code, name, name_odia, is_recurring, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (parish_id, code) DO NOTHING`,
        [req.user!.parishId, dt.code, dt.name, dt.name_odia, dt.is_recurring, dt.sort_order]
      );
    }
    const result = await pool.query('SELECT * FROM donation_types WHERE parish_id = $1 ORDER BY sort_order', [req.user!.parishId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
