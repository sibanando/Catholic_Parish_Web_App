# CLAUDE.md — Catholic Parish Web App

## Project Overview

Full-stack parish management system for Catholic churches. Manages families, sacramental records, certificate generation (PDF + QR), and audit logging. Multi-tenant (one DB, parish-scoped via `parish_id`).

**Stack:** React 18 + TypeScript + Vite + TailwindCSS (frontend) · Express + TypeScript + PostgreSQL + Zod + JWT (backend) · Puppeteer/Chromium (PDF) · Docker + Docker Compose + Kubernetes

**Live deployment:** Azure VM at `20.115.96.153`, running via Docker Compose (production-only, no dev overlay).

---

## Key Commands

### Development (local, no Docker)
```bash
npm run install:all       # install all deps
npm run dev               # start both servers concurrently
npm run dev:backend       # backend only  → http://localhost:4000
npm run dev:frontend      # frontend only → http://localhost:5173
```

### Production (Docker Compose)
```bash
# First time only — copy and edit env file
cp .env.example .env      # or create .env manually (see below)

# Build and start
docker compose -f docker-compose.yml up --build -d

# View logs
docker compose -f docker-compose.yml logs -f

# Stop
docker compose -f docker-compose.yml down
```

> **Do NOT use the dev overlay (`docker-compose.dev.yml`) for production.**
> The dev overlay mounts source files and overrides CMD to `npm run dev`,
> which requires `ts-node-dev` (a devDependency not installed in the production image).

### Database
```bash
# Run schema
psql -U postgres -d parish_db -f backend/src/db/schema.sql

# Seed demo data
cd backend && npm run db:seed

# Backup (Docker)
docker exec parish-postgres pg_dump -U postgres parish_db | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Build TypeScript
```bash
cd backend && npm run build    # outputs to backend/dist/
cd frontend && npm run build   # outputs to frontend/dist/
```

---

## Environment Variables

Create `.env` in the project root (gitignored):

```env
POSTGRES_PASSWORD=parish1234
JWT_SECRET=<min 32 chars>
JWT_REFRESH_SECRET=<min 32 chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost
APP_PORT=80
DATABASE_SSL=false          # set to true only for cloud-managed DBs (RDS, Azure DB)
```

`DATABASE_SSL=false` is **required** when running the bundled postgres container — the container does not have SSL configured. Only set `true` when connecting to an external DB that enforces SSL.

---

## Architecture

```
Browser → [nginx :80] → static files (React SPA)
                     → /api/* proxy → [Express :4000] → [PostgreSQL :5432]
                     → /health proxy → [Express :4000]
```

- nginx uses the template at `frontend/nginx.conf.template` — the `${BACKEND_HOST}` variable is substituted at container startup (Docker's built-in template mechanism via `/etc/nginx/templates/`).
- Default `BACKEND_HOST=backend` (matches the Docker Compose service name / Kubernetes service name).
- Express has `app.set('trust proxy', 1)` so rate-limiter sees real client IPs through nginx.

### Multi-tenancy

Every query is scoped by `req.user!.parishId`. The `audit_log` table has no `parish_id` column — parish scoping is done via `JOIN users u ON al.user_id = u.id AND u.parish_id = $1`.

### RBAC roles

| Role | DB value |
|---|---|
| Parish Admin | `parish_admin` |
| Sacramental Clerk | `sacramental_clerk` |
| Priest | `priest` |
| Auditor | `auditor` |
| Parishioner | `parishioner` |

---

## Demo Accounts (seeded)

| Email | Password | Role |
|---|---|---|
| admin@stmarys.org | Admin@1234 | Parish Admin |
| clerk@stmarys.org | Clerk@1234 | Sacramental Clerk |
| priest@stmarys.org | Priest@1234 | Priest |
| audit@xyz.com | (see seed.ts) | Auditor |

---

## Known Fixes Applied

### People not appearing after creation
- `GET /api/people` now checks both `family_memberships` and `primary_family_id` for parish scoping.
- `POST /api/people` now inserts a row into `family_memberships` when `primaryFamilyId` is provided.
- People page create modal has a family picker — users must assign a family for the person to appear in the list.

### Audit log cross-parish data leak
- Fixed by using `INNER JOIN users ON ... AND u.parish_id = $1` instead of a bare `LEFT JOIN` with no parish filter.

### Donations ward collection
- `d.parish_id = $1` added to the donations join in both `/reports/ward-collection` and the export endpoint.
- Defaulters `currentMonth` now uses `year < currentYear ? 12 : currentMonth` so past-year reports show all 12 months.

### SSL error on login (production)
- `pool.ts` previously forced SSL in `NODE_ENV=production`. Changed to check `DATABASE_SSL=true` explicitly.
- The bundled postgres container has no SSL — set `DATABASE_SSL=false` in `.env`.

### Port 80 conflict (Azure VM)
- System nginx (`/etc/nginx/sites-enabled/default`) was occupying port 80.
- Stopped and disabled it: `sudo systemctl stop nginx && sudo systemctl disable nginx`.
- Docker Compose frontend container now owns port 80.

### Rate limiter trust proxy warning
- Added `app.set('trust proxy', 1)` in `backend/src/index.ts` so express-rate-limit correctly reads `X-Forwarded-For` set by nginx.

---

## File Structure (key files)

```
├── backend/src/
│   ├── index.ts              # Express app — trust proxy, rate limiter, routes
│   ├── db/
│   │   ├── pool.ts           # PG pool — DATABASE_SSL controls SSL
│   │   ├── schema.sql        # 16-table schema
│   │   └── seed.ts           # Demo data
│   ├── middleware/
│   │   ├── auth.ts           # JWT verify
│   │   ├── rbac.ts           # requireRoles()
│   │   └── audit.ts          # append-only audit log writer
│   └── routes/
│       ├── auth.ts           # login, refresh, user management
│       ├── families.ts       # family CRUD + members
│       ├── people.ts         # person CRUD + search
│       ├── sacraments.ts     # sacrament records
│       ├── certificates.ts   # PDF generation + request queue
│       ├── donations.ts      # ward/unit donations + reports
│       └── admin.ts          # audit log, reports, parish settings
│
├── frontend/src/
│   ├── api/client.ts         # Axios with auto-refresh interceptor
│   ├── contexts/AuthContext.tsx
│   ├── components/Layout.tsx # Sidebar with Latin cross icon
│   └── pages/
│       ├── Login.tsx
│       ├── Dashboard.tsx
│       ├── Families.tsx / FamilyDetail.tsx
│       ├── People.tsx / PersonDetail.tsx
│       ├── Sacraments.tsx
│       ├── Certificates.tsx
│       ├── Donations.tsx
│       └── Admin.tsx
│
├── frontend/nginx.conf.template   # nginx with ${BACKEND_HOST} substitution
├── docker-compose.yml             # production stack
├── docker-compose.dev.yml         # dev overlay (source mounts + dev servers)
├── k8s/                           # Kubernetes manifests
└── Makefile                       # build/push/deploy shortcuts
```
