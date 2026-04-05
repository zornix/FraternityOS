# Feature Audit — FraternityOS

Last updated: 2026-04-04

A feature is marked **COMPLETE** only when a working frontend-to-backend loop exists
(i.e. the frontend calls the real API and the backend persists to the database).
Mock-mode-only frontend pages count as **INCOMPLETE**.

---

## Status Summary

| Feature | Status |
|---------|--------|
| Auth (Magic Link) | INCOMPLETE |
| Events CRUD | INCOMPLETE |
| Check-In Links | INCOMPLETE |
| Attendance — Phone Check-In | COMPLETE |
| Attendance — JWT Check-In | INCOMPLETE |
| Excuses | INCOMPLETE |
| Fines | INCOMPLETE |
| Auto-Fine Processing (Cron) | BACKEND COMPLETE |
| Members Roster | INCOMPLETE |
| Delinquency Tracking | INCOMPLETE |

---

## Detailed Breakdown

### Auth (Magic Link)

| Layer | State |
|-------|-------|
| Backend | **Done.** `GET /api/auth/me` returns profile with chapter name via join. `POST /api/auth/invite` bulk-invites via Supabase Admin — creates `auth.users` entry and upserts into `members` table in one pass. |
| Frontend | **Mock only.** `hooks/use-auth.tsx` has production Supabase session code commented out (lines 30-37). Login screen shows email input + demo quick-login buttons. The `AuthProvider` wrapper already handles session state; the Supabase `onAuthStateChange` listener is stubbed. |
| Gap | Uncomment and wire the Supabase session check in `use-auth.tsx`. Once live, every `api-client.ts` request will automatically include the JWT via `setToken()`. |

**How it works (production path):**
1. Officer calls `POST /api/auth/invite` with a list of emails
2. Supabase Admin SDK sends magic link email to each address
3. Backend upserts each email into `members` with `status=active` and `role=member`
4. Recipient clicks the magic link → Supabase creates a session and issues a JWT
5. Frontend `onAuthStateChange` fires → stores session → calls `api.setToken(jwt)`
6. `GET /api/auth/me` validates JWT against Supabase Auth, looks up `members` by `auth_id`, returns profile with chapter data

### Events CRUD

| Layer | State |
|-------|-------|
| Backend | **Done.** List (with upcoming/past ordering), create, get (with attendance count), update (partial, `exclude_none`), delete. All write operations are officer-gated via `require_officer` dependency. `date` and `time` fields are serialized to ISO format before Supabase insert. |
| Frontend | **Mock only.** `pages/events.tsx` renders upcoming/past tabs, event detail view with attendance roster, and officer controls (create, delete). `components/forms/create-event-form.tsx` collects all event fields. |
| Gap | Point `api-client.ts` at real backend when `USE_MOCKS=false`. The non-mock branch is wired but the auth token is never set in production because `use-auth.tsx` session code is commented out. |

**Event lifecycle:**
1. Officer creates event → stored with `chapter_id`, `created_by`, optional `fine_amount`
2. Event appears in list for all chapter members
3. When `required=true` and `fine_amount > 0`, absence after the event date triggers auto-fines via the cron job
4. Officer can update or delete the event at any time
5. `GET /api/events/{id}` returns the event with a live `attendance_count` from the attendance table

### Check-In Links

| Layer | State |
|-------|-------|
| Backend | **Done.** `POST /api/events/{id}/checkin-link` generates a cryptographically random 6-char code with configurable TTL (default 10 min). `DELETE` deactivates. `services/checkin_links.py` handles generation with collision retry (up to 5 attempts) and validation with expiry + active check. |
| Frontend | **Mock only.** `components/forms/check-in-form.tsx` + `countdown.tsx` simulate the flow. The events page shows the active link card with a countdown timer and the short code in monospace. |
| Gap | Same auth wiring issue as Events. |

**Link generation flow:**
1. Officer hits "Open Check-In" → `POST /api/events/{id}/checkin-link`
2. Backend deactivates any existing active link for that event (ensures only one active link per event)
3. Generates 6-char code from `[A-Za-z0-9]` (~56 billion combinations) using `secrets.choice`
4. Inserts into `checkin_links` with `expires_at = now + TTL`
5. Returns `{ short_code, url, expires_at }`
6. If code collides (unique constraint), retries up to 5 times with a new random code

### Attendance — Phone Check-In

| Layer | State |
|-------|-------|
| Backend | **Done.** `POST /api/attendance/checkin/{code}/phone` accepts `{ phone }`, strips non-digits via Pydantic validator, looks up member by `phone + chapter_id + active status`, checks for duplicates, upserts attendance record. No JWT required — the link itself is the auth. |
| Frontend | **Done.** `/c/{short_code}` HTML page (served by FastAPI, no React) renders a phone number input with auto-formatting (XXX-XXX-XXX), disables submit until 9 digits, POSTs to the phone endpoint, and shows success/error inline. |
| Gap | None — this is a self-contained loop. Requires `phone` column populated on `members` table in prod. |

**Validation chain:**
1. `PhoneCheckIn` Pydantic model strips all non-digit characters, enforces exactly 9 digits
2. `validate_checkin_link()` checks: link exists, `active=true`, `expires_at >= now`
3. Member lookup: `phone + chapter_id (from event) + status=active` — 404 if not found
4. Duplicate check: query attendance for existing check-in on this event+member — 409 if already checked in
5. Upsert: `on_conflict="event_id,member_id"` to handle race conditions gracefully

