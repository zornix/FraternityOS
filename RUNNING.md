# Running FraternityOS Locally

## Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Node.js 20+

## Automated Start

```bash
bash deploy/local-dev.sh
```

Starts PostgreSQL (Docker), installs dependencies, and launches both backend (:8001) and frontend (:3000).

## Manual Start

### 1. Database

```bash
docker compose up -d
```

### 2. Environment

```bash
cp .env.example .env
```

### 3. Migrations

```bash
python scripts/migrate_db.py
```

### 4. Seed test data

```bash
python -m scripts.seed
```

Creates a chapter, 8 members, 5 events, attendance records, excuses, and fines.
Officer login: `jake@tke.org`

### 5. Backend (terminal 1)

```bash
pip install -r requirements.txt
uvicorn api.index:app --reload --host 0.0.0.0 --port 8001
```

API docs: http://localhost:8001/api/docs

### 6. Frontend (terminal 2)

```bash
cd fratos
npm install
echo 'NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001' > .env.local
npm run dev
```

App: http://localhost:3000

## Demo Credentials

| Name | Email | Role | Phone |
|------|-------|------|-------|
| Jake Martinez | jake@tke.org | Officer | 555111001 |
| Ryan Chen | ryan@tke.org | Member | 555111002 |
| Tyler Brooks | tyler@tke.org | Member | 555111003 |

Log in with any email — no password required. Officers have full access; members can view and submit excuses.

## Smoke Test Checklist

- [ ] Log in as `jake@tke.org` (officer)
- [ ] Members page loads with roster
- [ ] Create a new event (required, with fine)
- [ ] Open check-in link on event
- [ ] Visit `/c/<code>` on phone, enter phone `555111002` (Ryan)
- [ ] Verify attendance recorded on event detail
- [ ] Close check-in link
- [ ] Submit an excuse for an event
- [ ] Officer approves/denies excuse
- [ ] Process fines (button on past required event, or `GET /api/cron/process-fines`)
- [ ] Fines page shows fines; pay/waive works
- [ ] Standing page shows member standings

## E2E Tests

```bash
cd fratos
npx playwright install chromium
npm run test:e2e
```
