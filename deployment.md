# Synefi Outreach Pipeline — Deployment

## Target setup

| Piece | Platform | Why |
|---|---|---|
| Frontend (React/Vite dashboard) | **Vercel** | Free tier, purpose-built for static/SPA frontends |
| Backend (FastAPI + APScheduler) | **Render** | Free/cheap tier, supports a persistent long-running process (needed for the autonomous scheduler) — Vercel's serverless model can't run this |
| Database (Postgres) | **Neon** | Free tier does not expire after 30 days (unlike Render's free Postgres add-on) — just needs a standard `DATABASE_URL` connection string, no code changes |

## Accounts needed (to request from team lead / set up)

1. **GitHub** — a repo to hold the code; both Vercel and Render deploy by connecting to a GitHub repo
2. **Vercel account** — free tier is sufficient
3. **Render account** — free tier for now; note below on the always-on caveat
4. **Neon account** — free tier is sufficient at this volume (5 companies/day)

No new Deepline or HeyReach accounts are needed — existing credentials carry over as environment
variables/secrets on the new deployment.

## Known caveat: Render free tier and the scheduler

Render's free web services spin down after a period of inactivity and take ~30s to wake on the next
request. This is fine for a demo (the dashboard just takes a moment to load after idle), but **not fine
for the autonomous daily scheduler**, which needs to fire reliably once every 24h unattended — a sleeping
service won't wake itself on a timer. If/when the autonomous system needs to run unattended in production,
this needs Render's paid "Starter" tier (~$7/month) or an external cron-ping to keep the service awake.

## Deployment steps (once accounts exist)

1. Push the current codebase to the GitHub repo.
2. **Neon**: create a new Postgres project, copy the connection string.
3. **Render**: create a new Web Service from the GitHub repo (root: backend/`app`), set environment
   variables:
   - `DATABASE_URL` → Neon's connection string
   - `DEEPLINE_CLI_PATH` and the Deepline auth token/secret (carried over from this machine's existing
     authenticated session — no new Deepline account needed)
   - Any other secrets currently in `.env`
   Build command / start command per `requirements.txt` and `uvicorn app.main:app`.
4. **Vercel**: create a new project from the GitHub repo (root: `dashboard/`), set the frontend's API base
   URL (`src/api/client.js`) to point at the deployed Render backend URL instead of `localhost:8000`.
5. Re-enter HeyReach API key + campaign ID in the deployed app's Settings page (credentials live in the
   database, so they need to be set again against the new Neon database — they don't carry over
   automatically from the local Postgres instance).
6. Verify `/api/health` responds on the Render URL, then verify the Vercel-hosted dashboard successfully
   loads batches/settings against it.

## Status
Not yet executed — accounts pending from team lead.
