// app-local.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

// Importar routers
const deviceRoutes = require('./src/routes/deviceRoutes');
const locationRoutes = require('./src/routes/locationRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');

// WebSocket handlers
const {
  onConnect,
  onDisconnect,
  onDefault,
} = require('./src/websocket/handler');

// Middleware
const { authenticate } = require('./src/middleware/auth');
const errorHandler = require('./src/middleware/errorHandler');

// Crear aplicación Express
const app = express();
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocket.Server({
  server,
  path: '/ws', // Ruta para WebSocket
});

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rutas API
app.use('/api/devices', authenticate, deviceRoutes);
app.use('/api/locations', authenticate, locationRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);

// Ruta para obtener token JWT (solo para desarrollo)
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;

  // Validación simple para desarrollo
  if (username === 'demo' && password === 'demo') {
    const jwt = require('jsonwebtoken');

    // Crear token JWT válido por 24 horas
    const token = jwt.sign(
      { sub: 'user123', name: 'Demo User', roles: ['user'] },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } else {
    res.status(401).json({ message: 'Credenciales inválidas' });
  }
});

// Ruta para recibir actualizaciones simuladas (solo desarrollo)
app.post('/simulate-location-update', async (req, res) => {
  try {
    const locationData = req.body;

    // Importar función de broadcast
    const {
      broadcastToDeviceSubscribers,
    } = require('./src/websocket/broadcast');

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

    // Enviar a WebSocket (simulando respuesta de API Gateway)
    const clients = [...wss.clients];
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(locationMessage));
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error procesando ubicación simulada:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('Nueva conexión WebSocket');

  // En desarrollo, no validamos el token para simplificar pruebas
  // pero simulamos un connectionId como lo haría API Gateway
  const connectionId = Math.random().toString(36).substring(2, 15);
  ws.connectionId = connectionId;

  // Emular evento $connect
  const connectEvent = {
    requestContext: {
      connectionId,
      authorizer: {
        principalId: 'user123',
      },
    },
  };

  // Manejar conexión
  onConnect(connectEvent);

  // Manejar mensajes
  ws.on('message', (message) => {
    console.log('Mensaje recibido:', message.toString());

    // Emular evento de mensaje
    const messageEvent = {
      requestContext: {
        connectionId,
        domainName: 'localhost',
        stage: 'dev',
      },
      body: message.toString(),
    };

    // Procesar mensaje
    onDefault(messageEvent)
      .then(() => console.log('Mensaje procesado'))
      .catch((err) => console.error('Error procesando mensaje:', err));
  });

  // Manejar cierre de conexión
  ws.on('close', () => {
    console.log('Conexión cerrada:', connectionId);

    // Emular evento $disconnect
    const disconnectEvent = {
      requestContext: {
        connectionId,
      },
    };

    onDisconnect(disconnectEvent)
      .then(() => console.log('Desconexión procesada'))
      .catch((err) => console.error('Error procesando desconexión:', err));
  });

  // Enviar mensaje de bienvenida
  ws.send(
    JSON.stringify({
      type: 'connection',
      status: 'connected',
      connectionId,
    })
  );
});

// Mock del sendToConnection para desarrollo
global.sendToConnection = async (connectionId, message) => {
  // Buscar conexión por ID y enviar mensaje
  const clients = [...wss.clients];
  const targetClient = clients.find(
    (client) => client.connectionId === connectionId
  );

  if (targetClient && targetClient.readyState === WebSocket.OPEN) {
    targetClient.send(
      typeof message === 'string' ? message : JSON.stringify(message)
    );
    return true;
  }

  return false;
};

// Middleware de manejo de errores
app.use(errorHandler);

// Puerto
const PORT = process.env.PORT || 3000;

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
  console.log(`WebSocket disponible en ws://localhost:${PORT}/ws`);
});
