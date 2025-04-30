const winston = require('winston');

// Configurar niveles de log según el entorno
const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Crear formato personalizado
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Crear logger
const logger = winston.createLogger({
  level,
  format,
  defaultMeta: { service: 'ms-location-tracking-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message}`
        )
      )
    })
  ]
});

// En producción, también escribir a CloudWatch si estamos en AWS Lambda
if (process.env.NODE_ENV === 'production' && process.env.AWS_LAMBDA_FUNCTION_NAME) {
  logger.info('Running in AWS Lambda environment, logs will be sent to CloudWatch');
}

module.exports = logger;