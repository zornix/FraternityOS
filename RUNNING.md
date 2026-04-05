# How to run FraternityOS from the terminal

This guide assumes you are in the repository root:

```bash
cd /path/to/ChapterAttendance
```

You can run the UI alone with **mock data** (simplest), or run the **Next.js frontend** and **FastAPI backend** together against Supabase.

---

## Option A — Frontend only (mock API, no Supabase)

Best for exploring the UI without a database.

1. **Install and start Next.js**

   ```bash
   cd fratos
   npm install
   npm run dev
   ```

2. **Open** [http://localhost:3000](http://localhost:3000)

3. **Use the mock API** — create `fratos/.env.local`:

   ```env
   NEXT_PUBLIC_USE_MOCKS=true
   ```

   Mocks are enabled only when this is exactly `true` (see `fratos/lib/config.ts`).

---

## Option B — Full stack (Next.js + FastAPI + Supabase)

Use two terminal sessions: one for the API, one for the frontend.

### 1. Backend (terminal 1)

From the **repository root** (not `fratos/`):

1. **Python 3.11+** and a virtual environment (recommended):

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   ```

2. **Install dependencies** (no `requirements.txt` in this repo — install what the app imports):

   ```bash
   pip install "fastapi[standard]" uvicorn pydantic-settings supabase "pydantic[email]"
   ```

3. **Configure environment** — create a `.env` file in the **repository root** (same level as `backend.py`):

   ```env
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   FRONTEND_URL=http://localhost:3000
   ```

   `FRONTEND_URL` should match where Next.js runs so the browser can call the API without CORS errors.

4. **Start Uvicorn:**

   ```bash
   uvicorn api.index:app --reload --host 0.0.0.0 --port 8000
   ```

   Equivalent entry point:

   ```bash
   uvicorn backend:app --reload --host 0.0.0.0 --port 8000
   ```

5. **API docs:** [http://localhost:8000/api/docs](http://localhost:8000/api/docs)  
   **Health:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

### 2. Frontend (terminal 2)

```bash
cd fratos
npm install
```

Create `fratos/.env.local`:

```env
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Production-style run (local)

After a build, you can serve the frontend with Node:

```bash
cd fratos
npm run build
npm run start
```

The API is still started with Uvicorn (or your process manager) as in Option B.

---

## E2E tests (optional)

From `fratos/`:

```bash
npx playwright install chromium   # first time only
npm run test:e2e
```

Playwright can start the dev server automatically; see `fratos/playwright.config.ts` for details.

---

## Quick reference

| Mode              | Commands                                      | URLs                          |
|-------------------|-----------------------------------------------|-------------------------------|
| Mock UI only      | `cd fratos && npm install && npm run dev`     | App: `:3000`                  |
| Full stack        | Root: `uvicorn api.index:app --reload`        | API: `:8000`, App: `:3000`    |
|                   | `fratos`: `npm run dev` + `.env.local` above  |                               |

For more architecture and endpoint detail, see `README.MD`.
