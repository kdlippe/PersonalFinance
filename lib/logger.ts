// Centralized Winston Logger
// Provides timestamped logging for console, files, and service logs

import winston from 'winston';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');

// Custom format with timestamps
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, service, stack }) => {
    const serviceTag = service ? `[${service}] ` : '';
    const baseMessage = `[${timestamp}] ${level.toUpperCase()}: ${serviceTag}${message}`;
    return stack ? `${baseMessage}\n${stack}` : baseMessage;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Console output (for stdout) - simple format for NSSM log capture
    new winston.transports.Console({
      format: customFormat
    }),
    // General application log
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Error log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Service-specific loggers with dedicated log files
export const priceUpdateLogger = logger.child({ 
  service: 'Price Update Service',
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'price-updates.log'),
      maxsize: 5242880,
      maxFiles: 5,
    })
  ]
});

export const netWorthLogger = logger.child({ 
  service: 'Net Worth Service',
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'net-worth.log'),
      maxsize: 5242880,
      maxFiles: 5,
    })
  ]
});

export const instrumentationLogger = logger.child({ 
  service: 'Instrumentation' 
});

// API route logger - drop-in replacement for console.log with timestamps
function formatArgs(...args: any[]): string {
  return args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
}

export const apiLogger = {
  info:  (...args: any[]) => logger.info(formatArgs(...args)),
  error: (...args: any[]) => logger.error(formatArgs(...args)),
  warn:  (...args: any[]) => logger.warn(formatArgs(...args)),
};

// Override console methods to use winston
if (process.env.NODE_ENV !== 'development') {
  console.log = (...args) => logger.info(args.join(' '));
  console.info = (...args) => logger.info(args.join(' '));
  console.warn = (...args) => logger.warn(args.join(' '));
  console.error = (...args) => logger.error(args.join(' '));
}

export default logger;
