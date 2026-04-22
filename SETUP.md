# Catholic Parish Web App — Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm

## Quick Start

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Configure backend environment
Edit `backend/.env` with your PostgreSQL credentials:
```
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/parish_db
JWT_SECRET=your-long-random-secret
JWT_REFRESH_SECRET=your-long-random-refresh-secret
```

### 3. Create the PostgreSQL database
```bash
psql -U postgres -c "CREATE DATABASE parish_db;"
```

### 4. Run database migrations
```bash
psql -U postgres -d parish_db -f backend/src/db/schema.sql
```
Or using npm script:
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/parish_db npm run db:migrate
```

### 5. Seed demo data
```bash
cd backend && npm run db:seed
```

### 6. Start the development servers
```bash
# In separate terminals:
npm run dev:backend    # Starts on http://localhost:4000
npm run dev:frontend   # Starts on http://localhost:5173

# Or both together:
npm run dev
```

### 7. Open the app
Visit: http://localhost:5173

---

## Demo Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Parish Admin | admin@stmarys.org | Admin@1234 |
| Sacramental Clerk | clerk@stmarys.org | Clerk@1234 |
| Priest | priest@stmarys.org | Priest@1234 |

---

## Project Structure

```
Catholic Parish Web App/
├── backend/                   # Node.js + Express API
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.sql     # PostgreSQL schema
│   │   │   ├── seed.ts        # Demo seed data
│   │   │   └── pool.ts        # DB connection
│   │   ├── middleware/
│   │   │   ├── auth.ts        # JWT authentication
│   │   │   ├── rbac.ts        # Role-based access control
│   │   │   └── audit.ts       # Audit logging
│   │   ├── routes/
│   │   │   ├── auth.ts        # Login, refresh, user mgmt
│   │   │   ├── families.ts    # Family CRUD
│   │   │   ├── people.ts      # Person CRUD
│   │   │   ├── sacraments.ts  # Sacrament records
│   │   │   ├── certificates.ts # PDF generation + requests
│   │   │   └── admin.ts       # Admin panel APIs
│   │   ├── utils/
│   │   │   └── pdf.ts         # PDF generation utilities
│   │   └── index.ts           # Express app entry point
│   ├── .env                   # Environment variables
│   └── package.json
│
└── frontend/                  # React + TypeScript + Tailwind
    ├── src/
    │   ├── api/
    │   │   └── client.ts      # Axios API client
    │   ├── components/
    │   │   ├── Layout.tsx     # App shell with sidebar
    │   │   ├── ProtectedRoute.tsx
    │   │   ├── PageHeader.tsx
    │   │   └── StatCard.tsx
    │   ├── contexts/
    │   │   └── AuthContext.tsx # Auth state management
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── Families.tsx / FamilyDetail.tsx
    │   │   ├── People.tsx / PersonDetail.tsx
    │   │   ├── Sacraments.tsx
    │   │   ├── Certificates.tsx
    │   │   ├── Admin.tsx
    │   │   └── Verify.tsx     # Public certificate verification
    │   ├── types/
    │   │   └── index.ts       # TypeScript type definitions
    │   └── App.tsx            # Routing
    └── package.json
```

---

## Key Features

### MVP Features Implemented
- [x] JWT authentication with role-based access (Admin, Clerk, Priest, Auditor, Parishioner)
- [x] Family card model — households with multiple members
- [x] Person profiles with full sacramental timeline
- [x] All 7 sacraments tracked with full register data
- [x] Certificate generation (HTML → PDF via Puppeteer, QR code included)
- [x] Certificate verification public endpoint
- [x] Certificate request queue for parishioners
- [x] Audit log (append-only)
- [x] Dashboard with analytics
- [x] Global search by name / baptismal name / maiden name
- [x] Admin panel: parish settings, user management, audit log viewer
- [x] Liturgical design with navy, gold, ivory color palette

### PDF Generation
- Requires Puppeteer (`npm install puppeteer` in backend)
- Falls back to HTML file if Puppeteer is unavailable
- Each PDF includes QR code linking to `/verify/:token`
- Time-limited serving via backend endpoint

### AWS Integration (Production)
To enable S3 storage, add to `backend/.env`:
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=parish-certificates
```
