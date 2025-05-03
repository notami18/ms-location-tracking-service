const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const http = require('http');
const { WebSocketServer } = require('ws');
const { connectToDatabase } = require('./src/config/mongodb');
const locationRoutes = require('./src/routes/locationRoutes');
const deviceRoutes = require('./src/routes/deviceRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');
const {
  onConnect,
  onDisconnect,
  onDefault,
} = require('./src/websocket/handler');
const path = require('path');

// Express app
const app = express();
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({
  server,
  path: '/ws', // Ruta para WebSocket
});

// Preconectar a MongoDB para optimizar cold starts en producción
if (process.env.NODE_ENV === 'production') {
  connectToDatabase()
    .then(() =>
      logger.info('Preconectado a MongoDB para optimizar cold starts')
    )
    .catch((err) => logger.error('Error en preconexión a MongoDB:', err));
}

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
); // Seguridad
app.use(
  cors({
    origin: '*', // O configura dominios específicos
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(compression()); // Compresión
app.use(express.json()); // Parseo de JSON
app.use(express.urlencoded({ extended: true }));

// Logging básico para cada solicitud
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Rutas - Asegúrate de que son middlewares válidos de Express
app.use('/api/locations', locationRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Ruta health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'location-tracking-api',
  });
});

// Ruta para simular actualizaciones de ubicación (solo en desarrollo)
if (
  process.env.NODE_ENV === 'development' ||
  process.env.IS_OFFLINE === 'true'
) {
  app.post('/simulate-location-update', (req, res) => {
    try {
      const locationData = req.body;

      // Formatear mensaje para WebSocket
      const locationMessage = {
        type: 'locationUpdate',
        deviceId: locationData.deviceId,
        data: {
          lat: locationData.lat,
          lng: locationData.lng,
          timestamp: locationData.timestamp,
          accuracy: locationData.accuracy,
          speed: locationData.speed,
          city: locationData.city,
          isMock: locationData.isMock,
        },
      };

      // Enviar a todos los clientes conectados
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(locationMessage));
        }
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Error procesando ubicación simulada:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  logger.info('Nueva conexión WebSocket');

  // Extraer token del protocolo o query params
  let token;
  if (req.headers['sec-websocket-protocol']) {
    const protocols = req.headers['sec-websocket-protocol']
      .split(',')
      .map((p) => p.trim());
    const tokenProtocol = protocols.find((p) => p.startsWith('bearer_token.'));
    if (tokenProtocol) {
      token = tokenProtocol.substring('bearer_token.'.length);
    }
  }

  // Fallback a query params
  if (!token && req.url.includes('?')) {
    const params = new URLSearchParams(req.url.substring(req.url.indexOf('?')));
    token = params.get('token');
  }

  // Verificar token (en producción esto lo maneja Lambda Authorizer)
  let isAuthenticated = false;
  let userId = 'anonymous';

  if (
    process.env.NODE_ENV === 'development' ||
    process.env.IS_OFFLINE === 'true'
  ) {
    // En desarrollo, aceptamos todas las conexiones
    isAuthenticated = true;
    userId = 'dev-user';
  } else if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      isAuthenticated = true;
      userId = decoded.sub || decoded.id || 'user';
    } catch (error) {
      logger.error('Error verificando token WebSocket:', error);
    }
  }

  if (!isAuthenticated) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  // Generar connectionId único
  const connectionId = Math.random().toString(36).substring(2, 15);
  ws.connectionId = connectionId;

  // Crear contexto similar a API Gateway
  const connectEvent = {
    requestContext: {
      connectionId,
      authorizer: {
        principalId: userId,
      },
    },
  };

  // Manejar conexión
  onConnect(connectEvent);

  // Manejar mensajes
  ws.on('message', (message) => {
    try {
      const messageData = JSON.parse(message.toString());
      logger.info(`Mensaje recibido de ${connectionId}:`, messageData);

      // Emular evento de API Gateway
      const messageEvent = {
        requestContext: {
          connectionId,
          domainName: req.headers.host,
          stage: 'dev',
        },
        body: message.toString(),
      };

      // Procesar mensaje según su acción
      onDefault(messageEvent)
        .then(() => logger.info('Mensaje procesado correctamente'))
        .catch((err) => logger.error('Error procesando mensaje:', err));
    } catch (error) {
      logger.error('Error procesando mensaje WebSocket:', error);
    }
  });

  // Manejar cierre de conexión
  ws.on('close', () => {
    logger.info(`Conexión WebSocket cerrada: ${connectionId}`);

    const disconnectEvent = {
      requestContext: {
        connectionId,
      },
    };

    onDisconnect(disconnectEvent).catch((err) =>
      logger.error('Error procesando desconexión:', err)
    );
  });

  // Enviar mensaje de confirmación
  ws.send(
    JSON.stringify({
      type: 'connection',
      status: 'connected',
      connectionId,
    })
  );
});

// Función global para enviar mensajes a conexiones (usado por broadcast.js)
global.sendToConnection = async (connectionId, message) => {
  const clients = Array.from(wss.clients);
  const targetClient = clients.find(
    (client) => client.connectionId === connectionId
  );

  if (targetClient && targetClient.readyState === 1) {
    // WebSocket.OPEN
    try {
      targetClient.send(
        typeof message === 'string' ? message : JSON.stringify(message)
      );
      return true;
    } catch (error) {
      logger.error(`Error enviando mensaje a ${connectionId}:`, error);
      return false;
    }
  }

  return false;
};

// Manejo de rutas no encontradas
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Recurso no encontrado',
    path: req.path,
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware de manejo de errores
app.use(errorHandler);

// Exportar server HTTP en lugar de app
module.exports = { app, server };