### Attendance — JWT Check-In

| Layer | State |
|-------|-------|
| Backend | **Done.** `POST /api/attendance/checkin/{code}` validates JWT + link + chapter match. `GET /api/attendance/event/{id}` returns full roster with check-in status, timestamps, methods, and excuse statuses. `POST .../manual/{member_id}` for officer manual check-ins. |
| Frontend | **Replaced by phone flow** on the HTML check-in page. The JWT endpoint still exists for programmatic use (e.g., a future mobile app could use it). Dashboard attendance views in `pages/events.tsx` show the roster but pull from mock data. |
| Gap | Frontend dashboard attendance views still mock-only. |

### Excuses

| Layer | State |
|-------|-------|
| Backend | **Done.** Submit (`POST /api/excuses/event/{id}`) validates chapter membership, checks for existing pending/approved excuse (409 if duplicate), deletes any previously denied excuse before inserting (to satisfy `unique(event_id, member_id)` constraint, allowing resubmission after denial). List is role-scoped: officers see all chapter excuses with member/event joins; members see only their own. Review (approve/deny) is officer-gated and automatically deletes any associated unpaid fine on approval. |
| Frontend | **Mock only.** `components/forms/excuse-form.tsx` + dashboard review panel in events detail view. |
| Gap | Auth wiring. |

**Excuse lifecycle:**
1. Member submits excuse for an event → `status=pending`
2. If a pending or approved excuse already exists → 409 rejection
3. If a denied excuse exists → deleted first, then new one inserted (allows resubmission)
4. Officer reviews: approve or deny
5. On approval: any unpaid fine for that event+member is deleted from the fines table
6. On denial: member can resubmit (step 3 handles cleanup)

### Fines

| Layer | State |
|-------|-------|
| Backend | **Done.** List (role-scoped: officers see chapter-wide with member/event joins, members see own), pay (validates `member_id` match + `status=unpaid`), waive (officer-gated, validates `chapter_id` + `status=unpaid`), summary (aggregated totals for officer dashboard). |
| Frontend | **Mock only.** `pages/fines.tsx` with filter tabs (all/unpaid/paid/waived), pay/waive buttons. |
| Gap | Auth wiring. |

**Fine state machine:** `unpaid` → `paid` (by member) or `unpaid` → `waived` (by officer). No path back from paid/waived.

### Auto-Fine Processing (Cron)

| Layer | State |
|-------|-------|
| Backend | **Done.** `GET /api/cron/process-fines` scans all required events where `date <= today`, calls `process_event_fines()` for each. The processor finds active members who didn't attend and have no approved excuse, then inserts a fine with `reason="Missed: {event_title}"` and `amount=event.fine_amount`. Uses admin client (bypasses RLS). Vercel Cron calls this every 15 minutes. |
| Frontend | N/A — server-side only. |
| Gap | None on backend. Vercel Cron header verification is optional (not enforced). Idempotent: won't double-fine because it checks for existing fines before inserting. |

### Members Roster

| Layer | State |
|-------|-------|
| Backend | **Done.** `GET /api/members` returns active chapter members sorted by name. `PUT /api/members/{id}/role` changes role between `officer` and `member` (officer-gated, validates `chapter_id` match). |
| Frontend | **Mock only.** `pages/members.tsx` renders list with role badges, avatars, and email. |
| Gap | Auth wiring. |

### Delinquency Tracking

| Layer | State |
|-------|-------|
| Backend | **Done.** `GET /api/delinquency/scores` computes engagement scores for all active members in the chapter. `GET /api/delinquency/member/{id}` returns per-event breakdown. `POST /api/delinquency/assign-security` auto-picks the 3 most delinquent members. `POST /api/delinquency/remind/{id}` is a placeholder for sending payment/engagement reminders. All endpoints are officer-gated. |
| Frontend | **Mock only.** `pages/delinquency.tsx` renders a ranked score table with progress bars, stat cards (at-risk count, total unpaid), member drill-down with event history, security assignment modal, and per-member reminder buttons. The mock API in `mocks/mock-api.ts` replicates the scoring logic for dev/demo. |
| Gap | Auth wiring. Also, the reminder endpoint is a placeholder — needs email/push integration. |

**Scoring algorithm (in `services/delinquency.py`):**
- Fetches all required events where `date <= now` for the chapter
- For each active member, calculates:
  - `attended`: count of required events with `checked_in=true`
  - `excused`: count of required events with an approved excuse (minus any that were also attended)
  - `missed`: `total_required - attended - excused`
  - `unpaid_fines`: count and sum of unpaid fines
- Score formula: `(attendance_pct × 70) + (excuse_pct × 20) + ((1 - fine_penalty) × 10)`
  - `attendance_pct = attended / total_required`
  - `excuse_pct = excused / total_required`
  - `fine_penalty = min(unpaid_amount / 200, 0.10)` — caps at 10% penalty
- Score range: 0 (worst) → 100 (perfect)
- Results sorted ascending (most delinquent first)

---

## Root Cause: Frontend-Backend Gap

Every frontend page is functional in mock mode. The single blocker preventing
production loops is the commented-out Supabase session initialization in
`fratos/hooks/use-auth.tsx`. Once that is enabled and `NEXT_PUBLIC_USE_MOCKS=false`,
all pages will talk to the real FastAPI backend.

The **Phone Check-In** feature bypasses this entirely by using a standalone HTML page
served by FastAPI that POSTs directly — no React app, no Supabase SDK, no JWT.
