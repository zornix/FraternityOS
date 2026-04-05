# FraternityOS — Internal Operations Platform for Fraternities

## Stack Overview

| Layer | Tech | Why |
|-------|------|-----|
| Backend API | FastAPI (Python) | Async-native, auto-generates OpenAPI docs |
| Database | Supabase (Postgres) | Free tier, built-in auth, real-time subscriptions, RLS |
| Auth | Phone number (check-in) + Supabase Magic Link (dashboard) | Zero-friction onboarding |
| Hosting | Vercel | FastAPI via serverless functions, frontend as static build |
| Frontend | React + Next.js | Deployed alongside API on Vercel |
| E2E Tests | Playwright | Browser automation for full-stack testing |

## Documentation

Detailed design docs and project knowledge base live in `docs/`:

| Doc | Contents |
|-----|----------|
| [docs/FEATURES.md](docs/FEATURES.md) | Feature audit with completion status for every module |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, database schema, auth flows, deployment |
| [docs/PHONE_LOGIN.md](docs/PHONE_LOGIN.md) | Phone-number check-in design document |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Platform vision, task board, engagement system, phased priorities |

---

## Project Structure

```
ChapterAttendance/
├── backend.py                    # Thin re-export (Vercel entry point)
├── api/                          # FastAPI backend (modular package)
│   ├── index.py                  # App factory, CORS, router registration
│   ├── config.py                 # Settings (pydantic-settings, .env)
│   ├── db.py                     # Supabase client (anon + admin)
│   ├── dependencies.py           # Auth: get_current_user, require_officer
│   ├── models/
│   │   └── schemas.py            # Pydantic request/response models
│   ├── routes/
│   │   ├── auth.py               # /api/auth/* — login, invite
│   │   ├── events.py             # /api/events/* — CRUD + check-in links
│   │   ├── attendance.py         # /api/attendance/* — check-in, roster
│   │   ├── excuses.py            # /api/excuses/* — submit, review
│   │   ├── fines.py              # /api/fines/* — list, pay, waive
│   │   ├── members.py            # /api/members/* — roster, role mgmt
│   │   ├── checkin_page.py       # /c/{code} — HTML check-in page
│   │   ├── cron.py               # /api/cron/* — auto-fine processing
│   │   └── delinquency.py        # /api/delinquency/* — engagement scores, security
│   └── services/
│       ├── checkin_links.py      # Short link generation + validation
│       ├── delinquency.py        # Delinquency scoring engine
│       └── fine_processor.py     # Auto-fine generation after events
│
├── fratos/                       # Next.js frontend
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── lib/                      # Shared utilities
│   │   ├── types.ts              # TypeScript interfaces (Member, Event, etc.)
│   │   ├── config.ts             # Environment config (API_BASE, USE_MOCKS)
│   │   ├── theme.ts              # Design tokens (colors)
│   │   └── api-client.ts         # ApiClient class (typed, real/mock toggle)
│   ├── mocks/                    # Demo/test data layer
│   │   ├── mock-db.ts            # In-memory mock database
│   │   └── mock-api.ts           # Mock API router (simulates all endpoints)
│   ├── hooks/
│   │   ├── use-auth.tsx          # AuthContext, AuthProvider, useAuth
│   │   └── use-api.ts            # Generic data-fetching hook
│   ├── components/
│   │   ├── ui/                   # Atomic UI components
│   │   │   ├── icon.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── card.tsx
│   │   │   ├── btn.tsx
│   │   │   ├── input.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── modal.tsx
│   │   │   └── toast.tsx
│   │   ├── forms/
│   │   │   ├── create-event-form.tsx
│   │   │   ├── check-in-form.tsx
│   │   │   └── excuse-form.tsx
│   │   └── countdown.tsx
│   ├── pages/                    # Page-level components
│   │   ├── dashboard.tsx
│   │   ├── events.tsx
│   │   ├── fines.tsx
│   │   ├── members.tsx
│   │   └── delinquency.tsx       # Delinquency scores + security assignment
│   ├── fraternity-os-frontend.tsx  # App shell (sidebar + routing)
│   ├── e2e/                      # Playwright E2E tests
│   │   ├── fixtures/
│   │   │   └── auth.ts           # Login helpers
│   │   ├── auth.spec.ts
│   │   ├── events.spec.ts
│   │   ├── checkin.spec.ts
│   │   ├── excuses.spec.ts
│   │   ├── fines.spec.ts
│   │   └── members.spec.ts
│   ├── playwright.config.ts
│   └── package.json
│
├── docs/                        # Knowledge base & design docs
│   ├── FEATURES.md              # Feature audit (complete / incomplete)
│   ├── ARCHITECTURE.md          # System design & schema reference
│   ├── PHONE_LOGIN.md           # Phone check-in design doc
│   └── ROADMAP.md               # Platform vision & phased roadmap
│
└── README.MD
```

