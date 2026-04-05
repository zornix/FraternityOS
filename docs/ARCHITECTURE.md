# Architecture — FraternityOS

Last updated: 2026-04-04

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Vercel                             │
│                                                         │
│  ┌─────────────────┐       ┌──────────────────────┐    │
│  │  Next.js (React) │       │  FastAPI (Python)     │    │
│  │  fratos/         │──────▶│  api/                 │    │
│  │  Port 3000       │ fetch │  Port 8000            │    │
│  └─────────────────┘       └──────────┬─────────────┘    │
│                                       │                  │
└───────────────────────────────────────┼──────────────────┘
                                        │ supabase-py
                                        ▼
                              ┌──────────────────┐
                              │   Supabase        │
                              │   (Postgres + Auth │
                              │    + Storage)      │
                              └──────────────────┘
```

### Layer responsibilities

| Layer | Tech | Role |
|-------|------|------|
| Frontend | Next.js 16, React 19, Tailwind 4 | UI shell, pages, forms, mock mode for dev |
| Backend API | FastAPI (Python) | Business logic, auth middleware, CRUD, check-in validation, delinquency scoring, cron |
| Database | Supabase (Postgres) | Persistence, RLS, Auth (JWT issuance), Storage (future: photos) |
| Hosting | Vercel | Serverless functions (FastAPI), static build (Next.js), Cron |

### Why this split?

**FastAPI sits between the frontend and Supabase** rather than having the frontend
talk to Supabase directly. This gives us a place for business logic that's hard to
express in RLS policies or client-side code:

- **Check-in validation**: verifying link expiry, chapter match, duplicate prevention
- **Auto-fine generation**: cron job that scans events and issues fines server-side
- **Delinquency scoring**: aggregating attendance, excuses, and fines into a single score
- **Invite flow**: creating both a Supabase Auth user and a `members` row in one transaction
- **Role enforcement**: `require_officer` dependency rejects non-officers before any DB call

The frontend uses Supabase Auth directly for session management (magic links, JWT
storage, refresh tokens) but routes all data operations through the FastAPI API.

---

## Project Structure

```
ChapterAttendance/
├── backend.py                  # Thin re-export for Vercel / uvicorn
├── api/                        # FastAPI backend
│   ├── index.py                # App factory, CORS, router registration
│   ├── config.py               # Settings via pydantic-settings (.env)
│   ├── db.py                   # Supabase client factories (anon + admin)
│   ├── dependencies.py         # Auth guards: get_current_user, require_officer
│   ├── models/
│   │   └── schemas.py          # Pydantic request/response models
│   ├── routes/
│   │   ├── auth.py             # /api/auth/*
│   │   ├── events.py           # /api/events/*
│   │   ├── attendance.py       # /api/attendance/*
│   │   ├── excuses.py          # /api/excuses/*
│   │   ├── fines.py            # /api/fines/*
│   │   ├── members.py          # /api/members/*
│   │   ├── checkin_page.py     # /c/{code} — HTML check-in page
│   │   ├── cron.py             # /api/cron/*
│   │   └── delinquency.py      # /api/delinquency/*
│   └── services/
│       ├── checkin_links.py    # Short link generation + validation
│       ├── delinquency.py      # Engagement scoring engine
│       └── fine_processor.py   # Auto-fine generation after events
├── fratos/                     # Next.js frontend
│   ├── app/                    # App Router (layout, page, globals.css)
│   ├── lib/                    # types, config, theme, api-client
│   ├── hooks/                  # use-auth, use-api
│   ├── components/             # ui/ primitives + forms/
│   ├── pages/                  # dashboard, events, fines, members, delinquency
│   ├── mocks/                  # mock-db, mock-api
│   └── e2e/                    # Playwright specs + fixtures
└── docs/                       # This knowledge base
```

### Backend module responsibilities

| Module | What it does |
|--------|-------------|
| `index.py` | Creates the FastAPI `app`, registers CORS middleware (allowing `FRONTEND_URL` + localhost), mounts all routers with `/api/` prefixes (except check-in page at `/c/`), exposes `/api/health`. |
| `config.py` | Uses `pydantic-settings` to load env vars from `.env`: Supabase credentials, frontend URL, base URL, check-in TTL. Validates at startup — missing vars cause immediate failure. |
| `db.py` | Two Supabase client factories: `get_supabase()` (anon key, respects RLS) and `get_supabase_admin()` (service role key, bypasses RLS). Each call creates a fresh client; no connection pooling. |
| `dependencies.py` | `get_current_user` extracts JWT from `Authorization` header, validates via `supabase.auth.get_user()`, looks up `members` by `auth_id` with a chapters join. `require_officer` chains on top to enforce `role=officer`. |
| `models/schemas.py` | Pydantic models for request validation (`EventCreate`, `PhoneCheckIn`, `ExcuseCreate`, etc.) and response serialization (`EventResponse`, `CheckInLinkResponse`, `DelinquencyScore`, etc.). |
| `services/checkin_links.py` | Generates 6-char codes using `secrets.choice`, handles collision retry, validates active+non-expired links with event join. |
| `services/delinquency.py` | Computes per-member engagement scores: weighted attendance (70%), excuses (20%), fine penalty (10%). Returns sorted list, lowest score first. |
| `services/fine_processor.py` | Processes a single event: finds active members with no attendance and no approved excuse, inserts unpaid fines. Idempotent — skips members who already have a fine for that event. |

### Frontend module responsibilities

| Module | What it does |
|--------|-------------|
| `app/` | Next.js App Router entry: `layout.tsx` sets global styles, `page.tsx` renders the `FraternityOS` shell component. |
| `fraternity-os-frontend.tsx` | App shell: sidebar navigation (Dashboard, Events, Fines, Members, Delinquency), demo user switcher in mock mode, page routing via `PageId` state. |
| `lib/api-client.ts` | `ApiClient` class with typed methods for every API endpoint. Routes through `mockApi.fetch()` when `USE_MOCKS=true`, otherwise through `fetch()` to the real backend. Attaches JWT via `Authorization` header when set. |
| `lib/types.ts` | TypeScript interfaces mirroring backend schemas: `Member`, `Event`, `Fine`, `DelinquencyScore`, `SecurityAssignment`, etc. |
| `hooks/use-auth.tsx` | `AuthProvider` context with login/logout/demoLogin. Production Supabase session code is present but commented out. |
| `hooks/use-api.ts` | Generic data-fetching hook: takes a fetch function, returns `{ data, loading, error, reload }`. Re-fetches on dependency changes. |
| `mocks/mock-api.ts` | Full mock API router that simulates every endpoint using in-memory data from `mock-db.ts`. Matches URL patterns, returns typed responses with a 200ms artificial delay. |
| `pages/delinquency.tsx` | Officer-only page: score table with progress bars, stat cards, member drill-down, security auto-assignment modal, per-member reminder buttons. |

---

## Database Schema

All tables live in Supabase Postgres. Multi-tenancy is via `chapter_id` on every row.

### chapters
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Chapter name (e.g. "Delta Mu") |
| organization | text | Greek org (e.g. "TKE") |
| school | text | University name |
| created_at | timestamptz | |

### members
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| auth_id | uuid | FK to `auth.users`, unique — links Supabase Auth identity |
| chapter_id | uuid | FK to chapters |
| name | text | |
| email | text | unique |
| phone | text | unique, 9 digits — used for phone check-in |
| role | text | `officer` or `member` |
| status | text | `active`, `inactive`, `alumni` |
| created_at | timestamptz | |

### events
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| chapter_id | uuid | FK to chapters |
| title | text | |
| description | text | nullable |
| date | date | |
| time | time | |
| location | text | |
| required | boolean | If true, absence generates fine |
| fine_amount | decimal(10,2) | Amount charged for unexcused absence |
| created_by | uuid | FK to members (the officer who created it) |
| created_at | timestamptz | |

### attendance
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| event_id | uuid | FK to events |
| member_id | uuid | FK to members |
| checked_in | boolean | |
| checked_in_at | timestamptz | Precise timestamp for audit |
| method | text | `link` (via short code) or `manual` (officer override) |
| | | unique(event_id, member_id) — one record per member per event |

### excuses
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| event_id | uuid | FK to events |
| member_id | uuid | FK to members |
| reason | text | Free-text reason provided by member |
| status | text | `pending`, `approved`, `denied` |
| reviewed_by | uuid | FK to members, nullable (the officer who reviewed) |
| reviewed_at | timestamptz | nullable |
| submitted_at | timestamptz | |
| | | unique(event_id, member_id) — one active excuse per member per event |

**Resubmission logic:** when a member resubmits after denial, the backend deletes the
denied row first, then inserts a new one. This keeps the unique constraint happy while
allowing retries.

### fines
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| event_id | uuid | FK to events, nullable (allows manual fines not tied to events) |
| member_id | uuid | FK to members |
| chapter_id | uuid | FK to chapters |
| amount | decimal(10,2) | Dollar amount |
| reason | text | Auto-generated: "Missed: {event_title}" or custom |
| status | text | `unpaid` → `paid` (by member) or `waived` (by officer) |
| issued_at | timestamptz | |
| paid_at | timestamptz | nullable — set when member pays |
| waived_by | uuid | FK to members, nullable — the officer who waived |

### checkin_links
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| event_id | uuid | FK to events |
| short_code | text | unique, 6-char alphanumeric |
| created_by | uuid | FK to members (the officer) |
| expires_at | timestamptz | `created_at + TTL` (default 10 min) |
| active | boolean | Officer can deactivate early; also set false when new link generated |
| created_at | timestamptz | |

---

## Auth Flow

Two auth paths exist, each designed for a different context:

### Path 1: JWT (Supabase Magic Link) — for the main dashboard

Used by officers and members accessing the full dashboard (events, fines, excuses, members, delinquency).

1. Officer invites member by email via `POST /api/auth/invite`
   - Supabase Admin SDK: `invite_user_by_email()` sends magic link
   - Backend upserts member into `members` table with email-derived name
2. Member clicks link in email → Supabase creates session, issues JWT + refresh token
3. Frontend's `onAuthStateChange` detects session → stores JWT via Supabase JS client
4. `api-client.ts` attaches JWT to every request: `Authorization: Bearer <jwt>`
5. Backend `get_current_user` dependency:
   - Strips "Bearer " prefix, calls `supabase.auth.get_user(token)`
   - Looks up `members` by `auth_id` (from `auth.users`) with chapter join
   - Returns full member record (id, name, email, role, chapter_id)
6. `require_officer` chains on top: checks `role == "officer"`, returns 403 otherwise

### Path 2: Phone Number — for meeting check-in

Used by members physically present at an event. No app login required.

1. Officer generates check-in link → 6-char short code with 10-min TTL
2. Officer shares `/c/{code}` (verbally, QR code, or group chat)
3. Member opens link on phone → FastAPI serves lightweight HTML page
4. Member enters 9-digit phone number → `POST /api/attendance/checkin/{code}/phone`
5. Backend validates: link active + not expired → looks up member by `phone + chapter_id`
6. Attendance recorded with `method='link'`. No JWT, no Supabase SDK on client.

### Why two paths?

The dashboard needs persistent sessions (viewing fines, submitting excuses, managing events).
Check-in needs zero friction (5 seconds, no account). Phone check-in was added because
magic link email on mobile during a meeting is too slow and causes drop-off.

---

## Check-In Link Lifecycle

```
Officer taps "Open Check-In"
        │
        ▼
