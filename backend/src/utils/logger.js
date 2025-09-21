const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logFile = path.join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`);
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaString}\n`;
    }

    writeToFile(formattedMessage) {
        if (process.env.NODE_ENV !== 'test') {
            fs.appendFileSync(this.logFile, formattedMessage);
        }
    }

    info(message, meta = {}) {
        const formatted = this.formatMessage('info', message, meta);
        console.log(formatted.trim());
        this.writeToFile(formatted);
    }

    warn(message, meta = {}) {
        const formatted = this.formatMessage('warn', message, meta);
        console.warn(formatted.trim());
        this.writeToFile(formatted);
    }

    error(message, meta = {}) {
        const formatted = this.formatMessage('error', message, meta);
        console.error(formatted.trim());
        this.writeToFile(formatted);
    }

    debug(message, meta = {}) {
        if (this.logLevel === 'debug') {
            const formatted = this.formatMessage('debug', message, meta);
            console.log(formatted.trim());
            this.writeToFile(formatted);
        }
    }
}

module.exports = new Logger();
