// src/routes/deviceHistoryRoutes.js
const express = require('express');
const router = express.Router();
const { connectToDatabase } = require('../config/mongodb');
const logger = require('../utils/logger');

// Determinar si estamos en entorno de desarrollo
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.IS_OFFLINE === 'true';

// Implementar funciones de servicio directamente para evitar dependencias circulares
// Obtener todos los dispositivos que han reportado ubicaciones
async function getAllDevices(options = {}) {
  try {
    const db = await connectToDatabase();
    logger.info('Conexión a MongoDB establecida para historial de dispositivos');
    
    const collection = db.collection('deviceLocations');
    
    // Construir filtro
    const filter = {};
    
    // Filtrar por fecha si se especifica
    if (options.days && options.days > 0) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - options.days);
      filter.timestamp = { $gte: daysAgo };
    }
    
    // Filtrar por activos si se especifica
    if (options.onlyActive) {
      filter.isActive = true;
    }
    
    logger.info(`Buscando dispositivos con filtro: ${JSON.stringify(filter)}`);
    
    // Obtener todos los dispositivos únicos con su última ubicación
    const devices = await collection.aggregate([
      { 
        $match: filter 
      },
      {
        $sort: { timestamp: -1 } // Ordenar por más reciente primero
      },
      {
        $group: {
          _id: '$deviceId',
          lastSeen: { $first: '$timestamp' },
          location: { $first: '$location' },
          accuracy: { $first: '$accuracy' },
          city: { $first: '$city' },
          isActive: { $first: '$isActive' },
          isMock: { $first: '$isMock' },
        }
      },
      {
        $project: {
          _id: 0,
          deviceId: '$_id',
          lastSeen: 1,
          location: 1,
          accuracy: 1,
          city: 1,
          isActive: 1,
          isMock: 1
        }
      },
      {
        $sort: { lastSeen: -1 } // Ordenar resultado final por última vez visto
      }
    ]).toArray();
    
    logger.info(`Obtenidos ${devices.length} dispositivos históricos`);
    return devices;
  } catch (error) {
    logger.error('Error obteniendo historial de dispositivos:', error);
    throw error;
  }
}

// Obtener el historial de actividad de un dispositivo
async function getDeviceHistory(deviceId, options = {}) {
  try {
    const db = await connectToDatabase();
    const collection = db.collection('deviceLocations');
    
    // Construir filtro
    const filter = { deviceId };
    
    // Filtrar por fecha si se especifica
    if (options.days && options.days > 0) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - options.days);
      filter.timestamp = { $gte: daysAgo };
    }
    
    // Configurar límite y ordenamiento
    const limit = options.limit && options.limit > 0 ? options.limit : 0;
    
    // Obtener historial de ubicaciones
    const history = await collection
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    logger.info(`Obtenidos ${history.length} registros históricos para ${deviceId}`);
    return history;
  } catch (error) {
    logger.error(`Error obteniendo historial del dispositivo ${deviceId}:`, error);
    throw error;
  }
}

// Obtener estadísticas de actividad para un dispositivo
async function getDeviceStats(deviceId) {
  try {
    const db = await connectToDatabase();
    const collection = db.collection('deviceLocations');
    
    // Calcular fechas para diferentes períodos
    const now = new Date();
    const oneDayAgo = new Date(now); oneDayAgo.setDate(now.getDate() - 1);
    const oneWeekAgo = new Date(now); oneWeekAgo.setDate(now.getDate() - 7);
    const oneMonthAgo = new Date(now); oneMonthAgo.setDate(now.getDate() - 30);
    
    // Obtener conteo total
    const total = await collection.countDocuments({ deviceId });
    
    // Obtener conteo por períodos
    const lastDay = await collection.countDocuments({ 
      deviceId, 
      timestamp: { $gte: oneDayAgo } 
    });
    
    const lastWeek = await collection.countDocuments({ 
      deviceId, 
      timestamp: { $gte: oneWeekAgo } 
    });
    
    const lastMonth = await collection.countDocuments({ 
      deviceId, 
      timestamp: { $gte: oneMonthAgo } 
    });
    
    // Obtener primera y última fecha
    const firstRecord = await collection
      .find({ deviceId })
      .sort({ timestamp: 1 })
      .limit(1)
      .toArray();
      
    const lastRecord = await collection
      .find({ deviceId })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();
    
    // Obtener ciudades más frecuentes
    const cities = await collection.aggregate([
      { $match: { 
        deviceId,
        city: { $exists: true, $ne: null, $ne: '' }
      }},
      { $group: {
          _id: '$city',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray();
    
    // Formatear resultados
    const result = {
      deviceId,
      total,
      lastDay,
      lastWeek,
      lastMonth,
      firstSeen: firstRecord.length > 0 ? firstRecord[0].timestamp : null,
      lastSeen: lastRecord.length > 0 ? lastRecord[0].timestamp : null,
      topCities: cities.map(city => ({
        name: city._id,
        count: city.count
      }))
    };
    
    logger.info(`Estadísticas obtenidas para ${deviceId}`);
    return result;
  } catch (error) {
    logger.error(`Error obteniendo estadísticas del dispositivo ${deviceId}:`, error);
    throw error;
  }
}

// Obtener todos los dispositivos históricos
router.get('/devices', async (req, res) => {
  try {
    console.log('Recibida solicitud a /api/history/devices');
    const days = parseInt(req.query.days) || 0;
    const onlyActive = req.query.onlyActive === 'true';
    
    console.log(`Parámetros: days=${days}, onlyActive=${onlyActive}`);
    
    const devices = await getAllDevices({
      days,
      onlyActive
    });
    
    res.json({
      success: true,
      count: devices.length,
      devices
    });
  } catch (error) {
    console.error('Error obteniendo historial de dispositivos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// Obtener historial de un dispositivo específico
router.get('/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const days = parseInt(req.query.days) || 0;
    const limit = parseInt(req.query.limit) || 0;
    
    const history = await getDeviceHistory(deviceId, {
      days,
      limit
    });
    
    res.json({
      success: true,
      deviceId,
      count: history.length,
      history
    });
  } catch (error) {
    console.error(`Error obteniendo historial del dispositivo ${req.params.deviceId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// Obtener estadísticas de un dispositivo
router.get('/devices/:deviceId/stats', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const stats = await getDeviceStats(deviceId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error(`Error obteniendo estadísticas del dispositivo ${req.params.deviceId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;