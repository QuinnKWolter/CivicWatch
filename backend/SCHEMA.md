# CivicWatch PostgreSQL Database Schema

## Overview

The CivicWatch database stores legislator social media posts with engagement metrics, topic assignments, and toxicity scores. The schema is optimized for time-series analysis, topic filtering, and engagement metrics queries.

## Tables

### `legislators`

Stores legislator information extracted from posts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `lid` | TEXT | PRIMARY KEY, NOT NULL | Legislator ID (unique identifier) |
| `name` | TEXT | NOT NULL | Legislator full name |
| `handle` | TEXT | NULL | Social media handle |
| `state` | TEXT | NULL | State abbreviation (e.g., 'CA', 'NY') |
| `chamber` | TEXT | NULL | Chamber: 'H' (House) or 'S' (Senate) |
| `party` | TEXT | NULL | Party: 'Democratic', 'Republican', 'Independent', or 'Other' |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record last update timestamp |

**Constraints:**
- `chamber` must be 'H' or 'S'
- `party` must be 'Democratic', 'Republican', 'Independent', or 'Other'

**Indexes:**
- `idx_legislators_chamber` on `chamber`
- `idx_legislators_handle` on `handle`
- `idx_legislators_name` on `name`
- `idx_legislators_party` on `party`
- `idx_legislators_state` on `state`
- `idx_legislators_state_party` on `(state, party)` (composite)

---

### `topics`

Stores topic definitions with labels.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `topic` | TEXT | PRIMARY KEY, NOT NULL | Topic ID (unique identifier) |
| `topic_label` | TEXT | NOT NULL | Human-readable topic description |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |

**Indexes:**
- `idx_topics_label` on `topic_label`

---

### `posts`

Stores social media posts with engagement metrics, topic assignments, and toxicity scores.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY, NOT NULL | Post ID (unique identifier) |
| `lid` | TEXT | NOT NULL, FK → `legislators.lid` | Legislator ID (author) |
| `created_at` | DATE | NOT NULL | Post date |
| `text` | TEXT | NULL | Post content/text |
| `attachment` | TEXT | NULL | Attachment type/URL |
| `retweet_count` | INTEGER | DEFAULT 0 | Number of retweets |
| `like_count` | INTEGER | DEFAULT 0 | Number of likes |
| `count_misinfo` | INTEGER | DEFAULT 0 | Misinformation flag/count |
| `interaction_score` | DOUBLE PRECISION | NULL | Interaction score metric |
| `overperforming_score` | DOUBLE PRECISION | NULL | Overperforming score metric |
| `civility_score` | DOUBLE PRECISION | NULL | Civility score (0-1 scale) |
| `topic` | TEXT | NOT NULL, FK → `topics.topic` | Topic ID assignment |
| `topic_probability` | DOUBLE PRECISION | NULL | Topic assignment probability (0-1) |
| `created_at_timestamp` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| `tox_toxicity` | DOUBLE PRECISION | NULL | Toxicity score |
| `tox_severe_toxicity` | DOUBLE PRECISION | NULL | Severe toxicity score |
| `tox_obscene` | DOUBLE PRECISION | NULL | Obscene content score |
| `tox_threat` | DOUBLE PRECISION | NULL | Threat score |
| `tox_insult` | DOUBLE PRECISION | NULL | Insult score |
| `tox_identity_attack` | DOUBLE PRECISION | NULL | Identity attack score |

**Constraints:**
- `civility_score` must be between 0 and 1
- `topic_probability` must be between 0 and 1
- Foreign key `lid` references `legislators(lid)` ON DELETE CASCADE
- Foreign key `topic` references `topics(topic)` ON DELETE RESTRICT

