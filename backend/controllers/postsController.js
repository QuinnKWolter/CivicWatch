import pool from '../config/database.js';

/**
 * GET /api/export-posts-csv/
 * Exports filtered posts to CSV
 * Query params: start_date, end_date, topics (comma-separated), keyword, legislator (lid)
 */
export async function exportPostsCSV(req, res) {
  try {
    const { start_date, end_date, topics, keyword, legislator } = req.query;

    let query = `
      SELECT 
        p.id,
        p.tweet_id,
        l.name,
        l.handle,
        p.created_at,
        p.text,
        l.state,
        l.chamber,
        l.party,
        p.retweet_count,
        p.like_count,
        p.count_misinfo,
        p.tox_toxicity,
        p.political_score,
        p.is_political,
        t.topic,
        t.topic_label,
        p.topic_probability
      FROM posts p
      JOIN legislators l ON p.lid = l.lid
      JOIN topics t ON p.topic = t.topic
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (start_date) {
      query += ` AND p.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND p.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    if (topics) {
      const topicList = Array.isArray(topics) ? topics : topics.split(',');
      const placeholders = topicList.map((_, i) => `$${paramIndex + i}`).join(',');
      query += ` AND t.topic_label = ANY(ARRAY[${placeholders}])`;
      params.push(...topicList);
      paramIndex += topicList.length;
    }

    if (keyword) {
      query += ` AND p.text ILIKE $${paramIndex}`;
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    if (legislator) {
      query += ` AND p.lid = $${paramIndex}`;
      params.push(legislator);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await pool.query(query, params);

    // Convert to CSV format
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No posts found matching criteria' });
    }

    // CSV headers
    const headers = Object.keys(result.rows[0]);
    const csvRows = [
      headers.join(','),
      ...result.rows.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          // Escape quotes and wrap in quotes if contains comma or quote
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ];

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=posts_export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting posts CSV:', error);
    res.status(500).json({ error: error.message });
  }
}
