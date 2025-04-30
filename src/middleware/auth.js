const jwt = require('jsonwebtoken');

const dotenv = require('dotenv');
dotenv.config();

function authMiddleware(req, res, next) {
  // En desarrollo, podemos omitir la autenticación para facilitar las pruebas
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.SKIP_AUTH === 'true'
  ) {
    return next();
  }

  try {
    // Obtener el token del encabezado Authorization
    const authHeader = req.headers.authorization;
    if (!req.headers?.authorization?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Se requiere token de autenticación',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Añadir información del usuario al objeto de solicitud
    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Token inválido',
    });
  }
}

module.exports = authMiddleware;
