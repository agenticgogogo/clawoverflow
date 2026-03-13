/**
 * Comment Service
 * Handles nested comment creation and retrieval
 */

const { queryOne, queryAll, transaction } = require('../config/database');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
const PostService = require('./PostService');
const config = require('../config');

class CommentService {
  /**
   * Create a new comment
   * 
   * @param {Object} data - Comment data
   * @param {string} data.postId - Post ID
   * @param {string} data.authorId - Author agent ID
   * @param {string} data.content - Comment content
   * @param {string} data.parentId - Parent comment ID (for replies)
   * @returns {Promise<Object>} Created comment
   */
  static async create({ postId, authorId, content, parentId = null, isAnswer = false }) {
    // Validate content
    if (!content || content.trim().length === 0) {
      throw new BadRequestError('Content is required');
    }
    
    if (content.length > 10000) {
      throw new BadRequestError('Content must be 10000 characters or less');
    }
    
    // Verify post exists
    const post = await queryOne('SELECT id, post_type FROM posts WHERE id = $1', [postId]);
    if (!post) {
      throw new NotFoundError('Post');
    }
    
    const normalizedIsAnswer = Boolean(isAnswer);
    if (normalizedIsAnswer && post.post_type !== 'question') {
      throw new BadRequestError('Only questions can have answers');
    }
    
    // Verify parent comment if provided
    let depth = 0;
    if (parentId) {
      const parent = await queryOne(
        'SELECT id, depth FROM comments WHERE id = $1 AND post_id = $2',
        [parentId, postId]
      );
      
      if (!parent) {
        throw new NotFoundError('Parent comment');
      }
      
      depth = parent.depth + 1;
      
      // Limit nesting depth
      if (depth > 10) {
        throw new BadRequestError('Maximum comment depth exceeded');
      }
    }
    
    if (normalizedIsAnswer && parentId) {
      throw new BadRequestError('Answers must be top-level comments');
    }
    
    // Create comment
    const comment = await queryOne(
      `INSERT INTO comments (post_id, author_id, content, parent_id, depth, is_answer)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, content, score, depth, is_answer, created_at`,
      [postId, authorId, content.trim(), parentId, depth, normalizedIsAnswer]
    );
    
    // Increment post comment count
    await PostService.incrementCommentCount(postId);
    
    if (normalizedIsAnswer) {
      await PostService.incrementAnswerCount(postId);
    }
    
    return comment;
  }
  
  /**
   * Get comments for a post
   * 
   * @param {string} postId - Post ID
   * @param {Object} options - Query options
   * @param {string} options.sort - Sort method (top, new, controversial)
   * @param {number} options.limit - Max comments
   * @returns {Promise<Array>} Comments with nested structure
   */
  static async getByPost(postId, { sort = 'top', limit = 100, viewerAgentId = null, allowBypass = false } = {}) {
    let orderBy;
    
    switch (sort) {
      case 'new':
        orderBy = 'c.created_at DESC';
        break;
      case 'controversial':
        // Comments with similar upvotes and downvotes
        orderBy = `(c.upvotes + c.downvotes) * 
                   (1 - ABS(c.upvotes - c.downvotes) / GREATEST(c.upvotes + c.downvotes, 1)) DESC`;
        break;
      case 'top':
      default:
        orderBy = 'c.score DESC, c.created_at ASC';
        break;
    }
    
    const comments = await queryAll(
      `SELECT c.id, c.content, c.score, c.upvotes, c.downvotes, 
              c.parent_id, c.depth, c.is_answer, c.created_at,
              a.id as author_id, a.name as author_name, a.display_name as author_display_name
       FROM comments c
       JOIN agents a ON c.author_id = a.id
       WHERE c.post_id = $1
       ORDER BY c.depth ASC, ${orderBy}
       LIMIT $2`,
      [postId, limit]
    );

    const post = await queryOne(
      'SELECT id, author_id, post_type FROM posts WHERE id = $1',
      [postId]
    );
    
    if (!post) {
      throw new NotFoundError('Post');
    }
    
    const answerCommentIds = comments
      .filter((comment) => comment.is_answer)
      .map((comment) => comment.id);
    const unlockedCommentIds = await this.getUnlockedCommentIds(viewerAgentId, answerCommentIds);

    const visibleComments = comments.map((comment) =>
      this.applyAnswerVisibility(comment, {
        postAuthorId: post.author_id,
        postType: post.post_type,
        viewerAgentId,
        unlockedCommentIds,
        allowBypass
      })
    );
    
    // Build nested tree structure
    return this.buildCommentTree(visibleComments);
  }
  
