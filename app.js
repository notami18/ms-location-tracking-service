const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { connectToDatabase } = require('./src/config/mongodb');
const locationRoutes = require('./src/routes/locationRoutes');
const deviceRoutes = require('./src/routes/deviceRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');

const path = require('path');
// Express app
const app = express();

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

// app.use(express.static('public'));

// // Opcionalmente, añadir una ruta específica para la interfaz web
// app.get('/dashboard', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

module.exports = app;