---

## Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- A Supabase project (or use mock mode for development)

### Frontend

```bash
cd fratos
npm install
npm run dev          # Start Next.js dev server on http://localhost:3000
```

Set `NEXT_PUBLIC_USE_MOCKS=true` in `.env.local` to use the built-in mock
backend (no Supabase needed). This is the default for development.

For production, set:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_BASE=
NEXT_PUBLIC_USE_MOCKS=false
```

### Backend

```bash
pip install fastapi uvicorn pydantic-settings supabase
uvicorn api.index:app --reload   # Start FastAPI on http://localhost:8000
```

Or using the re-export entry point:
```bash
uvicorn backend:app --reload
```

Required `.env`:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Running Tests

### E2E Tests (Playwright)

```bash
cd fratos
npx playwright install chromium   # First time only
npm run test:e2e                  # Run all E2E tests
npm run test:e2e:ui               # Interactive UI mode
```

Tests run against the Next.js dev server with mock mode enabled. The
Playwright config auto-starts the dev server if it's not already running.

### Test Coverage

| Suite | What it tests |
|-------|--------------|
| `auth.spec.ts` | Login page, demo login, magic link flow, logout |
| `events.spec.ts` | Event list, upcoming/past tabs, event detail, create event |
| `checkin.spec.ts` | Generate check-in link, close link, check-in form |
| `excuses.spec.ts` | Submit excuse, duplicate rejection, empty validation, officer review |
| `fines.spec.ts` | View fines, filter by status, pay fine, waive fine |
| `members.spec.ts` | View roster, role badges, all members visible |

---

## API Endpoints

### Auth
```
POST   /api/auth/invite          # Officer invites member(s) by email
GET    /api/auth/me              # Get current user profile
```

### Events
```
GET    /api/events               # List events (filterable: upcoming, past)
POST   /api/events               # Create event [officer]
GET    /api/events/{id}          # Event detail + attendance summary
PUT    /api/events/{id}          # Update event [officer]
DELETE /api/events/{id}          # Delete event [officer]
POST   /api/events/{id}/checkin-link    # Generate check-in link [officer]
DELETE /api/events/{id}/checkin-link    # Deactivate link [officer]
```

### Attendance
```
POST   /api/attendance/checkin/{code}          # Check in via short code (JWT)
POST   /api/attendance/checkin/{code}/phone    # Check in via phone number (no auth)
GET    /api/attendance/event/{id}              # Attendance roster [officer]
POST   /api/attendance/event/{id}/manual/{member_id}  # Manual check-in [officer]
```

### Excuses
```
POST   /api/excuses/event/{id}  # Submit excuse (validates chapter, allows resubmit after denial)
GET    /api/excuses             # List excuses (member: own, officer: all)
PUT    /api/excuses/{id}/review # Approve/deny [officer]
```

### Fines
```
GET    /api/fines               # List fines (member: own, officer: chapter)
POST   /api/fines/{id}/pay     # Mark as paid
POST   /api/fines/{id}/waive   # Waive fine [officer]
GET    /api/fines/summary      # Aggregate stats [officer]
```

### Members
```
GET    /api/members             # Chapter roster
PUT    /api/members/{id}/role   # Change role [officer]
```

### Delinquency
```
GET    /api/delinquency/scores                  # Ranked engagement scores [officer]
GET    /api/delinquency/member/{id}             # Per-event breakdown for one member [officer]
POST   /api/delinquency/assign-security         # Auto-pick lowest-scoring members [officer]
POST   /api/delinquency/remind/{id}             # Send payment/engagement reminder [officer]
```

### Cron
```
GET    /api/cron/process-fines  # Auto-fine generation (Vercel Cron)
```

---

## Authentication Strategy

### Two Auth Paths

**Phone Number (meeting check-in):** Members enter their 9-digit phone number
on the check-in page. No account, no password, no app login. The check-in link
acts as location proof, the phone number acts as identity proof.

**Magic Links (dashboard access):** For the full dashboard (events, fines,
excuses management), officers and members authenticate via Supabase magic link
email. Supabase handles JWT issuance, refresh tokens, session management.

### Dashboard Auth Flow
1. Officer creates chapter -> adds member emails in bulk
2. Supabase sends magic link to each email
3. Member clicks link -> Supabase creates session -> JWT issued
4. Frontend stores JWT (Supabase JS client handles this)
5. Every API request sends JWT in Authorization header
6. FastAPI middleware validates JWT against Supabase

### Role-Based Access
Roles stored in `members` table (`officer` / `member`). FastAPI dependency
injection (`require_officer`) handles authorization.

---

## Database Schema (Supabase / Postgres)

```sql
-- Chapters (multi-tenancy ready)
create table chapters (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    organization text not null,
    school text not null,
    created_at timestamptz default now()
);

