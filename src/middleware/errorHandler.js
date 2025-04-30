const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // Loguear el error
  logger.error('Error en solicitud:', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Determinar el código de estado HTTP
  const statusCode = err.statusCode || 500;

  // Respuesta formateada
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    errorCode: err.code || 'INTERNAL_ERROR',
    // Solo incluir detalles en ambientes de desarrollo
    details: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    timestamp: new Date().toISOString(),
  });
}

module.exports = errorHandler;
