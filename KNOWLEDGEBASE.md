# Catholic Parish Web App — Knowledge Base

> This document defines the boundaries, rules, and conventions for this project.
> All contributors (human and AI) must follow these guidelines to prevent deviation
> from the app's purpose, design, and architecture.

---

## 1. Project Purpose & Scope

### What This App IS

- A **sacramental records management system** for Catholic parishes
- A tool for parish staff to manage **families, people, and sacrament records**
- A **certificate generation and verification** platform (Baptism, Confirmation, etc.)
- An **audit-compliant** record-keeping system with immutable logs

### What This App IS NOT

- NOT a social media platform or community forum
- NOT an e-commerce or donation/payment system
- NOT a general CMS or blog platform
- NOT a messaging or communication tool (no chat, email, SMS)
- NOT a scheduling or calendar system
- NOT a streaming or media platform

### Approved Feature Domains

Only features within these domains are permitted:

| Domain | Examples |
|--------|----------|
| Family Management | CRUD families, household cards, memberships |
| People Management | CRUD parishioners, personal details, status tracking |
| Sacramental Records | Record all 7 sacraments, sponsors, celebrants, register references |
| Certificate Generation | HTML templates, PDF rendering, QR verification tokens |
| Certificate Requests | Parishioner requests, approval workflow |
| User & Role Management | Staff accounts, role assignment, activation/deactivation |
| Audit Trail | Immutable logs of all data changes |
| Parish Configuration | Parish info, diocese, logo, contact details |
| Public Verification | QR-based certificate authenticity verification |
| Donation Management | Family donations, receipts, donation dashboard, reports, family/monthly Excel export, configurable donation types (Member, Special, Festival, Others, Peter's Pence) |

### Explicitly Out of Scope (Do NOT Build)

- Tithing or complex financial/accounting features
- Event calendars, mass schedules, or booking systems
- Announcements, newsletters, or notification systems
- Photo galleries or media libraries
- Online confession or spiritual counseling
- Parish directory or member search for parishioners
- Third-party social login (Google, Facebook, etc.)
- Multi-language/i18n (unless explicitly requested)
- Mobile app (this is a web-only application)

---

## 2. The Seven Sacraments (Domain Truth)

The app tracks exactly **seven sacraments** as defined by Catholic Canon Law:

| Code | Name | Order |
|------|------|-------|
| `BAPTISM` | Baptism | 1 |
| `EUCHARIST` | Eucharist (First Holy Communion) | 2 |
| `PENANCE` | Penance / Reconciliation | 3 |
| `CONFIRMATION` | Confirmation | 4 |
| `MATRIMONY` | Matrimony | 5 |
| `HOLY_ORDERS` | Holy Orders | 6 |
| `ANOINTING` | Anointing of the Sick | 7 |

**Rules:**
- Do NOT add, remove, or rename any sacrament types
- Do NOT change the sequence order
- Matrimony and Holy Orders have dedicated extension tables (`marriages`, `holy_orders`)
- Every sacrament record must reference a `person_id`, `sacrament_type_id`, and `parish_id`
- Sacrament statuses are strictly: `scheduled`, `completed`, `cancelled`

---

## 3. Role-Based Access Control (RBAC)

### Fixed Roles

| Role | Purpose |
|------|---------|
| `parish_admin` | Full system access, manages users and parish settings |
| `sacramental_clerk` | Day-to-day data entry: families, people, sacraments, certificates |
| `priest` | Sacrament records and certificate signing |
| `auditor` | Read-only access to all records and audit logs |
| `parishioner` | Limited self-service (certificate requests only) |

**Rules:**
- Do NOT add new roles without explicit approval
- Do NOT bypass RBAC middleware on protected routes
- Admin page requires `parish_admin` or `auditor` role
- Every protected route must use `authenticate` middleware
- Sensitive routes must also use `requireRoles()` middleware
- A user cannot delete their own account

---

## 4. Authentication Rules

- **JWT only** — no session cookies, no OAuth, no third-party auth providers
- Access tokens expire in **15 minutes** (configurable via `JWT_EXPIRES_IN`)
- Refresh tokens expire in **7 days** (configurable via `JWT_REFRESH_EXPIRES_IN`)
- Refresh tokens are **hashed with bcrypt** before storage
- Passwords are hashed with **bcrypt (12 rounds)** for new users
- Minimum password length: **8 characters** (user creation), **6 characters** (login validation)
- JWT payload must contain: `userId`, `email`, `parishId`, `roles`
- All data is **parish-scoped** — users can only access data from their own parish

---

## 5. Database Rules

### Schema Integrity

- All primary keys are **UUIDs** (uuid_generate_v4)
- All tables must have `created_at TIMESTAMPTZ DEFAULT NOW()`
- Mutable tables must have `updated_at TIMESTAMPTZ DEFAULT NOW()`
- Use **foreign key constraints** with appropriate `ON DELETE` behavior
- Status fields use **CHECK constraints** with fixed allowed values

### Immutable Audit Log

The `audit_log` table is **append-only**:
- **Never** add UPDATE or DELETE operations on this table
- **Never** add a migration that truncates or modifies audit records
- Every significant data change must produce an audit entry with:
  - `user_id` — who made the change
  - `entity_type` / `entity_id` — what was changed
  - `action` — what happened (CREATE, UPDATE, DELETE)
  - `before_snapshot` / `after_snapshot` — JSON snapshots
  - `ip_address` — request origin

### Data Isolation

- All queries for families, people, sacraments, and certificates must be **scoped to the user's parish**
- Never expose data from one parish to users of another
- Cross-parish queries are forbidden

### Migration Rules

- Core schema changes go in `backend/src/db/schema.sql`
- Donation schema in `backend/src/db/donation-schema.sql` (wards, units, donation_types, donation_family_info, donations, donation_receipts)
- Always use `IF NOT EXISTS` / `IF EXISTS` for idempotent migrations
- Never drop tables in production without explicit approval
- Seed data for sacrament_types and roles uses `ON CONFLICT DO NOTHING`

---

## 6. API Conventions

### URL Structure

```
/api/auth/*          — Public (login, refresh)
/api/verify/:token   — Public (certificate verification)
/api/families/*      — Protected
/api/people/*        — Protected
/api/sacraments/*    — Protected
/api/certificates/*  — Protected (verify endpoint is public)
/api/donations/*     — Protected (CRUD donations, types, wards, units, receipts, reports, Excel export)
/api/admin/*         — Protected (admin/auditor only)
/health              — Public (health check)
```

### Response Format

- Success: `res.json({ ...data })` or `res.status(201).json({ ...data })`
- Validation error: `res.status(400).json({ error: 'message', details: zodErrors })`
- Auth error: `res.status(401).json({ error: 'message' })`
- Permission error: `res.status(403).json({ error: 'message' })`
- Not found: `res.status(404).json({ error: 'message' })`
- Conflict: `res.status(409).json({ error: 'message' })`
- Server error: `res.status(500).json({ error: 'Internal server error' })`

### Validation

- All request bodies must be validated with **Zod schemas**
- Validate at the route handler level, before any database operations
- Never trust client input — always sanitize and validate

### Rules

- Do NOT add GraphQL, WebSocket, or gRPC endpoints
- Do NOT add file upload endpoints beyond what exists (multer for certificates)
- Do NOT add external API integrations without explicit approval
- All new routes must follow the existing pattern: Router → validate → query → respond

---

## 6b. Donation Management Rules

### Donation Types

Configurable per parish via `donation_types` table. Default seed types:

| Code | Name |
|------|------|
| `MEMBER` | Member Donation |
| `SPECIAL` | Special Donation |
| `FESTIVAL` | Festival Donation |
| `OTHER` | Others |
| `PETERS_PENCE` | Peter's Pence (Holy Father's Offering) |

