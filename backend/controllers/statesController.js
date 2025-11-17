import pool from '../config/database.js';

/**
 * GET /api/states/
 * Returns all unique states from the new schema
 * Query params: 
 *   - party: filter by party ('Democratic', 'Republican', or omit for all)
 *   - has_posts: if true, only return states with legislators who have posts (default: false)
 */
export async function getAllStates(req, res) {
  try {
    const party = req.query.party;
    const hasPosts = req.query.has_posts === 'true';
    
    let query = `
      SELECT DISTINCT
        l.state as abbr,
        l.state as name
      FROM legislators l
    `;
    
    const params = [];
    let paramIndex = 1;
    const conditions = ['l.state IS NOT NULL'];

    // If has_posts is true, join with posts to filter
    if (hasPosts) {
      query += ` INNER JOIN posts p ON l.lid = p.lid`;
    }

    if (party && party !== 'both') {
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

    query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY l.state`;

    const result = await pool.query(query, params);
    
    // Map to expected format with state name lookup
    const stateMap = {
      'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
      'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
      'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
      'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
      'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
      'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
      'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
      'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
      'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
      'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
      'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
      'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
      'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
    };

    const states = result.rows.map(row => ({
      abbr: row.abbr,
      name: stateMap[row.abbr] || row.abbr,
      count: 0 // Can be calculated if needed
    }));

    res.json(states);
  } catch (error) {
    console.error('Error fetching states:', error);
    res.status(500).json({ error: error.message });
  }
}
