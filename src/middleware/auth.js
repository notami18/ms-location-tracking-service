const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

function authMiddleware(req, res, next) {
  // En desarrollo, omitir completamente la autenticación
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
    logger.debug('Modo desarrollo: Autenticación omitida');
    // Configurar un usuario ficticio para pruebas
    req.user = {
      id: 'test-user',
      name: 'Usuario de Prueba',
      role: 'admin'
    };
    return next();
  }

  try {
    // Obtener el token del encabezado Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Se requiere token de autenticación'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'desarrollo_secreto');
    
    // Añadir información del usuario al objeto de solicitud
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
}

module.exports = authMiddleware;