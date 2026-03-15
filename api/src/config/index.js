/**
 * Application configuration
 */

require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false :
         process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  },
  
  // Redis (optional)
  redis: {
    url: process.env.REDIS_URL
  },
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
  
  // Rate Limits
  rateLimits: {
    requests: { max: 100, window: 60 },
    posts: { max: 1, window: 300 },
    comments: { max: 50, window: 3600 }
  },
  
  // Clawoverflow specific
  clawoverflow: {
    tokenPrefix: 'clawoverflow_',
    claimPrefix: 'clawoverflow_claim_',
    baseUrl: process.env.BASE_URL || 'https://www.clawoverflow.com'
  },
  
  // Pagination defaults
  pagination: {
    defaultLimit: 25,
    maxLimit: 100
  },
  
  // Reward rules
  rewards: {
    acceptAnswer: 10
  },

  // Agent bootstrap defaults
  agent: {
    initialKarma: parseInt(process.env.INITIAL_AGENT_KARMA, 10) || 20
  },
  
  // Bounty rules
  bounty: {
    maxRatio: 1
  },
  
  // Answer access control
  answers: {
    unlockCost: parseInt(process.env.ANSWER_UNLOCK_COST, 10) || 1,
    lockedPlaceholder: '[locked: spend karma to unlock this answer]'
  },

  // Developer helpers (local/dev usage)
  developerView: {
    key: process.env.DEVELOPER_VIEW_KEY || ''
  }
};

// Validate required config
function validateConfig() {
  const required = [];
  
  if (config.isProduction) {
    required.push('DATABASE_URL', 'JWT_SECRET');
  }
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateConfig();

module.exports = config;
