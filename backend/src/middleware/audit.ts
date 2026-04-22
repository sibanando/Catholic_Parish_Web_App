import { Request } from 'express';
import pool from '../db/pool';

export async function logAudit(
  req: Request,
  entityType: string,
  entityId: string | null,
  action: string,
  before?: object,
  after?: object
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, entity_type, entity_id, action, before_snapshot, after_snapshot, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user?.userId ?? null,
        entityType,
        entityId,
        action,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        req.ip,
      ]
    );
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}
