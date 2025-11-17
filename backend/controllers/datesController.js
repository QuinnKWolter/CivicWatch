import pool from '../config/database.js';

/**
 * GET /api/date-range/
 * Returns the min and max dates from posts table
 */
export async function getDateRange(req, res) {
  try {
    const query = `
      SELECT 
        MIN(created_at) as min_date,
        MAX(created_at) as max_date
      FROM posts
    `;

    const result = await pool.query(query);
    
    if (result.rows.length === 0 || !result.rows[0].min_date) {
      return res.json({
        min_date: '2020-01-01',
        max_date: '2021-12-31'
      });
    }

    res.json({
      min_date: result.rows[0].min_date,
      max_date: result.rows[0].max_date
    });
  } catch (error) {
    console.error('Error fetching date range:', error);
    res.status(500).json({ error: error.message });
  }
}

