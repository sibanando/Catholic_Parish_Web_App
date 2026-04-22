# Catholic Parish Web App — System Architecture

## Overview

A full-stack web application for managing parish sacramental records, family cards, and certificate generation. Built with React + Vite on the frontend, Express + TypeScript on the backend, and PostgreSQL for data storage.

---

## Architecture Diagram

```
+------------------------------------------+       +------------------------------------------+
|       FRONTEND (React + Vite)            |       |       BACKEND (Express + TypeScript)      |
|       Port: 5173 (dev) / 80 (prod)      |       |       Port: 4000                         |
|                                          |       |                                          |
|  +------------+  +-------------+         |       |  +--------------------------------------+|
|  |   Login    |  |  Dashboard  |         |       |  |  Helmet / CORS / Rate Limiter        ||
|  +------------+  +-------------+         |       |  +--------------------------------------+|
|  +------------+  +-------------+         |       |  +----------------+  +-----------------+ |
|  |  Families  |  |   People    |         | REST  |  |   JWT Auth     |  |     RBAC        | |
|  +------------+  +-------------+         | API   |  +----------------+  +-----------------+ |
|  +------------+  +-------------+         |------>|  +----------------+  +-----------------+ |
|  | Sacraments |  | Certificates|         |       |  | /api/auth      |  | /api/families   | |
|  +------------+  +-------------+         |       |  +----------------+  +-----------------+ |
|  +------------+  +-------------+         |       |  +----------------+  +-----------------+ |
|  |   Admin    |  |   Verify    |         |       |  | /api/people    |  | /api/sacraments | |
|  +------------+  +-------------+         |       |  +----------------+  +-----------------+ |
|                                          |       |  +----------------+  +-----------------+ |
|  +------------------------------------+  |       |  | /api/certs     |  | /api/admin      | |
|  | AuthContext + ProtectedRoute (RBAC)|  |       |  +----------------+  +-----------------+ |
|  +------------------------------------+  |       |  +--------------------------------------+|
+------------------------------------------+       |  |  Audit Logger (immutable log)         ||
                                                   |  +--------------------------------------+|
                                                   +---------------------|--------------------+
                                                                         |
                                                                         | pg pool
                                                                         v
+------------------------------------------+       +------------------------------------------+
|       UTILS / SERVICES                   |       |       DATA LAYER (PostgreSQL 16)         |
|                                          |       |       Port: 5432 (Docker)                |
|  +----------------+  +--------------+    |       |                                          |
|  | PDF Generation |  |   QR Code    |    |       |  parishes  families  people  sacraments  |
|  | (Puppeteer)    |  |  (qrcode)    |    |       |  certificates  users  roles  audit_log   |
|  +----------------+  +--------------+    |       |  marriages  holy_orders  sponsors         |
+------------------------------------------+       |  certificate_templates  cert_requests     |
                                                   +------------------------------------------+
+-----------------------------------------------------------------------------+
|       INFRASTRUCTURE                                                        |
|                                                                             |
|  Dev:   Docker Compose (PostgreSQL + Backend + Frontend)                     |
|  Prod:  PostgreSQL (systemd) + PM2 (backend) + Nginx (frontend)             |
+-----------------------------------------------------------------------------+
```

---

## Frontend (React + Vite)

**Port:** 5173 (dev) / 80 via Nginx (prod)

### Pages

| Page | Route | Access |
|------|-------|--------|
| Login | `/login` | Public |
| Verify | `/verify/:token` | Public |
| Dashboard | `/dashboard` | Protected |
| Families | `/families`, `/families/:id` | Protected |
| People | `/people`, `/people/:id` | Protected |
| Sacraments | `/sacraments` | Protected |
| Certificates | `/certificates` | Protected |
| Admin | `/admin` | Protected (parish_admin, auditor) |

### Key Components

- **AuthContext** — JWT token management, login/logout, user state
- **ProtectedRoute** — Route guard with role-based access control
- **ErrorBoundary** — React class-based error boundary wrapping entire app
- **Layout** — Collapsible sidebar with SVG icons, tooltips, AnimatePresence page transitions
- **PageHeader / StatCard** — Animated reusable components with framer-motion

### UI Component Library (`components/ui/`)

| Component | Purpose |
|-----------|---------|
| `Modal` | Animated modal (ESC key, scroll lock, backdrop blur, sm/md/lg sizes) |
| `ConfirmDialog` | Confirmation with danger/warning/info variants, loading state |
| `EmptyState` | Zero-data state with icon, title, description, optional CTA |
| `Skeleton` | Shimmer loading: `SkeletonCard`, `SkeletonTable`, `SkeletonRow` |
| `Breadcrumb` | Nav breadcrumbs with home icon and chevron separators |

### Custom Hooks (`hooks/`)

| Hook | Purpose |
|------|---------|
| `useDebounce` | Generic debounce (300ms default) for search inputs |

### Stack

- React 18 + TypeScript
- React Router (client-side routing)
- Vite (dev server + build)
- Tailwind CSS (styling + custom design system: badges, buttons, table utilities)
- framer-motion (page transitions, list stagger animations, micro-interactions)
- react-hot-toast (global toast notifications)

---

## Backend (Express + TypeScript)

**Port:** 4000

### Security Middleware

