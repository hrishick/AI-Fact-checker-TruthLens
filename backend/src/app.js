const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');
const factCheckRoutes = require('./routes/factCheck');
const { rateLimiter } = require('./middleware/rateLimiter');

const app = express();

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", "https://generativelanguage.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS Configuration
// CORS Configuration - UPDATED
// CORS Configuration - Updated for local network access
// CORS Configuration - Updated for local network access
// CORS Configuration - Updated for ngrok
const corsOptions = {
    origin: [
        // Local development
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:8080',
        'http://127.0.0.1:5500',
        'http://localhost:5500',
        
        // Network access
        'http://172.16.32.11:5500',
        'http://172.16.32.11:3000',
        'http://172.16.32.11:8080',
        
        // ngrok domains - Allow all ngrok subdomains
        /^https:\/\/.*\.ngrok-free\.app$/,
        /^https:\/\/.*\.ngrok\.app$/,
        /^https:\/\/.*\.ngrok\.io$/,
        
        // Development environments
        process.env.FRONTEND_URL,
        process.env.NGROK_FRONTEND_URL
    ].filter(Boolean), // Remove undefined values
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'ngrok-skip-browser-warning'],
    exposedHeaders: ['Content-Length', 'X-Request-Id']
};

app.use(cors(corsOptions));

// Handle ngrok browser warning
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});


app.use(cors(corsOptions));

// Add explicit OPTIONS handler for preflight requests
app.options('*', cors(corsOptions));


app.use(cors(corsOptions));

// Add explicit OPTIONS handler for preflight requests
app.options('*', cors(corsOptions));


app.use(cors(corsOptions));

// Add explicit OPTIONS handler for preflight requests
app.options('*', cors(corsOptions));


app.use(cors(corsOptions));

// Request Logging
app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
}));

// Body Parsing
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static Files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate Limiting
app.use(rateLimiter);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

// API Routes
app.use('/api/fact-check', factCheckRoutes);

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: `The requested endpoint ${req.originalUrl} does not exist`,
        availableEndpoints: [
            'GET /api/health',
            'POST /api/fact-check/analyze'
        ]
    });
});

// Global Error Handler
app.use((error, req, res, next) => {
    logger.error('Global error handler:', error);
    
    // Multer errors (file upload)
    if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            error: 'File too large',
            message: 'Image file must be less than 10MB'
        });
    }
    
    // Validation errors
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation error',
            message: error.message,
            details: error.errors
        });
    }
    
    // Default error response
    res.status(error.status || 500).json({
        error: error.name || 'Internal Server Error',
        message: error.message || 'Something went wrong',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

module.exports = app;