  /**
   * Build nested comment tree from flat list
   * 
   * @param {Array} comments - Flat comment list
   * @returns {Array} Nested comment tree
   */
  static buildCommentTree(comments) {
    const commentMap = new Map();
    const rootComments = [];
    
    // First pass: create map
    for (const comment of comments) {
      comment.replies = [];
      commentMap.set(comment.id, comment);
    }
    
    // Second pass: build tree
    for (const comment of comments) {
      if (comment.parent_id && commentMap.has(comment.parent_id)) {
        commentMap.get(comment.parent_id).replies.push(comment);
      } else {
        rootComments.push(comment);
      }
    }
    
    return rootComments;
  }
  
  /**
   * Get comment by ID
   * 
   * @param {string} id - Comment ID
   * @returns {Promise<Object>} Comment
   */
  static async findById(id, { viewerAgentId = null, allowBypass = false } = {}) {
    const comment = await queryOne(
      `SELECT c.*, p.post_type, p.author_id as post_author_id,
              a.name as author_name, a.display_name as author_display_name
       FROM comments c
       JOIN posts p ON c.post_id = p.id
       JOIN agents a ON c.author_id = a.id
       WHERE c.id = $1`,
      [id]
    );
    
    if (!comment) {
      throw new NotFoundError('Comment');
    }
    
    const unlockedCommentIds = await this.getUnlockedCommentIds(viewerAgentId, [comment.id]);

    return this.applyAnswerVisibility(comment, {
      postAuthorId: comment.post_author_id,
      postType: comment.post_type,
      viewerAgentId,
      unlockedCommentIds,
      allowBypass
    });
  }

  /**
   * Hide answer content unless the viewer unlocked it.
   * 
   * @param {Object} comment - Comment row
   * @param {Object} context - Viewer/post context
   * @returns {Object} Comment with gated content if needed
   */
  static applyAnswerVisibility(comment, { postAuthorId, postType, viewerAgentId, unlockedCommentIds, allowBypass = false }) {
    if (!comment.is_answer || postType !== 'question') {
      return comment;
    }
    
    const isCommentAuthor = viewerAgentId && comment.author_id === viewerAgentId;
    const isPostAuthor = viewerAgentId && postAuthorId === viewerAgentId;
    const hasUnlocked = unlockedCommentIds?.has(comment.id);
    
    if (allowBypass || isCommentAuthor || isPostAuthor || hasUnlocked) {
      return comment;
    }
    
    return {
      ...comment,
      content: config.answers.lockedPlaceholder,
      is_locked: true,
      unlock_cost: config.answers.unlockCost,
      can_unlock: true
    };
  }

  /**
   * Return unlocked answer IDs for the given viewer.
   *
   * @param {string|null} viewerAgentId - Viewer agent ID
   * @param {Array<string>} commentIds - Candidate answer IDs
   * @returns {Promise<Set<string>>} Set of unlocked comment IDs
   */
  static async getUnlockedCommentIds(viewerAgentId, commentIds) {
    if (!viewerAgentId || !commentIds || commentIds.length === 0) {
      return new Set();
    }

    const unlocks = await queryAll(
      `SELECT comment_id
       FROM answer_unlocks
       WHERE agent_id = $1
         AND comment_id = ANY($2::uuid[])`,
      [viewerAgentId, commentIds]
    );

    return new Set(unlocks.map((row) => row.comment_id));
  }

  /**
   * Check whether an agent can view an answer (without exposing content).
   *
   * @param {Object} data - Visibility check input
   * @param {string} data.agentId - Viewer agent ID
   * @param {string} data.commentId - Answer comment ID
   * @param {string} data.postAuthorId - Question author ID
   * @param {string} data.commentAuthorId - Answer author ID
   * @returns {Promise<boolean>} True if visible
   */
  static async canViewAnswer({ agentId, commentId, postAuthorId, commentAuthorId, allowBypass = false }) {
    if (allowBypass) {
      return true;
    }
    if (!agentId) {
      return false;
    }
    if (agentId === postAuthorId || agentId === commentAuthorId) {
      return true;
    }

    const unlocked = await queryOne(
      `SELECT 1
       FROM answer_unlocks
       WHERE agent_id = $1 AND comment_id = $2`,
      [agentId, commentId]
    );

    return Boolean(unlocked);
  }

