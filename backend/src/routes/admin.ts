import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import pool from '../db/pool';
import { authenticate } from '../middleware/auth';
import { requireRoles, ROLES } from '../middleware/rbac';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();
router.use(authenticate);

// GET /admin/audit-log
router.get('/audit-log', requireRoles(ROLES.ADMIN, ROLES.AUDITOR), async (req: Request, res: Response): Promise<void> => {
  const { entityType, action, userId, page = '1', limit = '50' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (entityType) { conditions.push(`entity_type = $${idx++}`); params.push(entityType); }
  if (action) { conditions.push(`action = $${idx++}`); params.push(action); }
  if (userId) { conditions.push(`user_id = $${idx++}`); params.push(userId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const result = await pool.query(
      `SELECT al.*, u.email, u.first_name, u.last_name
       FROM audit_log al
       LEFT JOIN users u ON al.user_id = u.id
       ${where}
       ORDER BY al.timestamp DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit as string), offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM audit_log ${where}`, params);
    res.json({ data: result.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page as string) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/reports
router.get('/reports', requireRoles(ROLES.ADMIN, ROLES.AUDITOR, ROLES.CLERK), async (req: Request, res: Response): Promise<void> => {
  const { period = 'monthly' } = req.query;
  const parishId = req.user!.parishId;

  try {
    const [sacramentsPerType, pending, recentCertificates, summary] = await Promise.all([
      pool.query(
        `SELECT st.name, st.code, COUNT(s.id) as count
         FROM sacrament_types st
         LEFT JOIN sacraments s ON s.sacrament_type_id = st.id AND s.parish_id = $1
           AND s.date >= NOW() - INTERVAL '1 ${period === 'weekly' ? 'week' : period === 'yearly' ? 'year' : 'month'}'
         GROUP BY st.id
         ORDER BY st.sequence_order`,
        [parishId]
      ),
      pool.query(
        `SELECT p.first_name, p.last_name, st.name as sacrament_name
         FROM people p
         JOIN families f ON p.primary_family_id = f.id
         JOIN sacrament_types st ON st.code IN ('EUCHARIST', 'CONFIRMATION')
         WHERE f.parish_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM sacraments s
             WHERE s.person_id = p.id AND s.sacrament_type_id = st.id AND s.status = 'completed'
           )
           AND EXTRACT(YEAR FROM AGE(p.dob)) BETWEEN 6 AND 18
         LIMIT 20`,
        [parishId]
      ),
      pool.query(
        `SELECT c.generated_at, p.first_name, p.last_name, st.name as sacrament_name, u.email as generated_by
         FROM certificates c
         JOIN sacraments s ON c.sacrament_id = s.id
         JOIN sacrament_types st ON s.sacrament_type_id = st.id
         JOIN people p ON s.person_id = p.id
         LEFT JOIN users u ON c.generated_by_user_id = u.id
         WHERE s.parish_id = $1
         ORDER BY c.generated_at DESC
         LIMIT 10`,
        [parishId]
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM families WHERE parish_id = $1 AND status = 'active') as total_families,
           (SELECT COUNT(*) FROM people p JOIN families f ON p.primary_family_id = f.id WHERE f.parish_id = $1) as total_people,
           (SELECT COUNT(*) FROM sacraments WHERE parish_id = $1 AND status = 'completed') as total_sacraments,
           (SELECT COUNT(*) FROM certificates c JOIN sacraments s ON c.sacrament_id = s.id WHERE s.parish_id = $1) as total_certificates,
           (SELECT COUNT(*) FROM certificate_requests cr JOIN sacrament_types st ON cr.sacrament_type_id = st.id WHERE cr.status = 'pending') as pending_requests`,
        [parishId]
      ),
    ]);

    res.json({
      summary: summary.rows[0],
      sacramentsPerType: sacramentsPerType.rows,
      pendingFirstCommunionConfirmation: pending.rows,
      recentCertificates: recentCertificates.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/parish-logo — upload logo (stored as base64 in DB)
router.post('/parish-logo', requireRoles(ROLES.ADMIN), upload.single('logo'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
  if (!req.file.mimetype.startsWith('image/')) { res.status(400).json({ error: 'Only image files are allowed' }); return; }
  try {
    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await pool.query('UPDATE parishes SET logo_path = $1, updated_at = NOW() WHERE id = $2', [base64, req.user!.parishId]);
    res.json({ logoPath: base64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/parish-settings — all authenticated users can view (for logo in sidebar etc.)
router.get('/parish-settings', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM parishes WHERE id = $1', [req.user!.parishId]);
    if (!result.rows[0]) { res.status(404).json({ error: 'Parish not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /admin/parish-settings
router.put('/parish-settings', requireRoles(ROLES.ADMIN), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    address: z.string().optional(),
    diocese: z.string().optional(),
    contactInfo: z.record(z.string()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() }); return; }

  const { name, address, diocese, contactInfo } = parsed.data;
  try {
    const result = await pool.query(
      `UPDATE parishes SET
         name = COALESCE($1, name),
         address = COALESCE($2, address),
         diocese = COALESCE($3, diocese),
         contact_info = COALESCE($4, contact_info),
         updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, address, diocese, contactInfo ? JSON.stringify(contactInfo) : null, req.user!.parishId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
