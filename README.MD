# Catholic Parish Web App

A secure, full-stack web application for managing Catholic parish family cards, sacramental records, and official certificate generation.

---

## Overview

This system manages parishioners organized by household (family card model), tracks all seven sacraments for each individual, and generates downloadable PDF certificates — with full audit logging, role-based access control, and a certificate verification portal.

Inspired by systems like Sacramental Scribe, PDS Sacramental Register, and ParishSOFT Families — built with a clean, modern architecture.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 14+ |
| Auth | JWT (access 15min + refresh 7d) + RBAC |
| PDF Generation | Puppeteer (HTML → PDF) + QR Code |
| Object Storage | AWS S3 (production) / local fallback (dev) |
| Email | AWS SES / SendGrid (production) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| i18n | react-i18next |

---

## Features

### Implemented (MVP)

- [x] JWT authentication with role-based access (Admin, Clerk, Priest, Auditor, Parishioner)
- [x] Family card model — households with multiple members and relationships
- [x] Person profiles with full sacramental timeline (vertical timeline UI)
- [x] All 7 sacraments tracked with complete register data (volume, page, celebrant, sponsors)
- [x] Certificate generation — HTML → PDF via Puppeteer, QR code embedded
- [x] Public certificate verification endpoint (`/verify/:token`)
- [x] Certificate request queue — parishioner submits, staff approves
- [x] Immutable audit log (append-only, no UPDATE/DELETE)
- [x] Role-based dashboard with analytics and stat cards
- [x] Global search by name, baptismal name, maiden name, DOB
- [x] Admin panel: parish settings, user management, audit log viewer
- [x] Liturgical design palette (deep navy, gold, ivory, muted red)
- [x] Marriage-specific data (canonical form, dispensation flags, spouse links)
- [x] Holy Orders-specific data (order level, religious institute)
- [x] Sponsor/godparent records per sacrament
- [x] CSV export for sacrament reports

### Post-MVP (Not yet built)

- [ ] Parishioner mobile portal
- [ ] Catechesis / Religious Ed module
- [ ] Cemetery / Tomb Register
- [ ] Diocesan multi-parish dashboard
- [ ] Offline / service worker support

---

## User Roles

| Role | Access |
|---|---|
| `parish_admin` | Full access — users, settings, all data |
| `sacramental_clerk` | Create/update sacraments, generate certificates |
| `priest` | Approve sacraments, digital signature |
| `auditor` | Read-only (chancery/diocesan staff) |
| `parishioner` | View own family card, request certificates |

---

## Project Structure

```
Catholic Parish Web App/
├── backend/                     # Node.js + Express API (TypeScript)
│   └── src/
│       ├── db/
│       │   ├── schema.sql       # PostgreSQL schema (16 tables + indexes)
│       │   ├── seed.ts          # Demo data seeder
│       │   └── pool.ts          # PostgreSQL connection pool
│       ├── middleware/
│       │   ├── auth.ts          # JWT authentication
│       │   ├── rbac.ts          # Role-based access control
│       │   └── audit.ts         # Audit logging middleware
│       ├── routes/
│       │   ├── auth.ts          # Login, refresh, user management
│       │   ├── families.ts      # Family CRUD + member management
│       │   ├── people.ts        # Person CRUD + search
│       │   ├── sacraments.ts    # Sacrament records
│       │   ├── certificates.ts  # PDF generation + request queue
│       │   └── admin.ts         # Audit log, reports, parish settings
│       ├── utils/
│       │   └── pdf.ts           # PDF generation utilities
│       └── index.ts             # Express app entry point
│
└── frontend/                    # React + TypeScript + Tailwind (Vite)
    └── src/
        ├── api/
        │   └── client.ts        # Axios client with auto-refresh interceptor
        ├── components/
        │   ├── Layout.tsx        # App shell with sidebar navigation
        │   ├── ProtectedRoute.tsx # Role-based route guard
        │   ├── PageHeader.tsx
        │   └── StatCard.tsx
        ├── contexts/
        │   └── AuthContext.tsx   # Auth state + token management
        ├── pages/
        │   ├── Login.tsx
        │   ├── Dashboard.tsx
        │   ├── Families.tsx / FamilyDetail.tsx
        │   ├── People.tsx / PersonDetail.tsx
        │   ├── Sacraments.tsx
        │   ├── Certificates.tsx
        │   ├── Admin.tsx
        │   └── Verify.tsx        # Public certificate verification
        └── types/
            └── index.ts          # Shared TypeScript interfaces
```

---

## Database Schema

16 core tables in PostgreSQL:

| Table | Description |
|---|---|
| `parishes` | Parish details, logo, contact info |
| `families` | Household units with status |
| `people` | Individual parishioners |
| `family_memberships` | Person-to-family relationships |
| `sacrament_types` | Seven sacraments (seeded) |
| `sacraments` | Individual sacrament records with register data |
| `sacrament_sponsors` | Godparents / witnesses |
| `marriages` | Marriage-specific fields |
| `holy_orders` | Holy Orders-specific fields |
| `certificate_templates` | HTML templates per sacrament per parish |
| `certificates` | Generated PDFs with QR tokens |
| `certificate_requests` | Parishioner requests + approval workflow |
| `users` | Staff accounts |
| `roles` | Role definitions |
| `user_roles` | User-to-role assignments |
| `audit_log` | Immutable append-only audit trail |

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm

