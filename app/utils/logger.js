const winston = require('winston');
const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        logFormat
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log' 
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: 'logs/exceptions.log' 
        })
    ]
});

// Para promises não tratadas
process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Rejection: ${reason.stack || reason}`);
});

module.exports = logger;