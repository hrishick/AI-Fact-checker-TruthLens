const logger = require('../utils/logger');

const validateFactCheck = (req, res, next) => {
    try {
        const { content } = req.body;
        const imageFile = req.file;

        // Log request details
        logger.info('Validating fact-check request', {
            hasContent: !!content,
            hasImage: !!imageFile,
            contentLength: content?.length || 0,
            imageSize: imageFile?.size || 0,
            ip: req.ip
        });

        // At least one input is required
        if (!content && !imageFile) {
            return res.status(400).json({
                error: 'Missing input',
                message: 'Please provide either text content or an image to analyze'
            });
        }

        // Validate content length
        if (content && content.length > 10000) {
            return res.status(400).json({
                error: 'Content too long',
                message: 'Text content must be less than 10,000 characters'
            });
        }

        // Validate image if provided
        if (imageFile) {
            const maxSize = parseInt(process.env.MAX_IMAGE_SIZE) || 10 * 1024 * 1024;
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

            if (!allowedTypes.includes(imageFile.mimetype)) {
                return res.status(400).json({
                    error: 'Invalid file type',
                    message: 'Only JPEG, PNG, GIF, and WebP images are allowed'
                });
            }

            if (imageFile.size > maxSize) {
                return res.status(400).json({
                    error: 'File too large',
                    message: `Image must be less than ${Math.round(maxSize / 1024 / 1024)}MB`
                });
            }
        }

        next();
    } catch (error) {
        logger.error('Validation error:', error);
        res.status(500).json({
            error: 'Validation failed',
            message: error.message
        });
    }
};

module.exports = { validateFactCheck };