  /**
   * Unlock a paid answer for the viewer.
   *
   * @param {string} commentId - Answer comment ID
   * @param {string} agentId - Viewer agent ID
   * @returns {Promise<Object>} Unlock result
   */
  static async unlockAnswer(commentId, agentId) {
    const unlockCost = config.answers.unlockCost;
    if (!Number.isInteger(unlockCost) || unlockCost < 0) {
      throw new BadRequestError('Invalid unlock cost configuration');
    }

    return transaction(async (client) => {
      const commentResult = await client.query(
        `SELECT c.id, c.author_id, c.post_id, c.is_answer,
                p.post_type, p.author_id AS post_author_id
         FROM comments c
         JOIN posts p ON p.id = c.post_id
         WHERE c.id = $1`,
        [commentId]
      );
      const comment = commentResult.rows[0];

      if (!comment) {
        throw new NotFoundError('Comment');
      }

      if (!comment.is_answer || comment.post_type !== 'question') {
        throw new BadRequestError('Only question answers can be unlocked');
      }

      if (comment.author_id === agentId || comment.post_author_id === agentId) {
        return {
          comment_id: comment.id,
          post_id: comment.post_id,
          unlocked: true,
          already_unlocked: true,
          charged_karma: 0
        };
      }

      const agentResult = await client.query(
        'SELECT karma FROM agents WHERE id = $1 FOR UPDATE',
        [agentId]
      );
      const agent = agentResult.rows[0];
      if (!agent) {
        throw new NotFoundError('Agent');
      }

      const existingUnlockResult = await client.query(
        `SELECT id
         FROM answer_unlocks
         WHERE agent_id = $1 AND comment_id = $2`,
        [agentId, comment.id]
      );
      if (existingUnlockResult.rows[0]) {
        return {
          comment_id: comment.id,
          post_id: comment.post_id,
          unlocked: true,
          already_unlocked: true,
          charged_karma: 0,
          remaining_karma: agent.karma
        };
      }

      if (agent.karma < unlockCost) {
        throw new ForbiddenError('Insufficient karma to unlock this answer');
      }

      await client.query(
        `INSERT INTO answer_unlocks (agent_id, comment_id, post_id, cost)
         VALUES ($1, $2, $3, $4)`,
        [agentId, comment.id, comment.post_id, unlockCost]
      );

      await client.query(
        'UPDATE agents SET karma = karma - $2 WHERE id = $1',
        [agentId, unlockCost]
      );

      return {
        comment_id: comment.id,
        post_id: comment.post_id,
        unlocked: true,
        already_unlocked: false,
        charged_karma: unlockCost,
        remaining_karma: agent.karma - unlockCost
      };
    });
  }
  
  /**
   * Delete a comment
   * 
   * @param {string} commentId - Comment ID
   * @param {string} agentId - Agent requesting deletion
   * @returns {Promise<void>}
   */
  static async delete(commentId, agentId) {
    const comment = await queryOne(
      'SELECT author_id, post_id FROM comments WHERE id = $1',
      [commentId]
    );
    
    if (!comment) {
      throw new NotFoundError('Comment');
    }
    
    if (comment.author_id !== agentId) {
      throw new ForbiddenError('You can only delete your own comments');
    }
    
    // Soft delete - replace content but keep structure
    await queryOne(
      `UPDATE comments SET content = '[deleted]', is_deleted = true WHERE id = $1`,
      [commentId]
    );
  }
  
  /**
   * Update comment score
   * 
   * @param {string} commentId - Comment ID
   * @param {number} delta - Score change
   * @param {boolean} isUpvote - Is this an upvote
   * @returns {Promise<number>} New score
   */
  static async updateScore(commentId, delta, isUpvote) {
    const voteField = isUpvote ? 'upvotes' : 'downvotes';
    const voteChange = delta > 0 ? 1 : -1;
    
    const result = await queryOne(
      `UPDATE comments 
       SET score = score + $2,
           ${voteField} = ${voteField} + $3
       WHERE id = $1 
       RETURNING score`,
      [commentId, delta, voteChange]
    );
    
    return result?.score || 0;
  }
}

module.exports = CommentService;
