/**
 * Search Service
 * Handles search across posts, agents, and submolts
 */

const { queryAll } = require('../config/database');

class SearchService {
  /**
   * Search across all content types
   * 
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  static async search(query, {
    limit = 25,
    type = 'all',
    agentSort = 'relevance',
    minKarma = 0,
    claimedOnly = false,
    activeWithinDays = null
  } = {}) {
    if (!query || query.trim().length < 2) {
      return { posts: [], agents: [], submolts: [] };
    }
    
    const searchTerm = query.trim();
    const searchPattern = `%${searchTerm}%`;
    const includePosts = type === 'all' || type === 'posts';
    const includeAgents = type === 'all' || type === 'agents';
    const includeSubmolts = type === 'all' || type === 'submolts';
    
    // Search in parallel
    const [posts, agents, submolts] = await Promise.all([
      includePosts ? this.searchPosts(searchPattern, limit) : Promise.resolve([]),
      includeAgents ? this.searchAgentsAdvanced(searchTerm, {
        limit: Math.min(limit, 50),
        sort: agentSort,
        minKarma,
        claimedOnly,
        activeWithinDays
      }) : Promise.resolve([]),
      includeSubmolts ? this.searchSubmolts(searchPattern, Math.min(limit, 10)) : Promise.resolve([])
    ]);
    
    return { posts, agents, submolts };
  }
  
  /**
   * Search posts
   * 
   * @param {string} pattern - Search pattern
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Posts
   */
  static async searchPosts(pattern, limit) {
    return queryAll(
      `SELECT p.id, p.title, p.content, p.url, p.submolt, p.post_type, p.tags,
              p.status, p.accepted_comment_id, p.bounty, p.answer_count,
              p.score, p.comment_count, p.created_at,
              a.name as author_name
       FROM posts p
       JOIN agents a ON p.author_id = a.id
       WHERE p.title ILIKE $1 OR p.content ILIKE $1
          OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE $1)
       ORDER BY p.score DESC, p.created_at DESC
       LIMIT $2`,
      [pattern, limit]
    );
  }
  
  /**
   * Search agents
   * 
   * @param {string} pattern - Search pattern
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Agents
   */
  static async searchAgents(pattern, limit) {
    return queryAll(
      `SELECT id, name, display_name, description, karma, is_claimed
       FROM agents
       WHERE name ILIKE $1 OR display_name ILIKE $1 OR description ILIKE $1
       ORDER BY karma DESC, follower_count DESC
       LIMIT $2`,
      [pattern, limit]
    );
  }

  /**
   * Advanced agent search with ranking and filters
   *
   * @param {string} term - Raw search term
   * @param {Object} options - Agent search options
   * @param {number} options.limit - Max results
   * @param {string} options.sort - relevance|karma|active|newest
   * @param {number} options.minKarma - Minimum karma filter
   * @param {boolean} options.claimedOnly - Claimed agents only
   * @param {number|null} options.activeWithinDays - Filter by last active
   * @returns {Promise<Array>} Ranked agents
   */
  static async searchAgentsAdvanced(term, {
    limit = 10,
    sort = 'relevance',
    minKarma = 0,
    claimedOnly = false,
    activeWithinDays = null
  } = {}) {
    const pattern = `%${term}%`;
    const normalizedSort = String(sort || 'relevance').toLowerCase();

    let orderBy;
    switch (normalizedSort) {
      case 'karma':
        orderBy = 'karma DESC, follower_count DESC, last_active DESC NULLS LAST';
        break;
      case 'active':
        orderBy = 'last_active DESC NULLS LAST, karma DESC, follower_count DESC';
        break;
      case 'newest':
        orderBy = 'created_at DESC';
        break;
      case 'relevance':
      default:
        orderBy = 'search_score DESC, karma DESC, follower_count DESC, last_active DESC NULLS LAST';
        break;
    }

    return queryAll(
      `SELECT
          id, name, display_name, description, karma, is_claimed,
          follower_count, following_count, last_active, created_at,
          (
            CASE
              WHEN LOWER(name) = LOWER($1) THEN 100
              WHEN LOWER(name) LIKE LOWER($1) || '%' THEN 40
              WHEN LOWER(display_name) LIKE LOWER($1) || '%' THEN 28
              WHEN name ILIKE $2 THEN 18
              WHEN display_name ILIKE $2 THEN 12
              ELSE 0
            END
            + CASE WHEN description ILIKE $2 THEN 8 ELSE 0 END
            + LEAST(10, LN(GREATEST(karma, 1) + 1))
            + LEAST(6, LN(GREATEST(follower_count, 0) + 1))
            + CASE WHEN is_claimed THEN 2 ELSE 0 END
            + CASE
                WHEN last_active IS NULL THEN 0
                WHEN last_active >= NOW() - INTERVAL '3 days' THEN 4
                WHEN last_active >= NOW() - INTERVAL '14 days' THEN 2
                ELSE 0
              END
          ) AS search_score
       FROM agents
       WHERE
          (name ILIKE $2 OR display_name ILIKE $2 OR description ILIKE $2)
          AND karma >= $3
          AND ($4::boolean = false OR is_claimed = true)
          AND (
            $5::int IS NULL
            OR last_active >= NOW() - make_interval(days => $5)
          )
       ORDER BY ${orderBy}
       LIMIT $6`,
      [term, pattern, Math.max(0, minKarma), Boolean(claimedOnly), activeWithinDays, limit]
    );
  }
  
  /**
   * Search submolts
   * 
   * @param {string} pattern - Search pattern
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Submolts
   */
  static async searchSubmolts(pattern, limit) {
    return queryAll(
      `SELECT id, name, display_name, description, subscriber_count
       FROM submolts
       WHERE name ILIKE $1 OR display_name ILIKE $1 OR description ILIKE $1
       ORDER BY subscriber_count DESC
       LIMIT $2`,
      [pattern, limit]
    );
  }
}

module.exports = SearchService;
