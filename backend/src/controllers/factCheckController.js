const geminiService = require('../services/geminiService');
const imageProcessor = require('../utils/imageProcessor');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

class FactCheckController {
    async analyzeContent(req, res) {
        try {
            // Check for validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: 'Invalid input provided',
                    details: errors.array()
                });
            }

            const { content } = req.body;
            const imageFile = req.file;
            
            // Validate input
            if (!content && !imageFile) {
                return res.status(400).json({
                    error: 'Missing input',
                    message: 'Please provide either text content or an image to analyze'
                });
            }

            logger.info('Starting fact-check analysis', {
                hasContent: !!content,
                hasImage: !!imageFile,
                contentLength: content?.length || 0,
                imageSize: imageFile?.size || 0,
                clientIP: req.ip,
                userAgent: req.get('User-Agent')
            });

            let processedImage = null;
            
            // Process image if provided
            if (imageFile) {
                try {
                    processedImage = await imageProcessor.processImage(imageFile);
                    logger.info('Image processed successfully', {
                        originalSize: imageFile.size,
                        processedSize: processedImage.base64Data.length,
                        mimeType: processedImage.mimeType
                    });
                } catch (error) {
                    logger.error('Image processing failed:', error);
                    return res.status(400).json({
                        error: 'Image processing failed',
                        message: error.message
                    });
                }
            }

            // Perform Gemini analysis
            const analysisResult = await geminiService.analyzeContent(content, processedImage);
            
            // Clean up uploaded file
            if (imageFile) {
                imageProcessor.cleanup(imageFile.path);
            }

            // Log successful analysis
            logger.info('Analysis completed successfully', {
                credibilityScore: analysisResult.credibilityScore,
                verdict: analysisResult.verdict,
                hasGrounding: !!analysisResult.groundingMetadata,
                processingTime: Date.now() - req.startTime
            });

            // Return analysis results
            res.status(200).json({
                success: true,
                data: {
                    analysis: analysisResult,
                    metadata: {
                        timestamp: new Date().toISOString(),
                        processingTime: Date.now() - req.startTime,
                        requestId: req.id,
                        model: 'gemini-2.5-flash',
                        hasImage: !!imageFile,
                        hasGrounding: !!analysisResult.groundingMetadata
                    }
                }
            });

        } catch (error) {
            logger.error('Fact-check analysis failed:', error);
            
            // Clean up uploaded file on error
            if (req.file) {
                imageProcessor.cleanup(req.file.path);
            }

            // Handle specific error types
            if (error.message.includes('Rate limit exceeded')) {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: 'Too many requests. Please wait before trying again.',
                    retryAfter: 60
                });
            }
            
            if (error.message.includes('API key')) {
                return res.status(500).json({
                    error: 'Service configuration error',
                    message: 'AI service temporarily unavailable'
                });
            }

            res.status(500).json({
                error: 'Analysis failed',
                message: error.message || 'An unexpected error occurred during analysis',
                requestId: req.id
            });
        }
    }

    async getHealth(req, res) {
        try {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                services: {
                    gemini: 'operational',
                    imageProcessing: 'operational'
                }
            };

            res.status(200).json(health);
        } catch (error) {
            logger.error('Health check failed:', error);
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }
}

module.exports = new FactCheckController();
