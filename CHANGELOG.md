# Changelog

All notable changes to the Catholic Parish Web App are documented here.

---

## [Unreleased] — 2026-04-22

### Changed — Repository structure & initial GitHub push
- Moved `.git` from parent folder into project root so `Catholic Parish Web App/` is the repo root (no nested folder on GitHub)
- Added `.claude/` and `backups/` to `.gitignore` to keep local Claude Code settings and DB dumps out of the public repo
- Initial push to `https://github.com/sibanando/Catholic_Parish_Web_App.git`

## [Unreleased] — 2026-03-29

### Fixed — Annual Pledge derived from actual member donation rate; Balance Due adjusted
- Backend: Annual Pledge now calculated as `(member donation total ÷ months with member donations) × 12` instead of `monthly_pledge × 12`
- Example: ₹200 member donation in 1 month → ₹200/month rate → ₹2,400 Annual Pledge
- Balance Due = Annual Pledge − Member Donation total (not Grand Total)
- Grand Total continues to sum all donation types (Member, Special, Festival, Others, Peter's Pence)

## [Unreleased] — 2026-03-28

### Added — Edit Bride Info for existing Matrimony sacraments
- Backend: new `PATCH /sacraments/:id/bride` endpoint creates or updates the bride person & marriages row
- Frontend: "Edit Bride" button appears on completed Matrimony sacraments in the timeline; opens a modal to enter/update Bride's Name, Father, Mother, Address

### Added — Bride fields in Record Sacrament modal for Matrimony
- Frontend: Bride section (Name, Father, Mother, Address/Parish) appears automatically when Matrimony is selected
- Backend: sacrament POST handler now creates a bride person record and inserts into `marriages` table when `brideData` is supplied

### Fixed — Marriage Certificate: Bride section now shows Father, Mother & Address
- Backend: extended marriage query to JOIN `people p2` for `father_name`/`mother_name` and `families f2` for `address`
- Frontend: populated Bride's Father's Name, Mother's Name, Address/Parish fields in `CertificatePreview.tsx`

### Removed — Children Pending Sacraments section from Dashboard
- Removed the amber warning card showing pending First Communion/Confirmation children from `Dashboard.tsx`

### Fixed — Peter's Pence wrong values & added Ward/Unit columns
- Root cause: frontend passed `donationTypeId` param but backend reads `typeId` → filter not applied, all donations shown
- Fix: changed to `typeId` in `DonationReports.tsx` and `PetersPence.tsx`; raised backend list limit cap from 100 → 1000
- Backend list query now JOINs wards/units and returns `ward_name`, `unit_name` in each row
- Added Ward and Unit columns to Peter's Pence tables in both pages

### Fixed — Family Detail: Donation type dropdown empty (`FamilyDetail.tsx`)
- If no donation types exist in DB for the parish, `loadDonations` now auto-seeds the defaults (MEMBER, FESTIVAL, PETERS_PENCE, etc.) so the dropdown is always populated

### Fixed — Family Detail: Inline field save failure (`FamilyDetail.tsx`)
- Root cause: POST upsert passed `monthlyPledge` from `donInfo` (PostgreSQL NUMERIC returns as string `"0.00"`), which failed Zod's `z.number()` → silent 400 error
- Fix: use PUT `/family-info/:id` (only sends the single changing field) when a record exists; use POST only when creating a new record — no monthlyPledge in payload

### Fixed — Family Detail: Record Donation save & edit (`FamilyDetail.tsx`)
- Fixed "Please select a donation type" error: dropdown now uses actual type IDs from loaded `donTypes` (not hardcoded codes), so save works correctly
- Removed old separate grid-cell modal; grid cell clicks now open the unified Record Donation modal pre-filled for editing (Cancel / Update / Delete)
- Donation type dropdown locked when editing an existing record

### Changed — Family Detail: Inline Edit for Card No. & Phone (`FamilyDetail.tsx`)
- Removed "Monthly Pledge" from the donation info card display
- Family Card No. and Phone now support inline editing: click "Edit" → input appears with Save, Remove, Cancel actions
- "Remove" clears the field value; "Save" persists via `upsertFamilyInfo` API

### Changed — Family Detail: Record Donation Modal (`FamilyDetail.tsx`)
- Removed "Edit Info" button and modal (ward/unit/pledge/phone editing)
- Removed "Record Peter's Pence" quick-action button
- Added **+ Record Donation** button in the donation info card
- New modal with: Family Name (read-only), Family Card No. (read-only), Donation Type dropdown (Family Card Monthly Pledge / Punya Pita Chanda Yearly Pledge / Festive Occasion), Amount, Date, Note
- Buttons: Cancel, Save (new) — Update + Delete shown when editing
- Donation month/year derived automatically from the selected date

---

## [Unreleased] — 2026-03-27

### Added — Donations Module Redesign (Layout, Receipts, Settings, Enhancements)

**Donations Layout Wrapper (`DonationsLayout.tsx`)**
- New shared layout component wrapping all `/donations/*` routes
- Breadcrumb navigation (Home > Donations > current page)
- Horizontal pill/tab sub-navigation bar with 5 tabs: Dashboard, Register, Reports, Receipts, Settings
- Settings tab only visible to `parish_admin` role
- Routes restructured from flat to nested under `DonationsLayout` in `App.tsx`

**New Page: Donation Receipts (`DonationReceipts.tsx`)**
- Route: `/donations/receipts`
- Lists all receipts with columns: Receipt #, Family Name, Amount, Date Issued, Actions
- View receipt details in modal (shows amount in words in English and Odia)
- Download bilingual PDF receipt (Odia + English)
- Generate new receipt with family search, amount, and date
- Pagination support

**New Page: Donation Settings (`DonationSettings.tsx`)**
- Route: `/donations/settings` (admin only)
- 3 tabs: Wards, Units, Donation Types
- Wards tab: list, create, edit wards with name, Odia name, sort order
- Units tab: list/filter by ward, create, edit units with ward assignment
- Donation Types tab: list, create, edit types with code, name, Odia name, recurring flag, sort order
- "Seed Default Types" button for initial setup

**FamilyDetail — Ward/Unit Bug Fix**
- Fixed Edit Info modal always sending `wardId: null, unitId: null` (line 330)
- Added Ward and Unit dropdown fields to the Edit Info modal form
- Ward/Unit values now properly saved when editing donation family info

**DonationRegister — Filter Enhancements**
- Added Ward filter dropdown (populated from backend)
- Added Donation Type filter dropdown
- All filters passed to backend `GET /donations` endpoint (`wardId`, `typeId` params)
- Receipt numbers displayed with maroon highlighting

**DonationDashboard — Quick Actions Simplified**
- Reduced quick nav from 5 to 4 action-oriented cards with descriptions
- Cards: Record Donation, Reports, Defaulters, Receipts
- Navigation duplication removed (persistent tab bar from layout handles sub-page navigation)

**DonationReports — Print, Festival Export & Peter's Pence Tab**
- Added Print button (all report tabs)
- Added Festival Collection export to Excel (was missing from export options)
- Added Peter's Pence report tab — shows all families' Peter's Pence offerings for a year with serial numbers, card numbers, family names, dates, amounts, remarks, and total footer
- Peter's Pence tab supports Excel export
- Backend: Added `festival-collection` and `peters-pence` export types to `GET /reports/export` endpoint

**Donation Labels (`donationLabels.ts`)**
- Added 15 new labels: receipts, settings, wards, units, donationTypes, addWard, addUnit, addType, seedDefaults, sortOrder, odiaName, isRecurring, downloadReceipt, viewReceipt, generateReceipt, dateIssued, code, name, actions, petersPence

### Changed — Donations Restructured (Forms → Families, Reports → Donations)

**Donation entry forms moved to Family Detail page**
- Peter's Pence recording is now done from the FamilyDetail page via "Record Peter's Pence" button
- Monthly donation entry is done from FamilyDetail (existing donation modal)
- Removed Monthly Form and Peter's Pence tabs from DonationsLayout (now 5 tabs instead of 7)
- Removed `/donations/peters-pence` and `/donations/monthly-form` routes from `App.tsx`
- Peter's Pence all-families view moved to DonationReports as a report tab

**FamilyDetail — Peter's Pence Button**
- Added "Record Peter's Pence" button next to Edit Info in the donation section
- Pre-sets donation type to PETERS_PENCE, opens existing donation modal

**Edit Info Form (FamilyDetail.tsx)**
- Added Ward and Unit dropdown fields to the Edit Info modal form

**Existing Pages (still on disk but no longer routed)**
- `pages/PetersPence.tsx` — standalone Peter's Pence page (functionality replaced by report tab + family detail button)
- `pages/MonthlyDonationForm.tsx` — standalone monthly form (functionality handled via family detail donation modal)

**Backend**
- Added `PETERS_PENCE` donation type to seed defaults in `donations.ts`
- Applied `donation-schema.sql` to create donation tables (wards, units, donation_types, donation_family_info, donations, donation_receipts)

**Dashboard Fix**
- Fixed broken emoji rendering on dashboard stat cards — replaced unicode surrogate pair escape sequences with actual emoji characters in `Dashboard.tsx`

---

## [Unreleased] — 2026-03-26

### Enhanced — Comprehensive UI/UX Overhaul

**New Dependencies**
- Added `react-hot-toast` for global toast notifications
- Added `framer-motion` for page transitions and micro-animations

**New Reusable Components**
- `components/ui/Modal.tsx` — Animated modal with ESC key, body scroll lock, backdrop blur, size variants (sm/md/lg)
- `components/ui/ConfirmDialog.tsx` — Animated confirmation dialog with danger/warning/info variants, loading state
- `components/ui/EmptyState.tsx` — Animated empty state with icon, title, description, optional action
- `components/ui/Skeleton.tsx` — Shimmer skeleton loaders (SkeletonCard, SkeletonTable, SkeletonRow)
- `components/ui/Breadcrumb.tsx` — Breadcrumb navigation with home icon and chevron separators
- `components/ErrorBoundary.tsx` — React error boundary with styled error page and refresh button
- `hooks/useDebounce.ts` — Generic debounce hook (default 300ms)

**Global Styles (`index.css`)**
- Added shimmer keyframe animation for skeleton loading
- Added badge design system: badge-success, badge-danger, badge-warning, badge-info, badge-neutral
- Added button classes: btn-danger, btn-ghost
- Added table-header and table-cell utility classes
- Enhanced focus-visible styles, scrollbar styling

**Layout (`Layout.tsx`)**
- Replaced emoji nav icons with SVG Heroicons
- Added collapsible sidebar with toggle button and tooltips
- Gradient active nav item styling
- AnimatePresence page transitions on route change
- Gradient user avatar, SVG sign-out icon

**Login Page**
- Removed hardcoded demo credentials (security fix)
- Added gradient background with decorative blur circles
- SVG icon inputs (email, lock), gradient submit button with loading spinner
- Framer-motion staggered animations

**Dashboard**
- SkeletonCard loading states, motion-animated chart cards
- Quick actions with descriptions and stagger animations
- Badge-styled pending sacraments

**Families Page**
- Debounced auto-search (replaces manual form submit)
- Uses Modal, ConfirmDialog, EmptyState, SkeletonTable
- Toast notifications for all CRUD operations
- Extracted FamilyForm sub-component to deduplicate create/edit modals

**People Page**
- Same pattern as Families: debounced search, Modal, ConfirmDialog, EmptyState, SkeletonTable
- Extracted PersonFormFields sub-component, toast notifications

**FamilyDetail Page**
- Breadcrumb navigation, Modal component for all modals
- Member cards with colored avatar initials instead of emoji
- Toast notifications, SkeletonCard loading

**PersonDetail Page**
- Breadcrumb navigation, animated sacramental timeline
- Gradient dots, SVG checkmarks and info icons
- Modal component for sacrament recording, toast notifications

**Sacraments Page**
- Debounced person name and celebrant search
- Uses SkeletonTable, EmptyState, badge classes, motion animations
- SVG export icon, toast notifications

**Certificates Page**
- Debounced search with clear button
- Uses SkeletonTable, EmptyState, badge classes for request statuses
- SVG print icon, toast notifications on request updates

**DonationDashboard Page**
- SVG stat card icons (replacing emoji), motion-animated cards
- SkeletonCard loading, rounded-2xl card styling
- Toast notifications on export, improved chart tooltips

**DonationRegister Page**
- Replaced `confirm()` with ConfirmDialog component
- Replaced inline modal with Modal component
- Toast notifications for all CRUD and receipt operations
- SkeletonTable, EmptyState with action CTA
- SVG receipt icon, motion row animations

**DonationReports Page**
- Removed `dangerouslySetInnerHTML` — replaced with proper DefaulterTable component using badge for balance due
- Motion-animated tables and charts, improved tooltip styling
- EmptyState for no-defaulters view, toast notifications

**Admin Page**
- Replaced `alert()` calls with toast notifications
- Replaced inline modals with Modal and ConfirmDialog components
- SVG tab icons (replacing emoji), badge classes for roles/status/audit actions
- SkeletonCard/SkeletonTable loading, motion animations
- SVG logo upload icon, improved form styling

**App.tsx**
- Wrapped entire app in ErrorBoundary component

---

## [Unreleased] — 2026-03-22

### Changed — Father Name & Mother Name Required
- **Backend** (`people.ts`): `fatherName` and `motherName` changed from optional to required (`z.string().min(1)`) in person schema
- **Frontend** (`People.tsx`): Father Name and Mother Name fields now marked required (`*`) with validation in both New Person and Edit Person modals

---

## [Unreleased] — 2026-03-21

### Fixed — QR Code & Parent Name Fields
- **Frontend**: Certificate preview now displays an actual scannable QR code instead of a static SVG icon placeholder
- **Backend**: `/certificates/data/:sacramentId` endpoint now generates and returns a QR code data URL (`qrDataUrl`) using existing certificate tokens or a preview token
- **Database**: Added `father_name` and `mother_name` columns to `people` table (VARCHAR 200)
- **Backend**: `personSchema` validation, POST (create) and PUT (update) endpoints now support `fatherName` and `motherName` fields
- **Frontend**: Added Father Name and Mother Name input fields to both New Person and Edit Person modals
- **Frontend**: `Person` TypeScript interface updated with `fatherName`/`father_name` and `motherName`/`mother_name` properties
- **Backend**: Certificate data endpoint now uses person's `father_name`/`mother_name` as primary source, falling back to family membership relationships

### Changed — Record Sacrament Form Labels
- **Frontend**: Renamed "Celebrant" label to "Minister" in the Record Sacrament modal (`PersonDetail.tsx`)
- **Frontend**: Replaced single "Sponsors (comma-separated names)" field with separate "Godfather" and "Godmother" input fields
- **Frontend**: Sponsors now saved with proper roles (`godfather`/`godmother`) instead of generic `godparent`

### Changed — Certificate Template Redesign (Aligonda Letterhead Style)
- **Frontend**: Rewrote `CertificatePreview.tsx` with new Aligonda letterhead-style certificate design
  - Narrative body text format (prose-style "This is to certify that…") instead of bilingual Odia/English table layout
  - Parish logo and parish name/diocese dynamically loaded from admin settings (not hardcoded)
  - Navy (#1B3A5C) church name with Cinzel font, Cinzel Decorative certificate title in maroon (#6B1D2A)
  - Triple gold border frame, 80px corner ornaments with detailed SVG paths, cross watermark
  - Elegant typography: Cinzel for headings, Cormorant Garamond for body, gold gradient dividers
  - Maroon navigation bar with Back and Print buttons, hidden on print
  - Marriage certificate uses section headers (Groom/Bride) with field tables
  - QR code placeholder and "Ad Majorem Dei Gloriam" motto footer
  - Full `@media print` and mobile responsive support
  - CSS class names prefixed with `c-` for isolation from Tailwind

### Added — Sacrament Certificate Generation
- **Backend**: New `GET /certificates/data/:sacramentId` endpoint returning enriched certificate data (person, parents, parish, cross-referenced sacraments, marriage/holy orders details)
- **Frontend**: Redesigned `Certificates.tsx` — "Generate" tab to search completed sacraments and print certificates, plus "Requests" tab for admin request management
- **Frontend**: All 7 sacrament types supported: Baptism, First Holy Communion, Confirmation, First Confession, Marriage, Holy Orders, Anointing of the Sick
- **Frontend**: Certificate fields auto-populated from database (person name, parents, DOB, celebrant, sponsors, register info, cross-referenced baptism/confirmation dates)
- **Frontend**: PersonDetail certificate button now opens print preview instead of downloading PDF
- **Frontend**: Re-added Certificates to sidebar navigation with route `/certificates` and standalone print route `/certificates/print/:sacramentId`

### Removed
- **Dashboard**: Removed Certificates stat card, Pending Requests stat card, "Recent Certificates" panel, and "Generate Certificate" quick action from Dashboard

### Added — Donation Management Module (ପୁଣ୍ୟପୀଠ ଚାନ୍ଦା)

- **Database**: New tables — `wards`, `units`, `donation_types`, `donation_family_info`, `donations`, `donation_receipts` (`backend/src/db/donation-schema.sql`)
- **Backend**: Full donation API route (`backend/src/routes/donations.ts`) with 30+ endpoints:
  - Donation CRUD, family donation grid (12-month × type), dashboard stats
  - Ward/unit/donation-type management
  - Monthly register with pagination and Excel export
  - Receipt generation with bilingual Odia/English amount-in-words
  - Receipt PDF generation via Puppeteer
  - Reports: ward collection, family summary, defaulters, festival collection, year comparison
  - All reports exportable to Excel
- **Backend utilities**: `excel.ts` (SheetJS), `number-to-words.ts` (Odia + English)
- **Frontend**: 3 new pages — `DonationDashboard.tsx`, `DonationRegister.tsx`, `DonationReports.tsx`
  - Dashboard: annual stats, monthly bar chart, type pie chart, top 10 donors
  - Register: monthly donation log with create/edit/delete, receipt generation, Excel export
  - Reports: 5 tabs (ward, family, defaulters, festival, year comparison)
- **Family integration**: Donation card/grid embedded in `FamilyDetail.tsx` with:
  - Donation family info (card number, ward, unit, monthly pledge)
  - 12-month payment grid with clickable cells to record donations
  - Annual summary with balance due
- **Theme**: Maroon (#800020) / gold (#D4AF37) / cream (#FFF8DC) for donation pages
- **Font**: Noto Sans Oriya added for Odia script support
- **Bilingual labels**: Odia (primary) + English inline labels via `donationLabels.ts`
- **Navigation**: "Donations" (💰) added to sidebar, routes added to `App.tsx`
- **Dashboard integration**: YTD Donations stat card and "Record Donation" quick action
- **Dependencies**: `xlsx` (SheetJS) added to backend for Excel export
- **Docs**: Updated `KNOWLEDGEBASE.md` (donation domain approved), `ARCHITECTURE.md` (routes, tables, utilities)

---

## [Unreleased] — 2026-03-17

### Added — `start.sh` and `stop.sh` Linux service scripts

- Created `start.sh`: starts PostgreSQL (systemctl), waits for it to be ready, starts backend via PM2, starts Nginx. Prints the public IP when done.
- Created `stop.sh`: stops backend (PM2), frontend port, and PostgreSQL (systemctl).
- Both scripts are Linux/EC2 equivalents of `start.bat` / `stop.bat`.
- Referenced in `EC2-MIGRATION.md` under new "Starting Services" and "Stopping Services" sections.

---

### Added — `stop.sh` Linux service shutdown script

- Created `stop.sh` at the project root as a Linux/EC2 equivalent of `stop.bat`.
- Stops services in order: Backend API (PM2 / port 4000), Frontend (port 5173), PostgreSQL (`systemctl`).
- Referenced in `EC2-MIGRATION.md` under a new "Stopping Services" section.

---

### Added — `EC2-MIGRATION.md` deployment guide

- Created `EC2-MIGRATION.md` at the project root with a full step-by-step guide to migrate the app to an AWS EC2 instance.
- Covers: EC2 provisioning, security group rules, PostgreSQL setup, backend build + PM2, frontend Vite build + Nginx reverse proxy, HTTPS via Certbot, and daily pg_dump backups.

---

### Updated — `STEPS.md` documentation

- **Step 7** (Start servers) — added **Option A: `start.bat`** as the recommended Windows method with a description of what it does.
- **Step 7b** (new section) — added stop instructions with **Option A: `stop.bat`** and a manual fallback.
- **Step 10** (Explore the app) — updated Sacraments module description to mention person name filter.
- **Troubleshooting** — added two new rows: `stop.bat` "no process found" and sacrament filter usage tip.
- **Project Structure** — added `CHANGELOG.md`, `start.bat`, and `stop.bat` entries.
- Updated footer timestamp to `2026-03-17`.

---

### Added — `stop.bat` service shutdown script

- **Created `stop.bat`** at the project root, mirroring `start.bat`.
- Stops services in reverse order:
  1. **Backend API** — kills the process listening on port `4000` using `netstat` + `taskkill`.
  2. **Frontend** — kills the process listening on port `5173` using the same method.
  3. **PostgreSQL (Docker)** — runs `docker stop parish-postgres`.
- Each step prints a status line so the user can see what was stopped.

---

### Fixed — Sacraments Page: Search & Filter Not Working

**Issue:** The Sacraments page filters (sacrament type tabs, date range, celebrant) were not returning filtered results. Additionally, there was no way to search records by person name.

#### Backend — `backend/src/routes/sacraments.ts`

- **Added `personName` query parameter** to the `GET /api/sacraments` route.
- **Added SQL condition** for person name search:
  - Matches against `p.first_name`, `p.last_name`, or the full name (`first_name + ' ' + last_name`) using `ILIKE` (case-insensitive, partial match).
  - Example: searching `"reyes"` will match `"Carmen Reyes"`.

```ts
// Before
const { typeCode, personId, celebrant, dateFrom, dateTo, status, ... } = req.query;

// After
const { typeCode, personId, personName, celebrant, dateFrom, dateTo, status, ... } = req.query;
if (personName) {
  conditions.push(`(p.first_name ILIKE $${idx} OR p.last_name ILIKE $${idx} OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $${idx})`);
  params.push(`%${personName}%`);
  idx++;
}
```

#### Frontend — `frontend/src/pages/Sacraments.tsx`

- **Added `personSearch` state variable** (`useState('')`).
- **Added "Search by person name…" input field** in the filter bar (placed before the celebrant field).
- **Updated `load()` function signature** to accept and pass `personSearch` as the `person` parameter, sent to the API as `personName`.
- **Updated `handleTabChange()`** to pass `personSearch` when switching sacrament type tabs.
- **Updated Clear button** to reset `personSearch` state and pass empty string to `load()`.

**Filter bar now includes:**
| Field | Filters By |
|---|---|
| Sacrament type tabs | `typeCode` — exact match on sacrament type |
| From / To date | `dateFrom` / `dateTo` — date range on `sacraments.date` |
| Person name input | `personName` — partial, case-insensitive match on `first_name` / `last_name` |
| Celebrant input | `celebrant` — partial, case-insensitive match on `sacraments.celebrant` |

---

*v1.0 — Initial release, March 2026*
