const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');

const factCheckController = require('../controllers/factCheckController');
const { validateFactCheck } = require('../middleware/validation');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueId}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_IMAGE_SIZE) || 10 * 1024 * 1024, // 10MB default
        files: 1
    }
});

// Middleware to add request ID and start time
router.use((req, res, next) => {
    req.id = uuidv4();
    req.startTime = Date.now();
    next();
});

// Validation middleware
const validateAnalyzeRequest = [
    body('content')
        .optional()
        .isLength({ min: 1, max: 10000 })
        .withMessage('Content must be between 1 and 10000 characters')
        .trim()
        .escape()
];

// Routes
router.post('/analyze', 
    upload.single('image'),
    validateAnalyzeRequest,
    validateFactCheck,
    factCheckController.analyzeContent
);

router.get('/health', factCheckController.getHealth);

module.exports = router;
