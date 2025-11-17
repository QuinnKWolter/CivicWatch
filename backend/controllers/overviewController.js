import pool from '../config/database.js';

/**
 * GET /api/default_overview_data/
 * Returns overview metrics aggregated by party
 * Query params: start_date, end_date, topics (comma-separated)
 */
export async function getDefaultOverviewData(req, res) {
  try {
    const { start_date, end_date, topics, party } = req.query;

    // Build base filter
    let baseFilter = '';
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      baseFilter += ` AND p.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      baseFilter += ` AND p.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    if (topics) {
      const topicList = Array.isArray(topics) ? topics : topics.split(',');
      const placeholders = topicList.map((_, i) => `$${paramIndex + i}`).join(',');
      baseFilter += ` AND t.topic_label = ANY(ARRAY[${placeholders}])`;
      params.push(...topicList);
      paramIndex += topicList.length;
    }

    // Build party filter - if party is specified, only show that party
    let partyFilter = `WHERE l.party IN ('Democratic', 'Republican')`;
    if (party && party !== 'both') {
      // Map 'D' to 'Democratic', 'R' to 'Republican'
      const partyMap = { 'D': 'Democratic', 'R': 'Republican' };
      const partyValue = partyMap[party] || party;
      partyFilter = `WHERE l.party = $${paramIndex}`;
      params.push(partyValue);
      paramIndex++;
    }

    // Get summary metrics by party
    const query = `
      SELECT 
        l.party,
        COUNT(DISTINCT p.id) as total_posts,
        SUM(p.like_count) as total_likes,
        SUM(p.retweet_count) as total_retweets,
        COUNT(DISTINCT l.lid) as number_legislators,
        AVG(p.interaction_score) as avg_interaction_score,
        SUM(CASE WHEN p.civility_score < 0.5 THEN 1 ELSE 0 END) as uncivil_posts,
        SUM(p.count_misinfo) as low_credibility_posts
      FROM posts p
      JOIN legislators l ON p.lid = l.lid
      JOIN topics t ON p.topic = t.topic
      ${partyFilter}
        ${baseFilter}
      GROUP BY l.party
    `;

    const result = await pool.query(query, params);

    const summaryMetrics = {
      Democratic: {
        totalPosts: 0,
        totalLikes: 0,
        totalRetweets: 0,
        numberLegislators: 0,
        avgInteractionScore: 0.0,
        mostActiveState: null,
        uncivilPosts: 0,
        lowCredibilityPosts: 0
      },
      Republican: {
        totalPosts: 0,
        totalLikes: 0,
        totalRetweets: 0,
        numberLegislators: 0,
        avgInteractionScore: 0.0,
        mostActiveState: null,
        uncivilPosts: 0,
        lowCredibilityPosts: 0
      }
    };

    // Get most active state for each party
    for (const party of ['Democratic', 'Republican']) {
      const stateQuery = `
        SELECT 
          l.state,
          COUNT(DISTINCT p.id) as post_count
        FROM posts p
        JOIN legislators l ON p.lid = l.lid
        JOIN topics t ON p.topic = t.topic
        WHERE l.party = $1
          ${baseFilter.replace(/\$(\d+)/g, (match, num) => {
            const newNum = parseInt(num) + 1;
            return `$${newNum}`;
          })}
          AND l.state IS NOT NULL
        GROUP BY l.state
        ORDER BY post_count DESC
        LIMIT 1
      `;
      const stateParams = [party, ...params];
      const stateResult = await pool.query(stateQuery, stateParams);
      const mostActiveState = stateResult.rows[0]?.state || null;

      const row = result.rows.find(r => r.party === party);
      if (row) {
        summaryMetrics[party] = {
          totalPosts: parseInt(row.total_posts) || 0,
          totalLikes: parseInt(row.total_likes) || 0,
          totalRetweets: parseInt(row.total_retweets) || 0,
          numberLegislators: parseInt(row.number_legislators) || 0,
          avgInteractionScore: parseFloat(row.avg_interaction_score) || 0.0,
          mostActiveState: mostActiveState,
          uncivilPosts: parseInt(row.uncivil_posts) || 0,
          lowCredibilityPosts: parseInt(row.low_credibility_posts) || 0
        };
      } else {
        summaryMetrics[party] = {
          totalPosts: 0,
          totalLikes: 0,
          totalRetweets: 0,
          numberLegislators: 0,
          avgInteractionScore: 0.0,
          mostActiveState: mostActiveState,
          uncivilPosts: 0,
          lowCredibilityPosts: 0
        };
      }
    }

    res.json({ summaryMetrics });
  } catch (error) {
    console.error('Error fetching overview data:', error);
    res.status(500).json({ error: error.message });
  }
}