**Indexes:**
- `idx_posts_created_at` on `created_at`
- `idx_posts_created_at_desc` on `created_at DESC`
- `idx_posts_date_topic` on `(created_at, topic)` (composite)
- `idx_posts_engagement` on `(like_count, retweet_count)` (composite)
- `idx_posts_interaction_score` on `interaction_score DESC`
- `idx_posts_lid` on `lid`
- `idx_posts_lid_date` on `(lid, created_at)` (composite)
- `idx_posts_text` on `text` (GIN index for full-text search using `to_tsvector`)
- `idx_posts_topic` on `topic`
- `idx_posts_topic_engagement` on `(topic, like_count DESC, retweet_count DESC)` (composite)
- `idx_posts_topic_probability` on `(topic, topic_probability)` (composite)
- `idx_posts_tox_severe_toxicity` on `tox_severe_toxicity`
- `idx_posts_tox_toxicity` on `tox_toxicity`

---

## Views

### `legislator_summary`

Summary statistics per legislator (aggregated from posts).

| Column | Type | Description |
|--------|------|-------------|
| `lid` | TEXT | Legislator ID |
| `name` | TEXT | Legislator name |
| `handle` | TEXT | Social media handle |
| `state` | TEXT | State abbreviation |
| `chamber` | TEXT | Chamber (H/S) |
| `party` | TEXT | Party |
| `total_posts` | BIGINT | Total number of posts |
| `total_likes` | NUMERIC | Sum of all likes |
| `total_retweets` | NUMERIC | Sum of all retweets |
| `total_engagement` | NUMERIC | Sum of likes + retweets |
| `avg_interaction_score` | NUMERIC | Average interaction score |
| `avg_civility_score` | NUMERIC | Average civility score |
| `total_misinfo_posts` | NUMERIC | Total misinformation posts |
| `first_post_date` | DATE | Earliest post date |
| `last_post_date` | DATE | Latest post date |

**Query:**
```sql
SELECT l.lid, l.name, l.handle, l.state, l.chamber, l.party,
       count(p.id) AS total_posts,
       sum(p.like_count) AS total_likes,
       sum(p.retweet_count) AS total_retweets,
       sum((p.like_count + p.retweet_count)) AS total_engagement,
       avg(p.interaction_score) AS avg_interaction_score,
       avg(p.civility_score) AS avg_civility_score,
       sum(p.count_misinfo) AS total_misinfo_posts,
       min(p.created_at) AS first_post_date,
       max(p.created_at) AS last_post_date
FROM legislators l
LEFT JOIN posts p ON l.lid = p.lid
GROUP BY l.lid, l.name, l.handle, l.state, l.chamber, l.party;
```

---

## Materialized Views

### `topic_engagement_daily`

Daily aggregated engagement metrics per topic.

| Column | Type | Description |
|--------|------|-------------|
| `date` | DATE | Post date |
| `topic` | TEXT | Topic ID |
| `topic_label` | TEXT | Topic label |
| `post_count` | BIGINT | Number of posts |
| `total_likes` | NUMERIC | Sum of likes |
| `total_retweets` | NUMERIC | Sum of retweets |
| `total_engagement` | NUMERIC | Sum of likes + retweets |
| `avg_interaction_score` | NUMERIC | Average interaction score |
| `avg_civility_score` | NUMERIC | Average civility score |

**Query:**
```sql
SELECT p.created_at AS date,
       p.topic,
       t.topic_label,
       count(*) AS post_count,
       sum(p.like_count) AS total_likes,
       sum(p.retweet_count) AS total_retweets,
       sum((p.like_count + p.retweet_count)) AS total_engagement,
       avg(p.interaction_score) AS avg_interaction_score,
       avg(p.civility_score) AS avg_civility_score
FROM posts p
JOIN topics t ON p.topic = t.topic
GROUP BY p.created_at, p.topic, t.topic_label;
```

**Indexes:**
- `idx_topic_engagement_daily_date` on `date`
- `idx_topic_engagement_daily_date_topic` on `(date, topic)` (composite)
- `idx_topic_engagement_daily_topic` on `topic`

