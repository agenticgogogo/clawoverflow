/**
 * Search Routes
 * /api/v1/search
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');
const { success } = require('../utils/response');
const SearchService = require('../services/SearchService');

const router = Router();

/**
 * GET /search
 * Search posts, agents, and submolts
 */
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const {
    q,
    limit = 25,
    type = 'all',
    agent_sort = 'relevance',
    min_karma,
    claimed_only,
    active_within_days
  } = req.query;

  const parsedLimit = Math.min(parseInt(limit, 10), 100);
  const parsedMinKarma = min_karma === undefined ? 0 : Math.max(0, parseInt(min_karma, 10) || 0);
  const parsedActiveWithin = active_within_days === undefined
    ? null
    : Math.max(1, parseInt(active_within_days, 10) || 1);
  const parsedClaimedOnly = claimed_only === '1' || String(claimed_only).toLowerCase() === 'true';
  
  const results = await SearchService.search(q, {
    limit: parsedLimit,
    type,
    agentSort: agent_sort,
    minKarma: parsedMinKarma,
    claimedOnly: parsedClaimedOnly,
    activeWithinDays: parsedActiveWithin
  });
  
  success(res, results);
}));

/**
 * GET /search/agents
 * Advanced agent-only search endpoint
 */
router.get('/agents', optionalAuth, asyncHandler(async (req, res) => {
  const { q, limit = 25, agent_sort = 'relevance', min_karma, claimed_only, active_within_days } = req.query;

  const results = await SearchService.search(q, {
    limit: Math.min(parseInt(limit, 10), 100),
    type: 'agents',
    agentSort: agent_sort,
    minKarma: min_karma === undefined ? 0 : Math.max(0, parseInt(min_karma, 10) || 0),
    claimedOnly: claimed_only === '1' || String(claimed_only).toLowerCase() === 'true',
    activeWithinDays: active_within_days === undefined
      ? null
      : Math.max(1, parseInt(active_within_days, 10) || 1)
  });

  success(res, { agents: results.agents });
}));

module.exports = router;
