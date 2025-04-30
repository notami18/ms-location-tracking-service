// src/controllers/dashboardController.js
const { connectToDatabase } = require('../config/mongodb');
const logger = require('../utils/logger');

// Obtener estadísticas generales
exports.getStats = async (req, res, next) => {
  try {
    console.log('Procesando solicitud de estadísticas');
    const db = await connectToDatabase();
    console.log('Conexión a MongoDB establecida');
    
    const locationCollection = db.collection('deviceLocations');

    // Obtener fecha 30 días atrás
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Estadísticas básicas
    const totalLocations = await locationCollection.countDocuments();
    const recentLocations = await locationCollection.countDocuments({
      timestamp: { $gte: thirtyDaysAgo },
    });

    // Obtener dispositivos únicos
    const uniqueDevices = await locationCollection.distinct('deviceId');

    // Obtener la última actualización
    const lastUpdate = await locationCollection
      .find()
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    res.json({
      success: true,
      stats: {
        totalLocations,
        recentLocations,
        deviceCount: uniqueDevices.length,
        devices: uniqueDevices,
        lastUpdateAt: lastUpdate.length > 0 ? lastUpdate[0].timestamp : null,
      },
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas del dashboard:', error);
    next(error);
  }
};

// Obtener historial de rutas por fecha
exports.getRouteHistory = async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const locationCollection = db.collection('deviceLocations');

    // Parámetros de la solicitud
    const { deviceId, days = 7 } = req.query;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el parámetro deviceId',
      });
    }

    // Calcular rango de fechas
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Agrupar por día
    const dailyRoutes = await locationCollection
      .aggregate([
        {
          $match: {
            deviceId: deviceId,
            timestamp: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' },
            },
            date: { $first: '$timestamp' },
            count: { $sum: 1 },
            firstLocation: { $first: '$location' },
            lastLocation: { $last: '$location' },
            points: { $push: '$location' },
          },
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
        },
        {
          $project: {
            _id: 0,
            date: 1,
            count: 1,
            firstLocation: 1,
            lastLocation: 1,
            // Limitamos a 5 puntos en el resumen para no sobrecargar
            samplePoints: { $slice: ['$points', 5] },
          },
        },
      ])
      .toArray();

    res.json({
      success: true,
      deviceId,
      startDate,
      endDate,
      days: parseInt(days),
      routeCount: dailyRoutes.length,
      dailyRoutes: dailyRoutes.map((day) => ({
        date: day.date,
        pointCount: day.count,
        // Convertir coordenadas al formato [lat, lng] para facilitar el uso en frontend
        startPoint: day.firstLocation
          ? [day.firstLocation.coordinates[1], day.firstLocation.coordinates[0]]
          : null,
        endPoint: day.lastLocation
          ? [day.lastLocation.coordinates[1], day.lastLocation.coordinates[0]]
          : null,
        // Sólo incluimos algunos puntos para el resumen
        previewRoute: day.samplePoints
          ? day.samplePoints.map((p) => [p.coordinates[1], p.coordinates[0]])
          : [],
      })),
    });
  } catch (error) {
    logger.error('Error al obtener historial de rutas:', error);
    next(error);
  }
};
