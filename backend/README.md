# CivicWatch Backend API

Express.js backend API for CivicWatch dashboard, using PostgreSQL with an optimized schema for `full_topics.csv` data.

## Database Schema

The backend uses the following PostgreSQL schema:

### Tables

- **`legislators`** - Legislator information (lid, name, handle, state, chamber, party)
- **`topics`** - Topic definitions (topic, topic_label)
- **`posts`** - Social media posts (id, lid, created_at, text, engagement metrics, topic)

### Relationships

- `posts.lid` → `legislators.lid` (author relationship)
- `posts.topic` → `topics.topic` (topic assignment)

### Indexes

Optimized indexes for:
- Date range queries
- Legislator lookups
- Topic filtering
- Engagement metrics
- Text search (full-text search on post text)
- Composite indexes for common query patterns

### Materialized Views

- `topic_engagement_daily` - Daily aggregated engagement per topic
- `topic_party_breakdown` - Topic engagement by party
- `topic_state_breakdown` - Topic engagement by state

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Create `.env` file:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=civicwatch
   DB_USER=postgres
   DB_PASSWORD=postgres
   PORT=8500
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:5173
   ```

3. **Create database and schema:**
   ```powershell
   # Windows
   .\scripts\setup_database.ps1
   
   # Or manually:
   createdb -U postgres civicwatch
   psql -U postgres -d civicwatch -f migrations/001_create_schema.sql
   ```

4. **Import CSV data:**
   ```bash
   npm run import-csv
   ```

5. **Start server:**
   ```bash
   npm start
   # or for development:
   npm run dev
   ```

## API Endpoints

### Legislators
- `GET /api/legislators/` - Get all legislators
  - Query params: `party`, `state`, `search`, `has_posts`

### States
- `GET /api/states/` - Get all states
  - Query params: `party`, `has_posts`

### Posts
- `GET /api/export-posts-csv/` - Export filtered posts as CSV
  - Query params: `start_date`, `end_date`, `topics`, `keyword`, `legislator`

### Overview
- `GET /api/default_overview_data/` - Get overview metrics
  - Query params: `start_date`, `end_date`, `topics`

### Legislator Profile
- `GET /api/legislators/:lid/profile` - Get detailed legislator profile
  - Query params: `start_date`, `end_date`, `topics`

### Engagement Timeline
- `GET /api/engagement/timeline/` - Get daily engagement timeline
  - Query params: `start_date`, `end_date`, `topics`
- `GET /api/flow/bipartite_data/` - Same as above (backward compatibility)

### Topics
- `GET /api/engagement/topics/` - Get topics sorted by engagement
  - Query params: `start_date`, `end_date`, `limit`
- `GET /api/topics/` - Get all topics with metrics
- `GET /api/topics/breakdown/` - Get topic breakdown
  - Query params: `topic` (required), `start_date`, `end_date`

### Date Range
- `GET /api/date-range/` - Get min/max dates from posts

### Health Check
- `GET /health` - Check server and database connection

## Query Patterns

The schema supports efficient querying by:

### Posts:
- Date range filtering (`created_at`)
- Topic filtering (via `topic` FK)
- Keyword/text search (full-text search on `text`)
- Engagement metrics (likes, retweets)
- Civility scores
- Misinformation flags

### Authors (Legislators):
- Party filtering
- State filtering
- Chamber filtering
- Name search
- Posts count filtering (`has_posts` parameter)

### Topics:
- Engagement-based sorting
- Party breakdown
- State breakdown
- Date range filtering

## Notes

- All queries use the new schema: `legislators`, `posts`, `topics`
- Server runs on port 8500 by default
- Frontend proxies `/api/*` requests to `http://localhost:8500`
- Materialized views can be refreshed with: `psql -U postgres -d civicwatch -f migrations/002_refresh_materialized_views.sql`

