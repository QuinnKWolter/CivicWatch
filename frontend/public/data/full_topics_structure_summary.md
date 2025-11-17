# Full Topics Data Structure Summary

## full_topics.csv

**Format:** CSV file with one row per social media post/tweet

**Fields (18 columns):**
- `id` - Post/tweet ID
- `lid` - Legislator ID
- `name` - Legislator name
- `handle` - Social media handle
- `created_at` - Post creation date (YYYY-MM-DD format)
- `text` - Post content/text
- `attachment` - Attachment type (e.g., "cook")
- `state` - Two-letter state code
- `chamber` - Legislative chamber (H=House, S=Senate)
- `party` - Political party (Republican/Democratic)
- `retweet_count` - Number of retweets
- `like_count` - Number of likes
- `count_misinfo` - Misinformation count flag
- `interaction_score` - Calculated interaction score (float)
- `overperforming_score` - Overperforming score (float)
- `civility_score` - Civility score (float, 0.0-1.0)
- `topic` - Assigned topic ID (numeric string)
- `topic_probability` - Probability score for topic assignment (float)
- `topic_label` - Topic name/description

**Organization:** Flat structure with individual posts as rows. Each post is assigned to one topic with a probability score.

---

## full_topics_data.json

**Format:** JSON array of topic objects

**Structure:** Each topic object contains:
- `topic` - Topic ID (string, e.g., "-1", "1", "2")
- `count` - Total number of posts assigned to this topic (integer)
- `name` - Topic name/description (string, format: "{topic_id}_: {description}___")
- `party_breakdown` - Object with party counts:
  - `Republican` - Count of posts from Republican legislators
  - `Democratic` - Count of posts from Democratic legislators
- `state_breakdown` - Object with state counts:
  - Keys: Two-letter state codes (e.g., "NY", "CA", "TX")
  - Values: Count of posts from that state (integers)

**Organization:** Aggregated summary by topic. Each topic object provides counts broken down by party and state. The array contains all topics identified in the dataset.

**Relationship:** The JSON is an aggregated view of the CSV data, summarizing post counts per topic with party and state breakdowns.

---

## engagement_timeline.json

**Format:** JSON array of daily engagement objects

**Structure:** Each daily object contains:
- `date` - Date string in YYYY-MM-DD format (e.g., "2020-01-01")
- `{topic_label}` - One key per topic_label (top 50 by engagement), with engagement value (integer)
  - Engagement = `like_count + retweet_count` summed across all posts for that topic_label on that date
  - Only includes non-zero engagement values (sparse format)
  - Missing topic_labels for a given date are treated as 0 engagement

**Organization:** Time-series data aggregated by date. Each object represents one day and contains engagement metrics for the top 50 topic_labels by total engagement. The array is sorted chronologically by date.

**Usage:** This file is designed to replace the backend API endpoint `/api/flow/bipartite_data/` for the EngagementTimeline component. It provides daily engagement totals per topic_label, allowing the timeline visualization to display stacked area charts of topic activity over time. The component automatically displays all 50 topics when no matching topics are found in the activeTopics prop.

**Generation:** Created by `generate_engagement_timeline_top500.py` script which processes `full_topics.csv` and:
1. Identifies the top 50 topic_labels by total engagement
2. Aggregates engagement by date and topic_label
3. Only includes non-zero values to minimize file size

**Statistics:**
- Total records: 218 (one per day from 2020-01-01 to 2020-08-05)
- Unique topic_labels: 50 (top topics by engagement)
- Total engagement: ~323 million interactions
- File size: ~0.15 MB

**Relationship:** Derived from `full_topics.csv`, aggregating engagement metrics (likes + retweets) by date and topic_label. This provides the time-series data needed for the engagement timeline visualization.

