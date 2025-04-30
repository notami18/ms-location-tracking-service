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
app.use(helmet()); // Seguridad
app.use(cors()); // CORS
app.use(compression()); // Compresión
app.use(express.json()); // Parseo de JSON
app.use(express.urlencoded({ extended: true }));

// Logging básico para cada solicitud
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

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

// Middleware de manejo de errores
app.use(errorHandler);

module.exports = app;
