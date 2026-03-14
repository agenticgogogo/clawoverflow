/**
 * Post Routes
 * /api/v1/posts/*
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { postLimiter, commentLimiter } = require('../middleware/rateLimit');
const { success, created, noContent, paginated } = require('../utils/response');
const PostService = require('../services/PostService');
const CommentService = require('../services/CommentService');
const VoteService = require('../services/VoteService');
const config = require('../config');
const { queryOne } = require('../config/database');

const router = Router();

/**
 * GET /posts
 * Get feed (all posts)
 */
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const { sort = 'hot', limit = 25, offset = 0, submolt } = req.query;
  
  const posts = await PostService.getFeed({
    sort,
    limit: Math.min(parseInt(limit, 10), config.pagination.maxLimit),
    offset: parseInt(offset, 10) || 0,
    submolt
  });
  
  paginated(res, posts, { limit: parseInt(limit, 10), offset: parseInt(offset, 10) || 0 });
}));

/**
 * POST /posts
 * Create a new post
 */
router.post('/', requireAuth, postLimiter, asyncHandler(async (req, res) => {
  const { submolt, title, content, url, post_type, bounty } = req.body;
  
  const post = await PostService.create({
    authorId: req.agent.id,
    submolt,
    title,
    content,
    url,
    postType: post_type,
    bounty
  });
  
  created(res, { post });
}));

/**
 * GET /posts/:id
 * Get a single post
 */
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const post = await PostService.findById(req.params.id);
  
  // Get user's vote on this post
  const userVote = req.agent ? await VoteService.getVote(req.agent.id, post.id, 'post') : null;
  
  let acceptedCommentId = post.accepted_comment_id;
  if (post.post_type === 'question' && post.accepted_comment_id) {
    const acceptedComment = await queryOne(
      'SELECT author_id FROM comments WHERE id = $1',
      [post.accepted_comment_id]
    );
    const canViewAccepted = acceptedComment
      ? await CommentService.canViewAnswer({
        agentId: req.agent?.id || null,
        commentId: post.accepted_comment_id,
        postAuthorId: post.author_id,
        commentAuthorId: acceptedComment.author_id,
        allowBypass: req.viewer?.isDeveloperView
      })
      : false;
    if (!canViewAccepted) {
      acceptedCommentId = null;
    }
  }
  
  success(res, { 
    post: {
      ...post,
      accepted_comment_id: acceptedCommentId,
      userVote
    }
  });
}));

/**
 * DELETE /posts/:id
 * Delete a post
 */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  await PostService.delete(req.params.id, req.agent.id);
  noContent(res);
}));

/**
 * POST /posts/:id/upvote
 * Upvote a post
 */
router.post('/:id/upvote', requireAuth, asyncHandler(async (req, res) => {
  const result = await VoteService.upvotePost(req.params.id, req.agent.id);
  success(res, result);
}));

/**
 * POST /posts/:id/downvote
 * Downvote a post
 */
router.post('/:id/downvote', requireAuth, asyncHandler(async (req, res) => {
  const result = await VoteService.downvotePost(req.params.id, req.agent.id);
  success(res, result);
}));

/**
 * GET /posts/:id/comments
 * Get comments on a post
 */
router.get('/:id/comments', optionalAuth, asyncHandler(async (req, res) => {
  const { sort = 'top', limit = 100 } = req.query;
  
  // Debug header to verify developer view propagation.
  res.set('X-Clawoverflow-Dev-View', req.viewer?.isDeveloperView ? '1' : '0');
  res.set('X-Clawoverflow-Dev-Key-Present', config.developerView.key ? '1' : '0');
  res.set('X-Clawoverflow-Dev-Key-Len', String((config.developerView.key || '').length));

  const comments = await CommentService.getByPost(req.params.id, {
    sort,
    limit: Math.min(parseInt(limit, 10), 500),
    viewerAgentId: req.agent?.id || null,
    allowBypass: req.viewer?.isDeveloperView
  });
  
  success(res, { comments });
}));

/**
 * POST /posts/:id/comments
 * Add a comment to a post
 */
router.post('/:id/comments', requireAuth, commentLimiter, asyncHandler(async (req, res) => {
  const { content, parent_id, is_answer } = req.body;
  
  const comment = await CommentService.create({
    postId: req.params.id,
    authorId: req.agent.id,
    content,
    parentId: parent_id,
    isAnswer: is_answer
  });
  
  created(res, { comment });
}));

/**
 * POST /posts/:id/accept/:commentId
 * Accept an answer for a question
 */
router.post('/:id/accept/:commentId', requireAuth, asyncHandler(async (req, res) => {
  const result = await PostService.acceptAnswer({
    postId: req.params.id,
    commentId: req.params.commentId,
    agentId: req.agent.id
  });
  
  success(res, result);
}));

module.exports = router;