### 1. Install all dependencies

```bash
npm run install:all
```

### 2. Configure environment

Copy and edit the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Minimum required values in `backend/.env`:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/parish_db
JWT_SECRET=your-very-long-random-secret-key
JWT_REFRESH_SECRET=your-very-long-random-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
```

### 3. Create the database

```bash
psql -U postgres -c "CREATE DATABASE parish_db;"
```

### 4. Run database migrations

```bash
psql -U postgres -d parish_db -f backend/src/db/schema.sql
```

Or via npm script:

```bash
npm run db:migrate
```

### 5. Seed demo data

```bash
npm run db:seed
```

### 6. Start development servers

```bash
# Both servers together:
npm run dev

# Or separately:
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:5173
```

### 7. Open the app

Visit [http://localhost:5173](http://localhost:5173)

---

## Demo Accounts (after seeding)

| Role | Email | Password |
|---|---|---|
| Parish Admin | admin@stmarys.org | Admin@1234 |
| Sacramental Clerk | clerk@stmarys.org | Clerk@1234 |
| Priest | priest@stmarys.org | Priest@1234 |

Seed includes: 1 parish (St. Mary's), 3 families, all 7 sacrament types, sample records, 2 certificate templates.

---

## API Endpoints

### Auth
```
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/users
POST   /api/users
```

### Families & People
```
GET    /api/families               (paginated, filtered)
POST   /api/families
GET    /api/families/:id
PUT    /api/families/:id
POST   /api/families/:id/members

GET    /api/people                 (search by name, DOB)
POST   /api/people
GET    /api/people/:id
PUT    /api/people/:id
```

### Sacraments
```
GET    /api/sacrament-types
GET    /api/sacraments             (filter by type, date, celebrant)
POST   /api/sacraments
GET    /api/sacraments/:id
PUT    /api/sacraments/:id
```

### Certificates
```
GET    /api/certificate-templates
POST   /api/certificate-templates
PUT    /api/certificate-templates/:id

POST   /api/certificates           { personId, sacramentId, templateId }
GET    /api/certificates/:id       returns metadata + PDF download URL

POST   /api/certificate-requests   (parishioner submits)
GET    /api/certificate-requests   (staff queue)
PATCH  /api/certificate-requests/:id

GET    /api/certificates/verify/:token   (public — no auth required)
```

### Admin
```
GET    /api/admin/audit-log
GET    /api/admin/reports
GET    /api/admin/parish-settings
PUT    /api/admin/parish-settings
```

---

## Certificate Generation Flow

1. Clerk opens a person's sacrament record and clicks **Generate Certificate**.
2. Backend pulls sacrament + person + parish template, validates required fields.
3. Renders HTML template with auto-filled data (name, date, celebrant, sponsors, register ref).
4. Converts HTML → PDF via Puppeteer, embeds QR code.
5. Stores PDF (S3 in production, local in dev) with a unique hash token.
6. Returns a time-limited download URL.
7. Audit log entry written automatically.
8. Optional: sends download link by email to parishioner.

Each certificate includes:
- Parish crest/logo and canonical header
- Auto-filled sacrament data
- Register reference (volume/page)
- QR code linking to `/api/certificates/verify/:token`

---

## PDF Generation Notes

- Requires Puppeteer (installed as part of `npm install` in backend).
- Falls back to an HTML file if Puppeteer / Chromium is unavailable.
- In production, PDFs are stored in S3 and served via signed URLs.
- In development, PDFs are stored locally and served directly from the backend.

---

## AWS / Production Configuration

Add these to `backend/.env` to enable S3 and email:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=parish-certificates
```

Production requirements:
- HTTPS enforced at load balancer (ALB)
- RDS encryption at rest enabled
- S3 bucket encryption (SSE-S3 or SSE-KMS)
- S3 versioning enabled on certificates bucket
- Automated RDS snapshots configured

---

## Security

- Short-lived JWT access tokens (15 min) + refresh tokens (7 days)
- RBAC enforced on every API route
- Helmet for HTTP security headers
- Rate limiting on auth endpoints
- All inputs validated server-side with Zod
- Audit log is append-only (no UPDATE/DELETE permitted)
- Certificate PDFs never publicly accessible — always served via time-limited URLs
- Passwords hashed with bcrypt

---

## Available npm Scripts

| Script | Description |
|---|---|
| `npm run install:all` | Install all backend + frontend dependencies |
| `npm run dev` | Start both servers concurrently |
| `npm run dev:backend` | Start backend only (port 4000) |
| `npm run dev:frontend` | Start frontend only (port 5173) |
| `npm run build:backend` | Compile backend TypeScript |
| `npm run build:frontend` | Build frontend for production |
| `npm run db:migrate` | Run schema.sql against DATABASE_URL |
| `npm run db:seed` | Seed demo data |

---

*Catholic Parish Web App — v1.0 | March 2026*
