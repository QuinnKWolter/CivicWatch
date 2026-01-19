# CivicWatch

A dashboard for analyzing US legislators’ social-media posts (topics, engagement, geography, and content signals like toxicity/misinformation) backed by PostgreSQL.

## Quick start (recommended)

Install deps (one time per folder):

```bash
cd backend
npm install
cd ../frontend
npm install
```

Run both servers from repo root:

```bash
npm start
# or: node start.js
```

Defaults:
- Backend: `http://localhost:8500`
- Frontend (Vite): `http://localhost:5173`

`start.js` runs both and prefixes logs (`[BACKEND]`, `[FRONTEND]`). Ctrl+C stops both.

## Manual start

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

## Data / database

- **For collaborators**: create/load a PostgreSQL dump via `backend` scripts (`npm run create-dump`, `npm run load-dump`).