-- Members (linked to Supabase Auth)
create table members (
    id uuid primary key default gen_random_uuid(),
    auth_id uuid unique references auth.users(id),
    chapter_id uuid references chapters(id) not null,
    name text not null,
    email text unique not null,
    phone text unique,
    role text check (role in ('officer', 'member')) default 'member',
    status text check (status in ('active', 'inactive', 'alumni')) default 'active',
    created_at timestamptz default now()
);

-- Events
create table events (
    id uuid primary key default gen_random_uuid(),
    chapter_id uuid references chapters(id) not null,
    title text not null,
    description text,
    date date not null,
    time time not null,
    location text not null,
    required boolean default false,
    fine_amount decimal(10,2) default 0,
    created_by uuid references members(id),
    created_at timestamptz default now()
);

-- Attendance
create table attendance (
    id uuid primary key default gen_random_uuid(),
    event_id uuid references events(id) not null,
    member_id uuid references members(id) not null,
    checked_in boolean default false,
    checked_in_at timestamptz,
    method text check (method in ('link', 'manual')) default 'link',
    unique(event_id, member_id)
);

-- Excuses
create table excuses (
    id uuid primary key default gen_random_uuid(),
    event_id uuid references events(id) not null,
    member_id uuid references members(id) not null,
    reason text not null,
    status text check (status in ('pending', 'approved', 'denied')) default 'pending',
    reviewed_by uuid references members(id),
    reviewed_at timestamptz,
    submitted_at timestamptz default now(),
    unique(event_id, member_id)
);

-- Fines
create table fines (
    id uuid primary key default gen_random_uuid(),
    event_id uuid references events(id),
    member_id uuid references members(id) not null,
    chapter_id uuid references chapters(id) not null,
    amount decimal(10,2) not null,
    reason text not null,
    status text check (status in ('unpaid', 'paid', 'waived')) default 'unpaid',
    issued_at timestamptz default now(),
    paid_at timestamptz,
    waived_by uuid references members(id)
);

-- Check-in links
create table checkin_links (
    id uuid primary key default gen_random_uuid(),
    event_id uuid references events(id) not null,
    short_code text unique not null,
    created_by uuid references members(id) not null,
    expires_at timestamptz not null,
    active boolean default true,
    created_at timestamptz default now()
);
```

---

## QR / Link Check-In Logic

1. Officer taps "Open Check-In" -> generates 6-char short code (e.g. `A7x9Kp`)
2. Code is valid for N minutes (default 10), shown on officer's phone
3. Members physically present open `/c/{code}` on their phone
4. Page shows a phone number input — member enters their 9-digit number
5. Backend looks up member by phone + chapter, records attendance
6. After TTL expires, link is dead

No Supabase session, JWT, or app login required for check-in. The check-in page
is a standalone HTML form served by FastAPI. See [docs/PHONE_LOGIN.md](docs/PHONE_LOGIN.md)
for the full design.

Anti-forwarding: short TTL + officer can kill link early + audit timestamps.

---

## Vercel Deployment

```json
{
  "builds": [
    { "src": "api/index.py", "use": "@vercel/python" },
    { "src": "fratos/package.json", "use": "@vercel/static-build", "config": { "distDir": "dist" } }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "api/index.py" },
    { "src": "/(.*)", "dest": "/fratos/dist/$1" }
  ],
  "crons": [{
    "path": "/api/cron/process-fines",
    "schedule": "*/15 * * * *"
  }]
}
```

### Environment Variables (Vercel dashboard)
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_USE_MOCKS=false
```

---

## Key Decisions

**Why magic links over OAuth?**
Not every brother uses the same email provider. Magic links work with any email.

**Why FastAPI + Supabase (not just Supabase client)?**
FastAPI gives a place for business logic (check-in validation, auto-fines) that's
hard to express in RLS policies alone. Hybrid: Supabase Auth in frontend, FastAPI
for business logic.

**Why mock mode?**
Enables frontend development and E2E testing without a Supabase instance. Toggle
via `NEXT_PUBLIC_USE_MOCKS` environment variable.

**Multi-tenancy from day one.**
`chapter_id` on every table means you can onboard other chapters without schema changes.
