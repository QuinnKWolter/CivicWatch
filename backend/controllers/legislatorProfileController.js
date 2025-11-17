import pool from '../config/database.js';

/**
 * GET /api/legislators/:lid/profile
 * Returns detailed profile for a specific legislator
 */
export async function getLegislatorProfile(req, res) {
  try {
    const { lid } = req.params;
    const { start_date, end_date, topics } = req.query;

    // Get legislator info
    const legQuery = 'SELECT * FROM legislators WHERE lid = $1';
    const legResult = await pool.query(legQuery, [lid]);
    
    if (legResult.rows.length === 0) {
      return res.status(404).json({ error: 'Legislator not found' });
    }

    const legislator = legResult.rows[0];

    // Build filter for posts
    let postFilter = 'WHERE p.lid = $1';
    const params = [lid];
    let paramIndex = 2;

    if (start_date) {
      postFilter += ` AND p.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      postFilter += ` AND p.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    if (topics) {
      const topicList = Array.isArray(topics) ? topics : topics.split(',');
      const placeholders = topicList.map((_, i) => `$${paramIndex + i}`).join(',');
      postFilter += ` AND t.topic_label = ANY(ARRAY[${placeholders}])`;
      params.push(...topicList);
      paramIndex += topicList.length;
    }

    // Get metrics
    const metricsQuery = `
      SELECT 
        COUNT(*) as total_posts,
        SUM(p.like_count + p.retweet_count) as total_engagement,
        SUM(p.like_count) as total_likes,
        SUM(p.retweet_count) as total_retweets,
        AVG(p.interaction_score) as avg_interaction_score,
        AVG(p.civility_score) as avg_civility_score,
        SUM(CASE WHEN p.civility_score < 0.5 THEN 1 ELSE 0 END) as uncivil_posts,
        SUM(p.count_misinfo) as low_credibility_posts
      FROM posts p
      JOIN topics t ON p.topic = t.topic
      ${postFilter}
    `;

    const metricsResult = await pool.query(metricsQuery, params);
    const metrics = metricsResult.rows[0] || {};

    // Get total counts for percentage calculations
    const totalCountsQuery = `
      SELECT 
        COUNT(*) as total_posts,
        SUM(p.like_count + p.retweet_count) as total_engagement
      FROM posts p
      JOIN topics t ON p.topic = t.topic
      ${postFilter}
    `;
    const totalCountsResult = await pool.query(totalCountsQuery, params);
    const totalPosts = parseInt(totalCountsResult.rows[0]?.total_posts) || 1;
    const totalEngagement = parseInt(totalCountsResult.rows[0]?.total_engagement) || 1;

    // Get top topics by posts
    const topTopicsByPostsQuery = `
      SELECT 
        t.topic_label as name,
        t.topic_label,
        COUNT(*) as post_count
      FROM posts p
      JOIN topics t ON p.topic = t.topic
      ${postFilter}
      GROUP BY t.topic_label
      ORDER BY post_count DESC
      LIMIT 10
    `;

    // Get top topics by engagement
    const topTopicsByEngagementQuery = `
      SELECT 
        t.topic_label as name,
        t.topic_label,
        SUM(p.like_count + p.retweet_count) as engagement
      FROM posts p
      JOIN topics t ON p.topic = t.topic
      ${postFilter}
      GROUP BY t.topic_label
      ORDER BY engagement DESC
      LIMIT 10
    `;

    const [topicsByPostsResult, topicsByEngagementResult] = await Promise.all([
      pool.query(topTopicsByPostsQuery, params),
      pool.query(topTopicsByEngagementQuery, params)
    ]);

    const profile = {
      legislator_id: legislator.lid,
      name: legislator.name,
      party: legislator.party,
      state: legislator.state,
      chamber: legislator.chamber,
      handle: legislator.handle,
      metrics: {
        totalPosts: parseInt(metrics.total_posts) || 0,
        totalEngagement: parseInt(metrics.total_engagement) || 0,
        uncivilPosts: parseInt(metrics.uncivil_posts) || 0,
        lowCredibilityPosts: parseInt(metrics.low_credibility_posts) || 0
      },
      breakdowns: {
        posts: {
          twitter: parseInt(metrics.total_posts) || 0, // Assuming all are Twitter for now
          facebook: 0
        },
        engagement: {
          likes: parseInt(metrics.total_likes) || 0,
          shares: parseInt(metrics.total_retweets) || 0
        }
      },
      topTopicsByPosts: topicsByPostsResult.rows.map(row => ({
        name: row.name,
        topic_label: row.topic_label,
        value: Math.round((parseInt(row.post_count) / totalPosts) * 100 * 100) / 100
      })),
      topTopicsByEngagement: topicsByEngagementResult.rows.map(row => ({
        name: row.name,
        topic_label: row.topic_label,
        value: Math.round((parseInt(row.engagement) / totalEngagement) * 100 * 100) / 100
      }))
    };

    res.json(profile);
  } catch (error) {
    console.error('Error fetching legislator profile:', error);
    res.status(500).json({ error: error.message });
  }
}