**Refresh:**
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY topic_engagement_daily;
```

---

### `topic_party_breakdown`

Topic engagement broken down by party.

| Column | Type | Description |
|--------|------|-------------|
| `topic` | TEXT | Topic ID |
| `topic_label` | TEXT | Topic label |
| `party` | TEXT | Party name |
| `post_count` | BIGINT | Number of posts |
| `total_likes` | NUMERIC | Sum of likes |
| `total_retweets` | NUMERIC | Sum of retweets |
| `total_engagement` | NUMERIC | Sum of likes + retweets |

**Query:**
```sql
SELECT p.topic,
       t.topic_label,
       l.party,
       count(*) AS post_count,
       sum(p.like_count) AS total_likes,
       sum(p.retweet_count) AS total_retweets,
       sum((p.like_count + p.retweet_count)) AS total_engagement
FROM posts p
JOIN topics t ON p.topic = t.topic
JOIN legislators l ON p.lid = l.lid
WHERE l.party IS NOT NULL
GROUP BY p.topic, t.topic_label, l.party;
```

**Indexes:**
- `idx_topic_party_breakdown_party` on `party`
- `idx_topic_party_breakdown_topic` on `topic`

**Refresh:**
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY topic_party_breakdown;
```

---

### `topic_state_breakdown`

Topic engagement broken down by state.

| Column | Type | Description |
|--------|------|-------------|
| `topic` | TEXT | Topic ID |
| `topic_label` | TEXT | Topic label |
| `state` | TEXT | State abbreviation |
| `post_count` | BIGINT | Number of posts |
| `total_likes` | NUMERIC | Sum of likes |
| `total_retweets` | NUMERIC | Sum of retweets |
| `total_engagement` | NUMERIC | Sum of likes + retweets |

**Query:**
```sql
SELECT p.topic,
       t.topic_label,
       l.state,
       count(*) AS post_count,
       sum(p.like_count) AS total_likes,
       sum(p.retweet_count) AS total_retweets,
       sum((p.like_count + p.retweet_count)) AS total_engagement
FROM posts p
JOIN topics t ON p.topic = t.topic
JOIN legislators l ON p.lid = l.lid
WHERE l.state IS NOT NULL
GROUP BY p.topic, t.topic_label, l.state;
```

**Indexes:**
- `idx_topic_state_breakdown_state` on `state`
- `idx_topic_state_breakdown_topic` on `topic`

**Refresh:**
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY topic_state_breakdown;
```

---

## Relationships

```
legislators (1) ──< (many) posts
  lid (PK)              lid (FK)

topics (1) ──< (many) posts
  topic (PK)            topic (FK)
```

- One legislator can have many posts (`posts.lid` → `legislators.lid`)
- One topic can have many posts (`posts.topic` → `topics.topic`)
- Deleting a legislator cascades to delete their posts
- Deleting a topic is restricted if posts reference it

---

## Index Summary

### Legislators Table
- 6 indexes (including 1 composite)

### Posts Table
- 13 indexes (including 5 composite, 1 GIN for full-text search)

### Topics Table
- 1 index

### Materialized Views
- 6 indexes total (2 per view)

**Total: 26 indexes**

---

## Common Query Patterns

### Date Range Queries
- Uses: `idx_posts_created_at`, `idx_posts_created_at_desc`
- Optimized for: `WHERE created_at BETWEEN ...`

### Legislator Lookups
- Uses: `idx_posts_lid`, `idx_posts_lid_date`
- Optimized for: `WHERE lid = ...` and date filtering

### Topic Filtering
- Uses: `idx_posts_topic`, `idx_posts_date_topic`
- Optimized for: `WHERE topic = ...` and date filtering

### Engagement Metrics
- Uses: `idx_posts_engagement`, `idx_posts_interaction_score`
- Optimized for: Sorting by likes, retweets, interaction scores

### Full-Text Search
- Uses: `idx_posts_text` (GIN index)
- Optimized for: `WHERE to_tsvector('english', text) @@ ...`

### Composite Queries
- Uses: Various composite indexes
- Optimized for: Multi-column WHERE clauses and JOINs

---

## Notes

- Materialized views are created `WITH NO DATA` and must be refreshed after data import
- The `posts` table has extensive indexing for performance on large datasets
- Full-text search is enabled on `posts.text` using PostgreSQL's `to_tsvector`
- Toxicity scores are stored as separate columns for granular analysis
- All timestamps use `timestamp without time zone`
