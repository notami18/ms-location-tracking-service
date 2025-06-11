// src/services/locationWebsocketService.js
const { broadcastToDeviceSubscribers } = require('../websocket/broadcast');
const logger = require('../utils/logger');
const { connectToDatabase } = require('../config/mongodb');

/**
 * Servicio para gestionar la integración entre las ubicaciones y WebSockets
 */
class LocationWebsocketService {
  constructor() {
    this.endpoint =
      process.env.WEBSOCKET_API_ENDPOINT || 'http://localhost:3001';
  }

  /**
   * Broadcast de una nueva ubicación a todos los suscriptores
   * @param {Object} locationData - Datos de ubicación recibidos
   * @returns {Promise<Object>} - Resultado del broadcast
   */
  async broadcastLocationUpdate(locationData) {
    try {
      if (!locationData || !locationData.deviceId) {
        logger.warn('Intento de broadcast sin deviceId');
        return { success: false, error: 'Datos de ubicación inválidos' };
      }
      
      // Añadir para depuración
      logger.info(`Procesando actualización para dispositivo: ${locationData.deviceId}`);
      console.log('Datos recibidos:', JSON.stringify(locationData));

      // Formatear datos para el cliente
      const formattedLocation = {
        deviceId: locationData.deviceId,
        timestamp: locationData.timestamp,
        location: {
          lat: locationData.location.coordinates[1],
          lng: locationData.location.coordinates[0],
        },
        accuracy: locationData.accuracy || 0,
        city: locationData.city || 'Desconocido',
        isMock: locationData.isMock || false,
        isActive: locationData.isActive || true,
        battery: locationData.battery || 0,
        heading: locationData.heading || 0,
        speed: locationData.speed || 0,
      };

      // Preparar mensaje de actualización
      const message = {
        type: 'location_update',
        data: formattedLocation,
        timestamp: new Date().toISOString(),
      };

      // Realizar broadcast a los suscriptores
      const result = await broadcastToDeviceSubscribers(
        this.endpoint,
        locationData.deviceId,
        message
      );

      logger.info(
        `Broadcast completado para ${locationData.deviceId}: ${result.sent}/${result.total} conexiones`
      );
      return result;
    } catch (error) {
      logger.error('Error en broadcast de ubicación:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene los dispositivos activos directamente de MongoDB
   * @returns {Promise<Object>} - Lista de dispositivos activos
   */
  async getActiveDevices() {
    try {
      const db = await connectToDatabase();
      const locationCollection = db.collection('deviceLocations');

      // Definir "activo" como dispositivos con ubicación en las últimas 2 horas y con isActive en true
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      // Obtener los dispositivos activos directamente desde deviceLocations
      const activeDevices = await locationCollection
        .aggregate([
          {
            $match: {
              timestamp: { $gte: twoHoursAgo },
              isActive: true, // Filtrar por dispositivos activos
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

      // Formatear los datos para la respuesta
      const devicesWithLocation = activeDevices.map((device) => ({
        deviceId: device._id,
        lastSeen: device.latestLocation.timestamp,
        location: {
          lat: device.latestLocation.location.coordinates[1],
          lng: device.latestLocation.location.coordinates[0],
          timestamp: device.latestLocation.timestamp,
          accuracy: device.latestLocation.accuracy || 0,
          city: device.latestLocation.city || 'Desconocido',
          isMock: device.latestLocation.isMock || false,
        },
      }));

      return {
        success: true,
        count: devicesWithLocation.length,
        devices: devicesWithLocation,
      };
    } catch (error) {
      logger.error('Error obteniendo dispositivos activos:', error);
      return {
        success: false,
        error: error.message,
        devices: [],
      };
    }
  }

  /**
   * Broadcast del estado de todos los dispositivos activos
   * @returns {Promise<Object>} - Resultado del broadcast
   */
  async broadcastActiveDevicesStatus() {
    try {
      // Obtener dispositivos activos directamente de MongoDB
      const activeDevicesResult = await this.getActiveDevices();

      if (!activeDevicesResult.success) {
        throw new Error('Error obteniendo dispositivos activos');
      }

      // Preparar mensaje con todos los dispositivos activos
      const message = {
        type: 'active_devices_update',
        data: activeDevicesResult.devices,
        count: activeDevicesResult.count,
        timestamp: new Date().toISOString(),
      };

      // Broadcast a todos los suscritos a 'all'
      const result = await broadcastToDeviceSubscribers(
        this.endpoint,
        'all',
        message
      );

      logger.info(
        `Broadcast de dispositivos activos completado: ${result.sent}/${result.total} conexiones`
      );

      return {
        success: true,
        broadcast: result,
        devices: activeDevicesResult,
      };
    } catch (error) {
      logger.error('Error en broadcast de dispositivos activos:', error);

      return {
        success: false,
        error: error.message,
        devices: {
          success: false,
          count: 0,
          devices: [],
        },
      };
    }
  }
}

// Exportar como singleton
module.exports = new LocationWebsocketService();
