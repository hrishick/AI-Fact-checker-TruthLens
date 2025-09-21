const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class ImageProcessor {
    async processImage(file) {
        try {
            logger.info('Processing image', { 
                filename: file.filename, 
                size: file.size,
                mimetype: file.mimetype 
            });

            // Read the image file
            const imageBuffer = await fs.readFile(file.path);
            
            // Get image metadata
            const metadata = await sharp(imageBuffer).metadata();
            
            // Optimize image if too large
            let processedBuffer = imageBuffer;
            
            if (file.size > 5 * 1024 * 1024 || metadata.width > 2048 || metadata.height > 2048) {
                // Resize and compress large images
                processedBuffer = await sharp(imageBuffer)
                    .resize(2048, 2048, { 
                        fit: 'inside', 
                        withoutEnlargement: true 
                    })
                    .jpeg({ 
                        quality: 85, 
                        progressive: true 
                    })
                    .toBuffer();
                
                logger.info('Image optimized', {
                    originalSize: file.size,
                    processedSize: processedBuffer.length,
                    reduction: Math.round((1 - processedBuffer.length / file.size) * 100) + '%'
                });
            }

            // Convert to base64
            const base64Data = processedBuffer.toString('base64');
            
            // Determine MIME type
            const mimeType = this.getMimeType(file.mimetype, metadata.format);

            return {
                base64Data,
                mimeType,
                metadata: {
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format,
                    size: processedBuffer.length,
                    originalSize: file.size,
                    filename: file.filename
                }
            };

        } catch (error) {
            logger.error('Image processing error:', error);
            throw new Error(`Failed to process image: ${error.message}`);
        }
    }

    getMimeType(originalMimeType, detectedFormat) {
        // Map Sharp's format names to MIME types
        const formatMap = {
            'jpeg': 'image/jpeg',
            'jpg': 'image/jpeg', 
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
        };

        return formatMap[detectedFormat] || originalMimeType || 'image/jpeg';
    }

    async cleanup(filePath) {
        try {
            if (filePath && await this.fileExists(filePath)) {
                await fs.unlink(filePath);
                logger.info('Temporary file cleaned up', { filePath });
            }
        } catch (error) {
            logger.warn('Failed to cleanup temporary file', { filePath, error: error.message });
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    // Validate image file
    validateImage(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = parseInt(process.env.MAX_IMAGE_SIZE) || 10 * 1024 * 1024; // 10MB

        if (!file) {
            throw new Error('No image file provided');
        }

        if (!allowedTypes.includes(file.mimetype)) {
            throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
        }

        if (file.size > maxSize) {
            throw new Error(`File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`);
        }

        return true;
    }
}

module.exports = new ImageProcessor();
