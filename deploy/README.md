# Deployment Guide — FraternityOS Attendance MVP

## Architecture

| Layer    | Tech                | Hosting          |
|----------|---------------------|------------------|
| Frontend | Next.js 16 (React 19) | Vercel (`@vercel/next`) |
| Backend  | FastAPI (Python)    | Vercel Serverless (`@vercel/python`) |
| Database | PostgreSQL          | Supabase (integrated via Vercel Marketplace) |
| Cron     | Vercel Cron         | `*/15 * * * *` → `/api/cron/process-fines` |

Routing is handled by `vercel.json`:
- `/api/*` and `/c/*` → FastAPI serverless function
- Everything else → Next.js frontend

---

## Secrets & Environment Variables

### What Supabase ↔ Vercel Integration Auto-Provisions

When Supabase is connected through the Vercel Marketplace, these env vars are
**automatically injected** into your Vercel project (all environments):

| Auto-Provisioned Var              | Value |
|-----------------------------------|-------|
| `POSTGRES_URL`                    | Pooled connection string |
| `POSTGRES_URL_NON_POOLING`        | Direct connection string |
| `POSTGRES_USER`                   | `postgres` |
| `POSTGRES_HOST`                   | `db.<ref>.supabase.co` |
| `POSTGRES_PASSWORD`               | DB password |
| `POSTGRES_DATABASE`               | `postgres` |
| `SUPABASE_URL`                    | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY`       | Service role key (admin) |
| `SUPABASE_PUBLISHABLE_KEY`        | Public anon key |
| `SUPABASE_JWT_SECRET`             | Project JWT secret |
| `NEXT_PUBLIC_SUPABASE_URL`        | Same as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same as publishable key |

### What You Must Add Manually in Vercel

The FastAPI backend config (`api/config.py`) uses slightly different names
than what the integration provisions. You must add these manually in
**Vercel → Project → Settings → Environment Variables**:

| Env Var              | Value / Source                                   | Required |
|----------------------|--------------------------------------------------|----------|
| `DATABASE_URL`       | Copy from auto-provisioned `POSTGRES_URL` or `POSTGRES_URL_NON_POOLING` | Yes |
| `SUPABASE_ANON_KEY`  | Copy from auto-provisioned `SUPABASE_PUBLISHABLE_KEY` | Yes |
| `JWT_SECRET`         | Generate a unique secret (`openssl rand -hex 32`) | **Yes — critical** |
| `FRONTEND_URL`       | Your Vercel domain, e.g. `https://fratos.vercel.app` | Yes |
| `BASE_URL`           | Same as `FRONTEND_URL`                            | Yes |
| `CHECKIN_LINK_TTL_MINUTES` | `10` (default) or your preference            | No (defaults to 10) |

> **Security note:** `JWT_SECRET` must be a strong random string in production.
> Never reuse `local-dev-secret-key-change-in-prod`.

### Frontend Env Vars (fratos)

| Env Var                                        | Vercel          | Local Dev |
|------------------------------------------------|-----------------|-----------|
| `NEXT_PUBLIC_API_BASE`                         | Omit (same-origin `/api`) | `http://127.0.0.1:8001` |
| `NEXT_PUBLIC_SUPABASE_URL`                     | Auto-provisioned | Set in `fratos/.env.local` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Auto-provisioned as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Set in `fratos/.env.local` |

---

## Local Development

### Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Node.js 20+
- `pip` and `npm`

### Quick Start

```bash
# From repo root:
bash deploy/local-dev.sh
```

This script:
1. Starts PostgreSQL via Docker Compose (port 5434)
2. Waits for DB readiness
3. Runs migrations
4. Installs Python and Node dependencies (if missing)
5. Starts the FastAPI backend on `:8001`
6. Starts the Next.js frontend on `:3000`

### Manual Steps (if you prefer)

```bash
# 1. Database
docker compose up -d
sleep 3
DATABASE_URL=postgresql://fraternityos:localdev@localhost:5434/fraternityos \
  python scripts/migrate_db.py

# 2. Backend
pip install -r requirements.txt
cp .env.example .env   # edit if needed
uvicorn api.index:app --reload --host 0.0.0.0 --port 8001

# 3. Frontend (separate terminal)
cd fratos
npm install
echo 'NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001' > .env.local
npm run dev
```

---

## Pre-Deployment Checklist

Run the preflight script before every deployment:

```bash
bash deploy/preflight.sh
```

It validates:

| Check | What it does |
|-------|-------------|
| Python imports | Verifies `api/index.py` loads without import errors |
| Frontend build | Runs `next build` to catch compile/type errors |
| Frontend lint | Runs ESLint |
| Env var validation | Checks all required vars are set (via `deploy/check-env.py`) |
| Health endpoint | Curls `/api/health` if backend is running locally |
| Migration state | Confirms migration files exist and are valid SQL |
| `vercel.json` | Validates JSON syntax |

---

## Cloud Deployment (Vercel)

### First-Time Setup

1. Install Vercel CLI: `npm i -g vercel`
2. Link project: `vercel link` (from repo root)
3. Connect Supabase via Vercel Marketplace (Dashboard → Integrations → Supabase)
4. Add manual env vars (see table above) in Vercel Dashboard
5. Run migrations against Supabase:
   ```bash
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres" \
     python scripts/migrate_db.py
   ```

### Deploy

```bash
# From repo root:
bash deploy/vercel-deploy.sh          # preview deployment
bash deploy/vercel-deploy.sh --prod   # production deployment
```

Or manually:

```bash
vercel            # preview
vercel --prod     # production
```

### Post-Deploy Verification

1. Hit `https://your-app.vercel.app/api/health` — expect `{"status":"ok"}`
2. Open the app — login page should load
3. Test the phone check-in flow: create event → open check-in → visit `/c/<code>`

---

## Smoke Test Checklist

After each deployment, verify:

- [ ] `GET /api/health` returns `{"status":"ok","version":"0.1.0"}`
- [ ] Officer can log in
- [ ] Members roster loads
- [ ] Create a new event
- [ ] Open check-in link on event
- [ ] Visit check-in link on phone, enter phone number, confirm attendance recorded
- [ ] Close check-in link
- [ ] Submit an excuse for an event
- [ ] Officer approves/denies excuse
- [ ] Fines list loads (or trigger via `/api/cron/process-fines`)
- [ ] Member standing page loads

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| `500` on any `/api/*` route | Missing env var — check `DATABASE_URL` and `SUPABASE_*` in Vercel |
| Frontend shows "API returned non-JSON" | Backend not reachable — check `NEXT_PUBLIC_API_BASE` locally or Vercel routing |
| Check-in link 404 | `/c/*` route not hitting FastAPI — verify `vercel.json` routes |
| "JWT decode error" | `JWT_SECRET` mismatch between token issuance and validation |
| Migrations fail on Supabase | Password has special chars — URL-encode them in `DATABASE_URL` |
| Cron not firing | Vercel Cron only runs on production deployments, not previews |