- Donation types are parish-scoped (`UNIQUE(parish_id, code)`)
- Admin can add/edit types via API; seed defaults via `POST /api/donations/seed-types`

### Donation Theme

- Donation pages use **maroon/cream** theme: maroon-500 (`#800020`), donationGold (`#D4AF37`), cream (`#FFF8DC`)
- Rest of the app retains the navy/gold/ivory theme

### Key Features

- **Family donation info**: 1:1 extension table (`donation_family_info`) — card number, ward, unit, monthly pledge, phone
- **12-month payment grid**: Embedded in family detail page with clickable cells for CRUD
- **Excel export**: Per-family (grid by year) and per-month (register) exports via SheetJS
- **Receipt generation**: Auto-numbered receipts (`RCP-YYYY-NNNN`) with PDF download
- **Reports**: Ward collection, family summary, defaulters, festival collection, year comparison — all exportable
- **Dashboard**: Annual stats, monthly bar chart, type pie chart, top 10 donors

### Language

- All donation UI labels are **English only** (defined in `frontend/src/utils/donationLabels.ts`)
- The `name_odia` column exists in `donation_types` for future use but is currently `NULL`

---

## 7. Frontend Conventions

### Design System

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#faf8f3` (ivory) | Page background |
| Primary | `navy-800` (#243b53) | Buttons, links, focus rings |
| Accent | `gold-500` (#f59e0b) | Highlights, warnings |
| Danger | `burgundy-500` (#9b1c1c) | Destructive actions |
| Headings font | Playfair Display (serif) | h1–h6 |
| Body font | Inter (sans-serif) | All other text |
| Cards | White, rounded-2xl, border-gray-200, shadow-sm | Content containers |
| Table containers | rounded-2xl, shadow-sm, bg-gray-50/80 headers | Data tables |
| Modal backdrop | bg-black/40 with backdrop-blur-sm | Modal overlays |
| Scrollbar | `#c5b99a` thumb | Custom webkit scrollbar |
| Skeleton loading | Shimmer gradient animation (1.5s infinite) | Loading placeholders |
| Toast | navy-900 bg, rounded-xl, 4s duration | Notification toasts |
| Donation Primary | `maroon-500` (#800020) | Donation page buttons, headings |
| Donation Accent | `donationGold` (#D4AF37) | Donation highlights |
| Donation Background | `cream` (#FFF8DC) | Donation page backgrounds |

### Component Rules

- Use **Tailwind CSS utility classes** — no inline styles, no CSS modules
- Use the predefined component classes: `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`, `.input`, `.card`
- Use the **badge design system**: `.badge-success`, `.badge-danger`, `.badge-warning`, `.badge-info`, `.badge-neutral`
- Use `.table-header` and `.table-cell` utility classes for consistent table styling
- Do NOT add a component library (no MUI, Chakra, Ant Design, shadcn)
- Do NOT add a state management library (no Redux, Zustand, Jotai)
- Use **React Context** for global state (AuthContext pattern)
- Use **React Router** for navigation — no other routing library

### Reusable UI Component Library

All reusable components live in `frontend/src/components/ui/`:

| Component | File | Purpose |
|-----------|------|---------|
| `Modal` | `ui/Modal.tsx` | Animated modal with ESC key handling, body scroll lock, backdrop blur, size variants (sm/md/lg) |
| `ConfirmDialog` | `ui/ConfirmDialog.tsx` | Confirmation dialog with danger/warning/info variants and loading state |
| `EmptyState` | `ui/EmptyState.tsx` | Animated empty state with icon, title, description, optional action button |
| `Skeleton` | `ui/Skeleton.tsx` | Shimmer skeleton loaders: `Skeleton`, `SkeletonCard`, `SkeletonTable`, `SkeletonRow` |
| `Breadcrumb` | `ui/Breadcrumb.tsx` | Breadcrumb navigation with home icon and chevron separators |
| `ErrorBoundary` | `ErrorBoundary.tsx` | React class-based error boundary with styled error page |

**Rules:**
- Use `Modal` for all modal dialogs — do NOT create inline modal markup
- Use `ConfirmDialog` for destructive actions — do NOT use `window.confirm()` or `alert()`
- Use `toast` from `react-hot-toast` for all success/error notifications — do NOT use `alert()`
- Use `SkeletonTable` / `SkeletonCard` for loading states — do NOT create ad-hoc loading skeletons
- Use `EmptyState` for zero-data states — do NOT use plain text with emoji

### Animation & Feedback

- **framer-motion** is used for page transitions, list stagger animations, and micro-interactions
- **react-hot-toast** provides global toast notifications (configured in `main.tsx`)
- Animations should be subtle and professional — no bouncy or playful effects
- Use `motion.div` / `motion.tr` with simple opacity/translate for list items
- Stagger delays: `0.02s–0.03s` per row for table items, `0.08s–0.1s` for cards
- The sidebar uses collapsible state with tooltip labels when collapsed

### Custom Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useDebounce` | `hooks/useDebounce.ts` | Generic debounce hook (default 300ms) for search inputs |

**Rules:**
- Use `useDebounce` for all search/filter inputs — do NOT use manual submit-based search
- Search inputs should auto-trigger with debounce, not require an explicit "Search" button

### Page Structure

- All authenticated pages render inside `<Layout />` (sidebar + content area)
- Public pages (Login, Verify) render standalone without Layout
- Every page that modifies data must be wrapped in `<ProtectedRoute>` with appropriate roles
- The entire app is wrapped in `<ErrorBoundary>` (in `App.tsx`) for graceful crash handling

### UI/UX Rules

- Maintain the **traditional, formal aesthetic** appropriate for a Catholic parish
- Animations are subtle transitions (opacity, translate) — no bouncy/playful effects
- No dark mode (the ivory/navy/gold palette is the canonical theme)
- Use SVG Heroicons for all icons — no emoji in production UI (nav, buttons, stat cards)
- Print-friendly certificate pages (use `.no-print` class to hide UI controls)
- Certificates must be printable and include QR verification codes
- All tables use `rounded-2xl` containers with `shadow-sm` and `bg-gray-50/80` headers
- Do NOT use `dangerouslySetInnerHTML` — use proper React components instead

---

## 8. Security Rules

### Non-Negotiable

- **Helmet** must remain enabled for HTTP security headers
- **CORS** must restrict origin to the configured `FRONTEND_URL` only
- **Rate limiting** must be active in production (200 req / 15 min)
- Never log passwords, tokens, or secrets to console
- Never return password hashes or refresh token hashes in API responses
- Never store secrets in code — use `.env` files
- `.env` files must be in `.gitignore`

### Input Safety

- All SQL queries use **parameterized queries** ($1, $2...) — never string concatenation
- All request bodies validated with Zod before processing
- File uploads restricted via multer configuration
- JSON body limit: 5MB max

### Certificate Verification

- Each certificate gets a unique `hash_or_qr_token`
- Public verification endpoint reveals only: valid/invalid status and basic sacrament info
- Never expose personal details (address, phone, email) via the public verification endpoint

---

## 9. Infrastructure Rules

### Local Development (Docker Compose)

- All three services run via `docker-compose.yml`:
  - `parish-postgres`: PostgreSQL 16 Alpine (port 5432, data persisted in `parish_data` volume)
  - `parish-backend`: Node.js + ts-node-dev (port 4000, `src/` volume-mounted for hot reload)
  - `parish-frontend`: Vite dev server (port 5173, `src/` volume-mounted for hot reload)
- Start with `start.bat` (Windows) or `start.sh` (Linux/Mac) — runs `docker compose up --build -d`
- Stop with `stop.bat` (Windows) or `stop.sh` (Linux/Mac) — runs `docker compose down`
- View logs with `docker compose logs -f`
- Backend waits for PostgreSQL healthcheck before starting
- Dockerfiles located at `backend/Dockerfile` and `frontend/Dockerfile`

### Production (Linux EC2)

- PostgreSQL: native systemd service
- Backend: PM2 process manager on port 4000
- Frontend: Nginx serves static build on port 80, proxies `/api/*` to backend

### Rules

- Docker Compose is used for the full stack (PostgreSQL, backend, frontend) in local development
- Do NOT add Kubernetes, serverless, or microservice configurations
- Do NOT switch from PM2 to another process manager
- Do NOT replace Nginx with another reverse proxy
- Keep the deployment simple — single server, single database

---

## 10. Code Quality Rules

### TypeScript

- Strict mode enabled
- No `any` types unless absolutely unavoidable (and document why)
- Use interfaces/types for all data shapes
- Use Zod for runtime validation, TypeScript for compile-time safety

### File Organization

```
docker-compose.yml        — Full-stack dev orchestration
backend/
  Dockerfile               — Backend container image
  src/
    db/          — pool.ts, schema.sql, seed.ts
    middleware/   — auth.ts, rbac.ts, audit.ts
    routes/       — one file per resource (auth, families, people, sacraments, certificates, donations, admin)
    utils/        — pdf.ts, excel.ts, number-to-words.ts, shared utilities
    index.ts      — Express app entry point

frontend/
  Dockerfile               — Frontend container image
  src/
    components/   — Reusable UI components
      ui/         — Design system primitives (Modal, ConfirmDialog, EmptyState, Skeleton, Breadcrumb)
      ErrorBoundary.tsx — React error boundary
      Layout.tsx  — Collapsible sidebar, page transitions (AnimatePresence)
      PageHeader.tsx — Sticky page header with blur backdrop
      StatCard.tsx — Animated stat card with hover/tap effects
    contexts/     — React contexts (AuthContext)
    hooks/        — Custom hooks (useDebounce)
    pages/        — One file per page/route (incl. DonationDashboard, DonationRegister, DonationReports)
    types/        — TypeScript interfaces and constants (SACRAMENT_COLORS, ROLES)
    utils/        — donationLabels.ts (English labels + INR formatter)
    App.tsx       — Router configuration (wrapped in ErrorBoundary)
    main.tsx      — Entry point (includes Toaster from react-hot-toast)
    index.css     — Tailwind + global styles + badge/button/table design system
```

### Rules

- One route file per resource — do NOT combine routes
- Middleware in `middleware/` — do NOT inline auth/rbac logic in route files
- Database queries go directly in route handlers (no ORM, no separate repository layer)
- Do NOT add an ORM (no Prisma, TypeORM, Drizzle, Sequelize)
- Do NOT add a test framework unless explicitly requested
- Do NOT restructure the file organization without approval

---

## 11. Git & Deployment Rules

- All changes must be documented in `CHANGELOG.md`
- Do NOT force push to main
- Do NOT commit `.env`, `node_modules/`, or `dist/` directories
- Build before deploying: `npm run build:backend && npm run build:frontend`
- Database migrations run manually: `npm run db:migrate`

---

## 12. Change Control

Before making any change, verify it does not violate this knowledge base. If a requested feature:

1. **Falls within scope** (Section 1) — proceed
2. **Falls outside scope** — flag it and request explicit approval
3. **Conflicts with a rule** — do NOT proceed; explain the conflict

When in doubt, **don't build it**. Ask first.
