# FraternityOS — Chapter Attendance & Fines

Attendance tracking, excuses, and fines management for fraternity chapters. Runs fully locally with Docker + Postgres.

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI (Python) |
| Frontend | Next.js (React) |
| Database | PostgreSQL (Docker locally, Supabase direct Postgres in production) |

The backend connects to Postgres directly via `DATABASE_URL` — the same code runs locally and in production, just with a different connection string.

## Project Structure

```
FraternityOS/
  api/                  # FastAPI backend
    index.py            # App entrypoint, router registration
    config.py           # Settings (DATABASE_URL, JWT_SECRET, etc.)
    db.py               # DB client (PostgresClient singleton)
    dependencies.py     # Auth: get_current_user, require_officer
    postgres_client.py  # Supabase-compatible query builder over psycopg2
    models/schemas.py   # Pydantic request/response models
    routes/             # Route handlers (auth, events, attendance, etc.)
    services/           # Business logic (checkin_links, fine_processor)
  fratos/               # Next.js frontend
    app/                # App Router (layout, page)
    lib/                # api-client, types, theme
    hooks/              # use-auth, use-api
    components/         # UI components and forms
    views/              # Page views (dashboard, events, fines, members, standing)
    e2e/                # Playwright E2E tests
  migrations/           # SQL schema (0001_initial_schema.sql)
  scripts/              # migrate_db.py, seed.py
  deploy/               # local-dev.sh startup script
  docs/                 # Architecture and feature docs
```

## Quick Start

**Prerequisites:** Docker, Python 3.11+, Node.js 20+

```bash
# One command — starts Postgres, backend, and frontend:
bash deploy/local-dev.sh
```

Open [http://localhost:3000](http://localhost:3000) and log in as `jake@tke.org` (officer).

### Manual Setup

```bash
# 1. Start Postgres
docker compose up -d

# 2. Create .env
cp .env.example .env

# 3. Run migrations + seed
python scripts/migrate_db.py
python -m scripts.seed

# 4. Backend (terminal 1)
pip install -r requirements.txt
uvicorn api.index:app --reload --port 8001

# 5. Frontend (terminal 2)
cd fratos
npm install
echo 'NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001' > .env.local
npm run dev
```

## Features

| Feature | Description |
|---------|-------------|
| Officer auth | Email login (no password), JWT sessions |
| Members roster | List members, promote/demote roles |
| Events CRUD | Create, view, edit, delete events |
| Check-in links | Time-limited QR/link for in-person check-in |
| Phone check-in | Member enters phone number — no app login needed |
| Attendance roster | Per-event view with manual override |
| Excuses | Submit, approve/deny; auto-removes fine on approval |
| Fines | Auto-generated for missed required events, pay/waive |
| Standing | good_standing / warning / delinquent per member |

## API Endpoints

| Group | Endpoints |
|-------|-----------|
| Auth | `POST /api/auth/login`, `GET /api/auth/me` |
| Events | `GET/POST /api/events`, `GET/PUT/DELETE /api/events/{id}`, `POST/DELETE /api/events/{id}/checkin-link` |
| Attendance | `POST /api/attendance/checkin/{code}`, `POST /api/attendance/checkin/{code}/phone`, `GET /api/attendance/event/{id}`, `POST /api/attendance/event/{id}/manual/{mid}` |
| Excuses | `POST /api/excuses/event/{id}`, `GET /api/excuses`, `PUT /api/excuses/{id}/review` |
| Fines | `GET /api/fines`, `POST /api/fines/{id}/pay`, `POST /api/fines/{id}/waive`, `POST /api/fines/process-event/{id}`, `GET /api/fines/summary` |
| Members | `GET /api/members`, `PUT /api/members/{id}/role` |
| Standing | `GET /api/standing` |
| Cron | `GET /api/cron/process-fines` |
| Check-in page | `GET /c/{code}` (HTML page for phone check-in) |

API docs: [http://localhost:8001/api/docs](http://localhost:8001/api/docs)

## Environment Variables

See [`.env.example`](.env.example). The only required variable is `DATABASE_URL`.

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://fraternityos:localdev@localhost:5434/fraternityos` | Point to Supabase Postgres for production |
| `JWT_SECRET` | `local-dev-secret-key-change-in-prod` | Change to a strong secret in production |
| `FRONTEND_URL` | `http://localhost:3000` | Used for CORS |
| `BASE_URL` | `http://localhost:8001` | Used in check-in link URLs |
| `CHECKIN_LINK_TTL_MINUTES` | `10` | How long check-in links stay active |

## Production

To deploy to production, point `DATABASE_URL` at your Supabase (or any Postgres) connection string. The backend code is identical — no Supabase SDK required, just direct Postgres via psycopg2.