POST /api/events/{id}/checkin-link
        │
        ├─► Deactivates any existing active link for this event
        ├─► Generates 6-char code (secrets.choice, collision retry x5)
        ├─► Inserts into checkin_links with expires_at = now + TTL
        └─► Returns { short_code, url, expires_at }
              │
              ▼
        Members open /c/{code}
              │
              ├─► FastAPI serves HTML page (checkin_page.py)
              ├─► Page shows event title, date, location
              ├─► Member enters 9-digit phone number
              └─► POST /api/attendance/checkin/{code}/phone
                    │
                    ├─► Validates: link exists, active=true, expires_at >= now
                    ├─► Looks up member: phone + chapter_id + active
                    ├─► Checks duplicate: existing checked_in for this event+member
                    └─► Upserts attendance record, returns success
```

**Expiry:** link becomes invalid after `CHECKIN_LINK_TTL_MINUTES` (default 10, configurable in `.env`).

**Officer kill switch:** `DELETE /api/events/{id}/checkin-link` sets `active=false` on all active links for that event.

**Anti-forwarding:** short TTL + officer kill switch + audit timestamps (`checked_in_at`).
An officer can review the timestamps after the event to spot anomalies.

---

## Delinquency Scoring Engine

The scoring system lives in `api/services/delinquency.py` and computes a 0-100 engagement
score for each active member in a chapter.

### Data sources

| Source | What it provides |
|--------|-----------------|
| `events` table | Required events where `date <= now` (only past required events count) |
| `attendance` table | Which members checked in to which events |
| `excuses` table | Approved excuses (partial credit for absence) |
| `fines` table | Unpaid fines (penalty factor) |

### Score formula

```
score = (attendance_pct × 70) + (excuse_pct × 20) + ((1 - fine_penalty) × 10)
```

| Component | Weight | Calculation |
|-----------|--------|-------------|
| Attendance | 70% | `attended / total_required` — fraction of required events attended |
| Excuses | 20% | `excused / total_required` — approved excuses for events not attended |
| Fine penalty | 10% | `min(unpaid_amount / $200, 0.10)` — caps at full 10% penalty |

A member with perfect attendance and no unpaid fines scores 100. A member who missed
everything and owes $200+ scores 0.

### Outputs

- **Score table** (`GET /api/delinquency/scores`): all members ranked by score, ascending
- **Member detail** (`GET /api/delinquency/member/{id}`): per-event breakdown showing present/excused/pending/absent status and any associated fine
- **Security assignment** (`POST /api/delinquency/assign-security`): returns the bottom 3 members by score
- **Reminder** (`POST /api/delinquency/remind/{id}`): placeholder that returns unpaid fine summary (no actual notification sent yet)

---

## API Route Map

| Prefix | Module | Auth | Description |
|--------|--------|------|-------------|
| `/api/auth` | `routes/auth.py` | JWT (get_current_user, require_officer) | Login profile, bulk invite |
| `/api/events` | `routes/events.py` | JWT (reads: any member, writes: officer) | Event CRUD + check-in link management |
| `/api/attendance` | `routes/attendance.py` | JWT for roster/manual; **none** for phone check-in | Check-in recording + attendance roster |
| `/api/excuses` | `routes/excuses.py` | JWT | Submit, list (role-scoped), review |
| `/api/fines` | `routes/fines.py` | JWT | List (role-scoped), pay, waive, summary |
| `/api/members` | `routes/members.py` | JWT | Chapter roster, role management |
| `/api/delinquency` | `routes/delinquency.py` | JWT (require_officer) | Engagement scores, member detail, security picks, reminders |
| `/c` | `routes/checkin_page.py` | None (public HTML) | Serves phone check-in page |
| `/api/cron` | `routes/cron.py` | Optional header | Auto-fine generation |
| `/api/health` | `index.py` | None | Health check |

---

## Frontend Architecture

- **App Router** (`fratos/app/`): layout + single page that renders the shell
- **Shell** (`fraternity-os-frontend.tsx`): sidebar nav, page routing via `PageId` state, demo user switcher when `USE_MOCKS=true`
- **Pages** (`fratos/pages/`): dashboard, events, fines, members, delinquency
- **Mock toggle**: `NEXT_PUBLIC_USE_MOCKS=true` swaps `api-client.ts` to use `mock-api.ts` backed by `mock-db.ts`
- **UI primitives** (`components/ui/`): btn, card, badge, input, avatar, modal, toast, icon
- **Forms** (`components/forms/`): create-event, check-in, excuse

### Mock API architecture

The mock API (`mocks/mock-api.ts`) is a single `fetch()` replacement that pattern-matches
request URLs and methods against regex patterns. It operates on an in-memory database
(`mock-db.ts`) with pre-seeded members, events, attendance records, excuses, and fines.

Key design choices:
- 200ms artificial delay on every response to simulate network latency
- Stateful within a page session (mutations persist until reload)
- Replicates all backend validation logic (duplicate checks, role scoping, etc.)
- Mock delinquency scoring uses the same formula as the real backend

---

## Deployment

Vercel handles both layers:

- **FastAPI** runs as a serverless function via `@vercel/python`
  - Entry point: `backend.py` re-exports `app` from `api.index`
  - All `/api/*` routes are handled by this function
- **Next.js** builds to static output via `@vercel/static-build`
  - `fratos/` directory, output to `dist/`
  - All non-API routes serve the frontend
- **Cron**: `GET /api/cron/process-fines` every 15 minutes
  - Vercel Cron sends the request automatically
  - Optional: verify `Authorization` header matches Vercel Cron secret

### Environment variables (Vercel dashboard)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Public anon key (used for RLS-respecting queries) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (bypasses RLS, used for admin ops) |
| `FRONTEND_URL` | No | Defaults to `https://fraternityos.vercel.app` |
| `BASE_URL` | No | Used in check-in link URLs, defaults to `https://fraternityos.vercel.app` |
| `CHECKIN_LINK_TTL_MINUTES` | No | Check-in link expiry, defaults to 10 |
| `NEXT_PUBLIC_USE_MOCKS` | No | Set to `false` in production |
| `NEXT_PUBLIC_API_BASE` | No | API base URL (empty string if same-origin on Vercel) |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Same as `SUPABASE_URL`, for frontend Supabase JS client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Same as `SUPABASE_ANON_KEY`, for frontend |
