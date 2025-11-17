# CivicWatch Database Setup Guide

This guide will help you set up the PostgreSQL database for CivicWatch with the optimized schema for `full_topics.csv` data.

## Prerequisites

- PostgreSQL installed and running
- Node.js (v18 or higher)
- Access to `full_topics.csv` file

## Quick Start

### 1. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and set your database credentials (defaults to postgres/postgres):
```
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=civicwatch
```

### 2. Create Database and Schema

**On Windows (PowerShell):**
```powershell
.\scripts\setup_database.ps1
```

**On Linux/Mac:**
```bash
chmod +x scripts/setup_database.sh
./scripts/setup_database.sh
```

**Or manually:**
```bash
# Create database
createdb -U postgres civicwatch

# Run migrations
psql -U postgres -d civicwatch -f migrations/001_create_schema.sql
```

### 3. Import CSV Data

```bash
node scripts/import_csv.js
```

This will:
- Parse the CSV file
- Insert unique legislators
- Insert unique topics
- Insert all posts in batches
- Refresh materialized views

**Note:** The import process may take a while depending on the size of your CSV file. Progress will be logged to the console.

### 4. Verify Import

```bash
psql -U postgres -d civicwatch -c "SELECT COUNT(*) FROM posts;"
psql -U postgres -d civicwatch -c "SELECT COUNT(*) FROM legislators;"
psql -U postgres -d civicwatch -c "SELECT COUNT(*) FROM topics;"
```

## Database Schema

### Tables

#### `legislators`
- `lid` (TEXT, PK) - Legislator ID
- `name` (TEXT) - Legislator name
- `handle` (TEXT) - Social media handle
- `state` (TEXT) - State abbreviation
- `chamber` (TEXT) - H or S
- `party` (TEXT) - Democratic, Republican, etc.

#### `topics`
- `topic` (TEXT, PK) - Topic ID
- `topic_label` (TEXT) - Topic description

#### `posts`
- `id` (TEXT, PK) - Post ID
- `lid` (TEXT, FK) - Legislator ID
- `created_at` (DATE) - Post date
- `text` (TEXT) - Post content
- `attachment` (TEXT) - Attachment type
- `retweet_count` (INTEGER) - Retweet count
- `like_count` (INTEGER) - Like count
- `count_misinfo` (INTEGER) - Misinformation flag
- `interaction_score` (DOUBLE PRECISION) - Interaction score
- `overperforming_score` (DOUBLE PRECISION) - Overperforming score
- `civility_score` (DOUBLE PRECISION) - Civility score (0-1)
- `topic` (TEXT, FK) - Topic ID
- `topic_probability` (DOUBLE PRECISION) - Topic assignment probability

### Materialized Views

#### `topic_engagement_daily`
Daily aggregated engagement metrics per topic:
- `date`, `topic`, `topic_label`
- `post_count`, `total_likes`, `total_retweets`, `total_engagement`
- `avg_interaction_score`, `avg_civility_score`

#### `topic_party_breakdown`
Topic engagement broken down by party:
- `topic`, `topic_label`, `party`
- `post_count`, `total_likes`, `total_retweets`, `total_engagement`

#### `topic_state_breakdown`
Topic engagement broken down by state:
- `topic`, `topic_label`, `state`
- `post_count`, `total_likes`, `total_retweets`, `total_engagement`

### Regular Views

#### `legislator_summary`
Summary statistics per legislator:
- All legislator fields
- `total_posts`, `total_likes`, `total_retweets`, `total_engagement`
- `avg_interaction_score`, `avg_civility_score`
- `total_misinfo_posts`
- `first_post_date`, `last_post_date`

## Indexes

The schema includes optimized indexes for:
- Date range queries (`created_at`)
- Legislator lookups (`lid`)
- Topic filtering (`topic`)
- Engagement metrics (`like_count`, `retweet_count`, `interaction_score`)
- Composite queries (date + topic, lid + date, etc.)

## Refreshing Materialized Views

After data updates, refresh the materialized views:

```bash
psql -U postgres -d civicwatch -f migrations/002_refresh_materialized_views.sql
```

Or manually:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY topic_engagement_daily;
REFRESH MATERIALIZED VIEW CONCURRENTLY topic_party_breakdown;
REFRESH MATERIALIZED VIEW CONCURRENTLY topic_state_breakdown;
```

## Example Queries

### Get daily engagement for topics
```sql
SELECT * FROM topic_engagement_daily
WHERE date BETWEEN '2020-01-01' AND '2020-12-31'
ORDER BY date, total_engagement DESC;
```

### Get topic breakdown by party
```sql
SELECT * FROM topic_party_breakdown
WHERE topic = '1'
ORDER BY total_engagement DESC;
```

### Get posts filtered by date and topic
```sql
SELECT p.*, l.name, l.party, t.topic_label
FROM posts p
JOIN legislators l ON p.lid = l.lid
JOIN topics t ON p.topic = t.topic
WHERE p.created_at BETWEEN '2020-01-01' AND '2020-12-31'
  AND p.topic = '1'
ORDER BY p.created_at DESC;
```

### Get legislator summary
```sql
SELECT * FROM legislator_summary
WHERE state = 'CA'
ORDER BY total_engagement DESC;
```

## Troubleshooting

### Import fails with foreign key errors
- Make sure legislators and topics are inserted before posts
- Check that all `lid` and `topic` values in CSV exist

### Import is slow
- The script uses batch inserts (1000 records at a time)
- For very large files, consider increasing `BATCH_SIZE` in `import_csv.js`
- Ensure PostgreSQL has adequate memory and connection limits

### Materialized views are empty
- Run the refresh script after import completes
- Check that posts were inserted successfully

### Connection errors
- Verify PostgreSQL is running
- Check `.env` file has correct credentials
- Ensure database exists: `psql -U postgres -l`

## Next Steps

After setting up the database:
1. Update your API controllers to use the new schema
2. Replace static JSON file queries with database queries
3. Add API endpoints for dynamic filtering and aggregation
4. Consider adding more materialized views for common query patterns

