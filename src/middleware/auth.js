const jwt = require('jsonwebtoken');

// JWT Secret para verificar tokens
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware para validar JWT en Express
exports.authenticate = (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No se proporcionó token de autenticación',
      });
    }

    // Extraer token (Bearer token)
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido',
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Añadir datos del usuario al request
    req.user = decoded;

    // Pasar al siguiente middleware
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);

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
};

// Función para verificar token
exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Error verificando token:', error);
    return null;
  }
};

// Lambda Authorizer para API REST
exports.authorize = async (event, context) => {
  try {
    // Extraer token
    const authHeader = event.headers && event.headers.Authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;

    if (!token) {
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Generar política de permiso
    return generatePolicy(
      decoded.sub || decoded.id || 'user',
      'Allow',
      event.methodArn,
      { userId: decoded.sub || decoded.id }
    );
  } catch (error) {
    console.error('Error en authorizer:', error);
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

exports.authorizeWebSocket = async (event, context) => {
  try {
    let token;

    // Extraer token del protocolo WebSocket
    if (event.headers && event.headers['Sec-WebSocket-Protocol']) {
      const protocols = event.headers['Sec-WebSocket-Protocol']
        .split(',')
        .map((p) => p.trim());
      const tokenProtocol = protocols.find((p) =>
        p.startsWith('bearer_token.')
      );

      if (tokenProtocol) {
        token = tokenProtocol.substring('bearer_token.'.length);
      }
    }

    // Si no se encuentra en el protocolo, intentar en query params como fallback
    if (
      !token &&
      event.queryStringParameters &&
      event.queryStringParameters.token
    ) {
      token = event.queryStringParameters.token;
    }

    if (!token) {
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    // Verificar token
    // Puedes adaptar esto a tu sistema de autenticación específico, por ejemplo Cognito
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Generar política de permiso
    return generatePolicy(
      decoded.sub || decoded.id || 'user',
      'Allow',
      event.methodArn,
      { userId: decoded.sub || decoded.id }
    );
  } catch (error) {
    console.error('Error en WebSocket authorizer:', error);
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

// Función auxiliar para generar política
function generatePolicy(principalId, effect, resource, context = {}) {
  const authResponse = {
    principalId,
  };

  if (effect && resource) {
    const policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    };

    authResponse.policyDocument = policyDocument;
  }

  // Incluir contexto adicional
  authResponse.context = context;

  return authResponse;
}
