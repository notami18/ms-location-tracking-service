// src/services/locationPollingService.js
const { connectToDatabase } = require('../config/mongodb');
const logger = require('../utils/logger');
const locationWebsocketService = require('./locationWebsocketService');

/**
 * Servicio para polling de nuevas ubicaciones en MongoDB
 */
class LocationPollingService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.pollingInterval = process.env.LOCATION_POLLING_INTERVAL || 5000; // 5 segundos por defecto
    this.lastCheckedTimestamps = new Map(); // Map para almacenar último timestamp por dispositivo
  }

  /**
   * Iniciar el servicio de polling
   */
  start() {
    if (this.isRunning) {
      logger.info('El servicio de polling ya está en ejecución');
      return;
    }

    logger.info(
      `Iniciando servicio de polling de ubicaciones cada ${this.pollingInterval}ms`
    );

    this.isRunning = true;
    this.intervalId = setInterval(
      () => this.checkForNewLocations(),
      this.pollingInterval
    );
  }

  /**
   * Detener el servicio de polling
   */
  stop() {
    if (!this.isRunning || !this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    logger.info('Servicio de polling de ubicaciones detenido');
  }

  /**
   * Verificar nuevas ubicaciones en MongoDB
   */
  async checkForNewLocations() {
    try {
      const db = await connectToDatabase();
      const collection = db.collection('deviceLocations');

      // Obtener todos los dispositivos activos con ubicaciones más recientes
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      // Buscar ubicaciones nuevas para cada dispositivo
      const activeDevices = await collection
        .aggregate([
          {
            $match: {
              timestamp: { $gte: twoHoursAgo },
              isActive: true,
            },
          },
          {
            $sort: { timestamp: -1 },
          },
          {
            $group: {
              _id: '$deviceId',
              latestLocation: { $first: '$$ROOT' },
            },
          },
        ])
        .toArray();

      logger.debug(`Encontrados ${activeDevices.length} dispositivos activos`);

      // Verificar cada dispositivo por nuevas ubicaciones
      for (const device of activeDevices) {
        const deviceId = device._id;
        const latestLocation = device.latestLocation;
        const lastCheckedTimestamp =
          this.lastCheckedTimestamps.get(deviceId) || new Date(0);

        // Si la ubicación es más reciente que la última verificada, enviarla
        if (latestLocation.timestamp > lastCheckedTimestamp) {
          logger.info(`Nueva ubicación detectada para ${deviceId}`);

          // Actualizar último timestamp verificado
          this.lastCheckedTimestamps.set(deviceId, latestLocation.timestamp);

          // Enviar actualización vía WebSocket
          await locationWebsocketService.broadcastLocationUpdate(
            latestLocation
          );
        }
      }
    } catch (error) {
      logger.error('Error en polling de ubicaciones:', error);
    }
  }
}

// Exportar como singleton
const pollingService = new LocationPollingService();
module.exports = pollingService;
