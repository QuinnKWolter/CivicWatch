import pool from '../config/database.js';

/**
 * GET /api/legislators/
 * Returns all legislators from the new schema
 * Query params:
 *   - party: filter by party ('D', 'R', 'Democratic', 'Republican', or omit for all)
 *   - state: filter by state abbreviation (e.g., 'CA', 'NY')
 *   - search: search by name (case-insensitive)
 *   - has_posts: if true, only return legislators who have posts (default: false)
 */
export async function getAllLegislators(req, res) {
  try {
    const party = req.query.party;
    const state = req.query.state;
    const search = req.query.search;
    const hasPosts = req.query.has_posts === 'true';
    
    let query = `
      SELECT DISTINCT
        l.lid as legislator_id,
        l.name,
        l.state,
        l.party,
        l.chamber,
        l.handle
      FROM legislators l
    `;
    
    const params = [];
    let paramIndex = 1;
    const conditions = [];

    // If has_posts is true, join with posts to filter
    if (hasPosts) {
      query += ` INNER JOIN posts p ON l.lid = p.lid`;
    }

    if (party && party !== 'both') {
      // Normalize party input
      let partyValue = party;
      if (party === 'D' || party === 'Democratic') {
        partyValue = 'Democratic';
      } else if (party === 'R' || party === 'Republican') {
        partyValue = 'Republican';
      }
      conditions.push(`l.party = $${paramIndex}`);
      params.push(partyValue);
      paramIndex++;
    }

    if (state) {
      conditions.push(`l.state = $${paramIndex}`);
      params.push(state.toUpperCase());
      paramIndex++;
    }

    if (search) {
      conditions.push(`l.name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY l.state, l.name`;

    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching legislators:', error);
    res.status(500).json({ error: error.message });
  }
}
