const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const rateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.MAX_REQUESTS_PER_HOUR) || 100,
    message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: 3600
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
        });
        
        res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: 3600
        });
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/api/health';
    }
});

module.exports = { rateLimiter };