| Middleware | Purpose |
|-----------|---------|
| Helmet | HTTP security headers |
| CORS | Cross-origin policy (frontend origin only) |
| Rate Limiter | 200 requests / 15 min (production only) |
| JWT Auth | Bearer token verification via `jsonwebtoken` |
| RBAC | Role-based access control per route |

### API Routes

| Route | Description |
|-------|-------------|
| `POST /api/auth` | Login, token refresh |
| `GET/POST /api/families` | Family CRUD |
| `GET/POST /api/people` | People CRUD |
| `GET/POST /api/sacraments` | Sacrament records |
| `GET/POST /api/certificates` | Certificate generation & verification |
| `GET/POST /api/admin` | User management, audit logs |
| `GET/POST /api/donations` | Donation management, receipts, reports, Excel export |
| `GET /api/verify/:token` | Public certificate verification (redirect) |
| `GET /health` | Health check |

### Utilities

- **PDF Generation** — Puppeteer renders HTML certificate/receipt templates to PDF
- **QR Codes** — `qrcode` library generates verification QR tokens
- **Audit Logger** — Immutable `audit_log` entries (user, entity, action, before/after snapshots, IP)
- **Excel Export** — `xlsx` (SheetJS) generates Excel workbooks for donation reports
- **Number-to-Words** — Converts amounts to Odia and English words for receipts
- **Zod** — Request validation schemas

---

## Data Layer (PostgreSQL 16)

**Port:** 5432 (Docker container: `parish-postgres`)

### Database Schema

```
parishes
├── families
│   └── family_memberships ←→ people
├── users
│   └── user_roles ←→ roles
└── certificate_templates

people
├── sacraments
│   ├── sacrament_sponsors
│   ├── marriages
│   ├── holy_orders
│   └── certificates
│       └── certificate_requests
└── family_memberships

sacrament_types (7 sacraments)
audit_log (immutable)

wards → units
donation_types
donation_family_info ←→ families
donations
donation_receipts
```

### Tables

| Table | Purpose |
|-------|---------|
| `parishes` | Parish info, diocese, contact, logo |
| `families` | Household records (active/inactive/transferred/deceased) |
| `people` | Individual parishioners with personal details |
| `family_memberships` | Person-to-family relationships |
| `sacrament_types` | Seven sacraments (Baptism through Anointing) |
| `sacraments` | Individual sacrament records (date, celebrant, register) |
| `sacrament_sponsors` | Godparents and witnesses |
| `marriages` | Marriage-specific fields (spouses, canonical form) |
| `holy_orders` | Holy Orders-specific fields (level, institute) |
| `certificate_templates` | HTML templates per sacrament type per parish |
| `certificates` | Generated certificates with QR verification tokens |
| `certificate_requests` | Parishioner requests (pending/approved/rejected/fulfilled) |
| `users` | Staff accounts (email, password hash, parish) |
| `roles` | 5 roles: parish_admin, sacramental_clerk, priest, auditor, parishioner |
| `user_roles` | User-to-role junction |
| `audit_log` | Immutable audit trail (no UPDATE/DELETE) |
| `wards` | Parish ward divisions |
| `units` | Units/Sangha within wards |
| `donation_types` | Configurable donation categories per parish |
| `donation_family_info` | 1:1 extension of families (card number, ward, unit, monthly pledge) |
| `donations` | Individual donation records (family, type, amount, date, receipt) |
| `donation_receipts` | Generated receipts with bilingual amount-in-words |

---

## Roles & Permissions

| Role | Access |
|------|--------|
| `parish_admin` | Full access, user management, audit logs |
| `sacramental_clerk` | Families, people, sacraments, certificates |
| `priest` | Sacrament records, certificates |
| `auditor` | Read-only access, audit logs |
| `parishioner` | Certificate requests (future) |

---

## Infrastructure

### Local Development (Docker Compose)

```
docker-compose.yml
├── parish-postgres:  PostgreSQL 16 Alpine (port 5432)
├── parish-backend:   Node.js + ts-node-dev (port 4000, hot reload via volume mount)
└── parish-frontend:  Vite dev server (port 5173, hot reload via volume mount)
```

Start: `start.bat` (Windows) or `start.sh` (Linux/Mac)
Stop: `stop.bat` (Windows) or `stop.sh` (Linux/Mac)

### Production (Linux EC2)

```
├── PostgreSQL: systemctl (native)
├── Backend: PM2 (Node.js process manager, port 4000)
└── Frontend: Nginx (static files, port 80, reverse proxy to API)
```

### Scripts

| Script | Purpose |
|--------|---------|
| `start.bat` / `start.sh` | Start all services via Docker Compose |
| `stop.bat` / `stop.sh` | Stop all services via Docker Compose |
| `docker compose logs -f` | View live logs from all containers |
| `npm run build:backend` | Compile TypeScript |
| `npm run build:frontend` | Vite production build |
| `npm run db:migrate` | Run schema.sql |
| `npm run db:seed` | Seed sample data |

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, framer-motion, react-hot-toast |
| Backend | Express 4, TypeScript, ts-node-dev |
| Database | PostgreSQL 16 (Docker / native) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Validation | Zod |
| PDF | Puppeteer |
| QR | qrcode |
| Security | Helmet, CORS, express-rate-limit |
| Containers | Docker Compose (dev), PM2 (prod) |
| Web Server | Nginx (prod reverse proxy) |
