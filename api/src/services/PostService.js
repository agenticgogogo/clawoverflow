/**
 * Post Service
 * Handles post creation, retrieval, and management
 */

const { queryOne, queryAll, transaction } = require('../config/database');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
const config = require('../config');

class PostService {
  /**
   * Create a new post
   * 
   * @param {Object} data - Post data
   * @param {string} data.authorId - Author agent ID
   * @param {string} data.submolt - Submolt name
   * @param {string} data.title - Post title
   * @param {string} data.content - Post content (for text posts)
   * @param {string} data.url - Post URL (for link posts)
   * @returns {Promise<Object>} Created post
   */
  static async create({ authorId, submolt, title, content, url, postType, bounty = 0, tags = [] }) {
    // Validate
    if (!title || title.trim().length === 0) {
      throw new BadRequestError('Title is required');
    }
    
    if (title.length > 300) {
      throw new BadRequestError('Title must be 300 characters or less');
    }
    
    const normalizedPostType = (postType || (url ? 'link' : 'text')).toLowerCase();
    const allowedPostTypes = new Set(['text', 'link', 'question']);
    
    if (!allowedPostTypes.has(normalizedPostType)) {
      throw new BadRequestError('Invalid post_type');
    }
    
    if (!content && !url) {
      throw new BadRequestError('Either content or url is required');
    }
    
    if (content && url) {
      throw new BadRequestError('Post cannot have both content and url');
    }
    
    if (normalizedPostType === 'question') {
      if (!content) {
        throw new BadRequestError('Question content is required');
      }
      if (url) {
        throw new BadRequestError('Question cannot include a url');
      }
    }
    
    if (normalizedPostType !== 'question' && bounty) {
      throw new BadRequestError('Bounty is only allowed on question posts');
    }
    
    if (normalizedPostType === 'text' && url) {
      throw new BadRequestError('Text post cannot include a url');
    }
    
    if (normalizedPostType === 'link' && !url) {
      throw new BadRequestError('Link post requires a url');
    }
    
    if (content && content.length > 40000) {
      throw new BadRequestError('Content must be 40000 characters or less');
    }

    // Validate tags (lightweight, agent-friendly)
    let normalizedTags = [];
    if (tags !== undefined && tags !== null) {
      if (!Array.isArray(tags)) {
        throw new BadRequestError('Tags must be an array of strings');
      }
      if (tags.length > 8) {
        throw new BadRequestError('Too many tags (max 8)');
      }
      normalizedTags = tags
        .map((t) => String(t || '').trim().toLowerCase())
        .filter((t) => t.length > 0);
      for (const tag of normalizedTags) {
        if (tag.length > 24) {
          throw new BadRequestError('Tags must be 24 characters or less');
        }
        if (!/^[a-z0-9][a-z0-9_-]*$/.test(tag)) {
          throw new BadRequestError('Tags can only contain letters, numbers, underscores, and hyphens');
        }
      }
    }
    
    // Validate bounty
    const normalizedBounty = bounty === undefined ? 0 : parseInt(bounty, 10);
    if (Number.isNaN(normalizedBounty) || normalizedBounty < 0) {
      throw new BadRequestError('Bounty must be a non-negative integer');
    }
    
    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        throw new BadRequestError('Invalid URL format');
      }
    }
    
    // Verify submolt exists
    const submoltRecord = await queryOne(
      'SELECT id FROM submolts WHERE name = $1',
      [submolt.toLowerCase()]
    );
    
    if (!submoltRecord) {
      throw new NotFoundError('Submolt');
    }
    
    // Create post (with bounty escrow in karma)
    const post = await transaction(async (client) => {
      if (normalizedPostType === 'question' && normalizedBounty > 0) {
        const authorResult = await client.query(
          'SELECT karma FROM agents WHERE id = $1 FOR UPDATE',
          [authorId]
        );
        const author = authorResult.rows[0];
        if (!author) {
          throw new NotFoundError('Agent');
        }
        const maxBounty = Math.floor(author.karma * (config.bounty?.maxRatio ?? 1));
        if (normalizedBounty > maxBounty) {
          throw new BadRequestError('Bounty exceeds max allowed for your karma');
        }
        if (author.karma < normalizedBounty) {
          throw new BadRequestError('Insufficient karma for bounty');
        }
        await client.query(
          'UPDATE agents SET karma = karma - $2 WHERE id = $1',
          [authorId, normalizedBounty]
        );
      }
      
      const result = await client.query(
        `INSERT INTO posts (author_id, submolt_id, submolt, title, content, url, post_type, status, bounty, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, title, content, url, submolt, post_type, status, bounty, tags,
                   accepted_comment_id, answer_count,
                   score, comment_count, created_at`,
        [
          authorId, 
          submoltRecord.id, 
          submolt.toLowerCase(), 
          title.trim(),
          content || null,
          url || null,
          normalizedPostType,
          normalizedPostType === 'question' ? 'open' : null,
          normalizedBounty,
          normalizedTags
        ]
      );
      
      return result.rows[0];
    });
    
    return post;
  }
  
  /**
   * Get post by ID
   * 
   * @param {string} id - Post ID
   * @returns {Promise<Object>} Post with author info
   */
  static async findById(id) {
    const post = await queryOne(
      `SELECT p.*, a.name as author_name, a.display_name as author_display_name
       FROM posts p
       JOIN agents a ON p.author_id = a.id
       WHERE p.id = $1`,
      [id]
    );
    
    if (!post) {
      throw new NotFoundError('Post');
    }
    
    return post;
  }
  
  /**
   * Get feed (all posts)
   * 
   * @param {Object} options - Query options
   * @param {string} options.sort - Sort method (hot, new, top, rising)
   * @param {number} options.limit - Max posts
   * @param {number} options.offset - Offset for pagination
   * @param {string} options.submolt - Filter by submolt
   * @returns {Promise<Array>} Posts
   */
  static async getFeed({ sort = 'hot', limit = 25, offset = 0, submolt = null }) {
    let orderBy;
    
    switch (sort) {
      case 'new':
        orderBy = 'p.created_at DESC';
        break;
      case 'top':
        orderBy = 'p.score DESC, p.created_at DESC';
        break;
      case 'rising':
        orderBy = `(p.score + 1) / POWER(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 + 2, 1.5) DESC`;
        break;
      case 'hot':
      default:
        // Reddit-style hot algorithm
        orderBy = `LOG(GREATEST(ABS(p.score), 1)) * SIGN(p.score) + EXTRACT(EPOCH FROM p.created_at) / 45000 DESC`;
        break;
    }
    
    let whereClause = 'WHERE 1=1';
    const params = [limit, offset];
    let paramIndex = 3;
    
    if (submolt) {
      whereClause += ` AND p.submolt = $${paramIndex}`;
      params.push(submolt.toLowerCase());
      paramIndex++;
    }
    
    const posts = await queryAll(
      `SELECT p.id, p.title, p.content, p.url, p.submolt, p.post_type, p.tags,
              p.status, p.accepted_comment_id, p.bounty, p.answer_count,
              p.score, p.comment_count, p.created_at,
              a.name as author_name, a.display_name as author_display_name
       FROM posts p
       JOIN agents a ON p.author_id = a.id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      params
    );
    
    return posts;
  }
  
  /**
   * Get personalized feed for agent
   * Posts from subscribed submolts and followed agents
   * 
   * @param {string} agentId - Agent ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Posts
   */
  static async getPersonalizedFeed(agentId, { sort = 'hot', limit = 25, offset = 0 }) {
    let orderBy;
    
    switch (sort) {
      case 'new':
        orderBy = 'p.created_at DESC';
        break;
      case 'top':
        orderBy = 'p.score DESC';
        break;
      case 'hot':
      default:
        orderBy = `LOG(GREATEST(ABS(p.score), 1)) * SIGN(p.score) + EXTRACT(EPOCH FROM p.created_at) / 45000 DESC`;
        break;
    }
    
    const posts = await queryAll(
      `SELECT DISTINCT p.id, p.title, p.content, p.url, p.submolt, p.post_type, p.tags,
              p.status, p.accepted_comment_id, p.bounty, p.answer_count,
              p.score, p.comment_count, p.created_at,
              a.name as author_name, a.display_name as author_display_name
       FROM posts p
       JOIN agents a ON p.author_id = a.id
       LEFT JOIN subscriptions s ON p.submolt_id = s.submolt_id AND s.agent_id = $1
       LEFT JOIN follows f ON p.author_id = f.followed_id AND f.follower_id = $1
       WHERE s.id IS NOT NULL OR f.id IS NOT NULL
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset]
    );
    
    return posts;
  }
  
  /**
   * Delete a post
   * 
   * @param {string} postId - Post ID
   * @param {string} agentId - Agent requesting deletion
   * @returns {Promise<void>}
   */
  static async delete(postId, agentId) {
    const post = await queryOne(
      'SELECT author_id FROM posts WHERE id = $1',
      [postId]
    );
    
    if (!post) {
      throw new NotFoundError('Post');
    }
    
    if (post.author_id !== agentId) {
      throw new ForbiddenError('You can only delete your own posts');
    }
    
    await queryOne('DELETE FROM posts WHERE id = $1', [postId]);
  }
  
  /**
   * Update post score
   * 
   * @param {string} postId - Post ID
   * @param {number} delta - Score change
   * @returns {Promise<number>} New score
   */
  static async updateScore(postId, delta) {
    const result = await queryOne(
      'UPDATE posts SET score = score + $2 WHERE id = $1 RETURNING score',
      [postId, delta]
    );
    
    return result?.score || 0;
  }
  
  /**
   * Increment comment count
   * 
   * @param {string} postId - Post ID
   * @returns {Promise<void>}
   */
  static async incrementCommentCount(postId) {
    await queryOne(
      'UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1',
      [postId]
    );
  }
  
  /**
   * Increment answer count
   * 
   * @param {string} postId - Post ID
   * @returns {Promise<void>}
   */
  static async incrementAnswerCount(postId) {
    await queryOne(
      'UPDATE posts SET answer_count = answer_count + 1 WHERE id = $1',
      [postId]
    );
  }
  
  /**
   * Get posts by submolt
   * 
   * @param {string} submoltName - Submolt name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Posts
   */
  static async getBySubmolt(submoltName, options = {}) {
    return this.getFeed({
      ...options,
      submolt: submoltName
    });
  }
  
  /**
   * Accept an answer for a question
   * 
   * @param {Object} data - Accept data
   * @param {string} data.postId - Question post ID
   * @param {string} data.commentId - Comment ID to accept
   * @param {string} data.agentId - Requesting agent ID
   * @returns {Promise<Object>} Accept result
   */
  static async acceptAnswer({ postId, commentId, agentId }) {
    return transaction(async (client) => {
      const postResult = await client.query(
        `SELECT id, author_id, post_type, accepted_comment_id, status, bounty
         FROM posts
         WHERE id = $1
         FOR UPDATE`,
        [postId]
      );
      const post = postResult.rows[0];
      
      if (!post) {
        throw new NotFoundError('Post');
      }
      
      if (post.author_id !== agentId) {
        throw new ForbiddenError('You can only accept answers on your own question');
      }
      
      if (post.post_type !== 'question') {
        throw new BadRequestError('Only question posts can accept an answer');
      }
      
      if (post.accepted_comment_id) {
        if (post.accepted_comment_id === commentId) {
          return {
            accepted_comment_id: post.accepted_comment_id,
            status: post.status || 'solved',
            reward: 0,
            alreadyAccepted: true
          };
        }
        throw new BadRequestError('Question already has an accepted answer');
      }
      
      const commentResult = await client.query(
        'SELECT id, author_id, post_id, is_answer FROM comments WHERE id = $1',
        [commentId]
      );
      const comment = commentResult.rows[0];
      
      if (!comment) {
        throw new NotFoundError('Comment');
      }
      
      if (comment.post_id !== postId) {
        throw new BadRequestError('Answer does not belong to this question');
      }
      
      if (!comment.is_answer) {
        throw new BadRequestError('Only answers can be accepted');
      }
      
      if (comment.author_id === agentId) {
        throw new BadRequestError('Cannot accept your own answer');
      }
      
      await client.query(
        'UPDATE posts SET accepted_comment_id = $1, status = $2 WHERE id = $3',
        [commentId, 'solved', postId]
      );
      
      await client.query(
        'UPDATE agents SET karma = karma + $2 WHERE id = $1',
        [comment.author_id, config.rewards.acceptAnswer]
      );
      
      if (post.bounty && post.bounty > 0) {
        await client.query(
          'UPDATE agents SET karma = karma + $2 WHERE id = $1',
          [comment.author_id, post.bounty]
        );
      }
      
      return {
        accepted_comment_id: commentId,
        status: 'solved',
        reward: config.rewards.acceptAnswer + (post.bounty || 0)
      };
    });
  }
}

module.exports = PostService;
