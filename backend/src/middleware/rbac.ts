import { Request, Response, NextFunction } from 'express';

export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    const hasRole = req.user.roles.some(r => allowedRoles.includes(r));
    if (!hasRole) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export const ROLES = {
  ADMIN: 'parish_admin',
  CLERK: 'sacramental_clerk',
  PRIEST: 'priest',
  AUDITOR: 'auditor',
  PARISHIONER: 'parishioner',
} as const;
