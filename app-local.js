// app-local.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Importar rutas y controladores
const locationRoutes = require('./src/routes/locationRoutes');
const deviceRoutes = require('./src/routes/deviceRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const deviceHistoryRoutes = require('./src/routes/deviceHistoryRoutes');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');
const {
  onConnect,
  onDisconnect,
  onDefault,
  sendMessageToClient,
} = require('./src/websocket/handler');
const {
  storeConnection,
  deleteConnection,
} = require('./src/websocket/connection');

// Inicializar express
const app = express();
const server = http.createServer(app);

// Configuración de middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Rutas API REST
app.use('/api/locations', locationRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Rutas para el historial de dispositivos
app.use('/api/history', deviceHistoryRoutes);

// Ruta principal para la UI web
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});



// Configuración de WebSocket para desarrollo local
const wss = new WebSocket.Server({ server, path: '/ws' });

// Mantener registro de conexiones activas
const activeConnections = new Map();

// Configurar WebSocket Server
wss.on('connection', async function connection(ws, req) {
  // Extraer URL de la solicitud para obtener parámetros
  const url = new URL(req.url, `http://${req.headers.host}`);
  const connectionId = `conn_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 15)}`;

  // Registrar conexión
  activeConnections.set(connectionId, ws);
  logger.info(`Nueva conexión WebSocket: ${connectionId}`);

  // Simular event de API Gateway para onConnect
  const connectEvent = {
    requestContext: {
      connectionId: connectionId,
      authorizer: {
        principalId: 'anonymous-local',
      },
    },
  };

  // Almacenar conexión en DynamoDB o almacén local
  await onConnect(connectEvent);

  // Manejar mensajes
  ws.on('message', async function incoming(message) {
    try {
      const data = message.toString();
      logger.debug(`Mensaje recibido de ${connectionId}: ${data}`);

      // Simular event de API Gateway para onDefault
      const messageEvent = {
        requestContext: {
          connectionId: connectionId,
          domainName: 'localhost',
          stage: 'local',
        },
        body: data,
      };

      // Procesar mensaje
      await onDefault(messageEvent);
    } catch (error) {
      logger.error(`Error procesando mensaje de ${connectionId}:`, error);
    }
  });

  // Manejar cierre de conexión
  ws.on('close', async function close() {
    logger.info(`Conexión cerrada: ${connectionId}`);

    // Simular event de API Gateway para onDisconnect
    const disconnectEvent = {
      requestContext: {
        connectionId: connectionId,
      },
    };

    // Eliminar conexión de DynamoDB o almacén local
    await onDisconnect(disconnectEvent);

    // Eliminar de conexiones activas
    activeConnections.delete(connectionId);
  });

  // Manejar errores
  ws.on('error', function error(err) {
    logger.error(`Error en WebSocket ${connectionId}:`, err);
  });
});

// Función global para enviar mensajes a conexiones WebSocket
global.sendToConnection = async (connectionId, message) => {
  try {
    const ws = activeConnections.get(connectionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logger.warn(`Intento de enviar a conexión cerrada: ${connectionId}`);

      // Si la conexión no está disponible, eliminarla
      activeConnections.delete(connectionId);
      await deleteConnection(connectionId);
      return false;
    }

    ws.send(JSON.stringify(message));
    return true;
  } catch (error) {
    logger.error(`Error enviando mensaje a ${connectionId}:`, error);
    return false;
  }
};

// Middleware para manejar errores
app.use(errorHandler);

// Importar el servicio de WebSocket después de definir sendToConnection global
// Esto evita problemas de dependencia circular
const locationWebsocketService = require('./src/services/locationWebsocketService');
const locationPollingService = require('./src/services/locationPollingService');

// Configurar puerto
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || PORT;

// Iniciar servidor HTTP
server.listen(PORT, () => {
  logger.info(`Servidor iniciado en puerto ${PORT}`);
  logger.info(`WebSocket disponible en ws://localhost:${PORT}/ws`);

  // Establecer endpoint para el servicio de WebSocket
  locationWebsocketService.endpoint = `http://localhost:${PORT}`;

  // Iniciar el servicio de polling de ubicaciones
  locationPollingService.start();
});

// Manejar cierre del servidor
process.on('SIGINT', () => {
  logger.info('Cerrando servidor...');

  // Detener el servicio de polling
  locationPollingService.stop();

  // Cerrar conexiones WebSocket
  wss.clients.forEach((client) => {
    client.terminate();
  });

  // Cerrar servidor HTTP
  server.close(() => {
    logger.info('Servidor cerrado');
    process.exit(0);
  });
});

// Exportar app para testing
module.exports = app;
