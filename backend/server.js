const app = require('./src/app');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // This allows access from any network interface

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
    });
    
    // Force close after 30s
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000);
};

const server = app.listen(PORT, HOST, () => {
    logger.info(`🚀 TruthLens Backend Server running on:`);
    logger.info(`   📱 Local:    http://localhost:${PORT}`);
    logger.info(`   🌐 Network:  http://172.16.32.11:${PORT}`);
    logger.info(`   📊 Environment: ${process.env.NODE_ENV}`);
    logger.info(`   🔗 Health check: http://172.16.32.11:${PORT}/api/health`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;
