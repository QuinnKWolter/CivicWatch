# CivicWatch Backend

Express + PostgreSQL API for the CivicWatch dashboard.

## Run

```bash
npm install
npm run dev
```

Defaults:
- API: `http://localhost:8500`
- Frontend origin for CORS: `http://localhost:5173`

## Config (`.env`)

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=civicwatch
DB_USER=postgres
DB_PASSWORD=postgres
PORT=8500
CORS_ORIGIN=http://localhost:5173
```

## Database (current shape)

- **`posts`**: primary key `id BIGSERIAL`; nullable `tweet_id`; foreign keys `lid` → `legislators.lid`, `topic` → `topics.topic`.
- **`legislators`**: `lid` (Twitter author_id), plus rich metadata (party/state/chamber + extended fields from `official_data.csv` / `account.csv`).
- **`topics`**: CAP topic list / labels.

Common post metrics include `like_count`, `retweet_count`, `reply_count`, `quote_count`, plus content signals like `tox_*` and `count_misinfo` / `misinfo_score` when present.

## Data loading

- **Load a dump (recommended)**:
  - `npm run load-dump`
- **Create a dump**:
  - `npm run create-dump`

## API (high-signal endpoints)

- **GET `/health`**
- **GET `/api/date-range/`**
- **GET `/api/default_overview_data/`** (powers `TimelineContext`)
- **GET `/api/engagement/timeline/`**
- **GET `/api/engagement/topics/`**
- **GET `/api/topics/`**
- **GET `/api/topics/breakdown/`** (powers `TopVisualization`)
  - returns `party_breakdown`, `state_breakdown`, and `state_party_breakdown`
- **GET `/api/legislators/`**
- **GET `/api/legislators/:lid/profile`**
