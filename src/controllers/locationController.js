const { connectToDatabase } = require('../config/mongodb');
const logger = require('../utils/logger');

// Obtener todas las ubicaciones (con paginación)
exports.getAllLocations = async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection('deviceLocations');

    const limit = parseInt(req.query.limit) || 100;
    const skip = parseInt(req.query.skip) || 0;

    const locations = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .toArray();

    res.json({
      success: true,
      count: locations.length,
      data: locations,
    });
  } catch (error) {
    logger.error('Error al obtener ubicaciones:', error);
    next(error);
  }
};

// Obtener ubicaciones por ID de dispositivo
exports.getLocationsByDevice = async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection('deviceLocations');

    const deviceId = req.params.deviceId;
    const limit = parseInt(req.query.limit) || 100;
    const skip = parseInt(req.query.skip) || 0;
    const hours = parseInt(req.query.hours) || 24;

    // Calcular rango de tiempo
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - hours);

    const locations = await collection
      .find({
        deviceId: deviceId,
        timestamp: { $gte: hoursAgo },
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .toArray();

    res.json({
      success: true,
      count: locations.length,
      deviceId: deviceId,
      timeRange: `Last ${hours} hours`,
      data: locations,
    });
  } catch (error) {
    logger.error('Error al obtener ubicaciones del dispositivo:', error);
    next(error);
  }
};

// Obtener ubicaciones dentro de un área geográfica
exports.searchLocationsInArea = async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection('deviceLocations');

    // Parámetros de la solicitud
    const { lat, lng, radius = 1000 } = req.query; // radio en metros

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren latitud y longitud',
      });
    }

    // Búsqueda geoespacial
    const locations = await collection
      .find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)],
            },
            $maxDistance: parseInt(radius),
          },
        },
      })
      .toArray();

    res.json({
      success: true,
      count: locations.length,
      center: { lat: parseFloat(lat), lng: parseFloat(lng) },
      radius: parseInt(radius),
      data: locations,
    });
  } catch (error) {
    logger.error('Error en búsqueda geográfica:', error);
    next(error);
  }
};

// Obtener la última ubicación de todos los dispositivos
exports.getLatestLocations = async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection('deviceLocations');

    // Agregación para obtener la última ubicación por dispositivo
    const latestLocations = await collection
      .aggregate([
        {
          $sort: { timestamp: -1 },
        },
        {
          $group: {
            _id: '$deviceId',
            latestLocation: { $first: '$$ROOT' },
          },
        },
        {
          $replaceRoot: { newRoot: '$latestLocation' },
        },
      ])
      .toArray();

    res.json({
      success: true,
      count: latestLocations.length,
      data: latestLocations,
    });
  } catch (error) {
    logger.error('Error al obtener últimas ubicaciones:', error);
    next(error);
  }
};

// Obtener la ruta completa de un dispositivo
exports.getDeviceRoute = async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection('deviceLocations');

    const deviceId = req.params.deviceId;
    const queryParams = req.query;

    let startDate = queryParams.startDate
      ? new Date(queryParams.startDate)
      : new Date();
    let endDate = queryParams.endDate
      ? new Date(queryParams.endDate)
      : new Date();

    // Por defecto, últimas 24 horas si las fechas son inválidas
    if (
      startDate > endDate ||
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime())
    ) {
      endDate = new Date();
      startDate = new Date();
      startDate.setHours(startDate.getHours() - 24);
    }

    const locations = await collection
      .find({
        deviceId: deviceId,
        timestamp: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .sort({ timestamp: 1 })
      .toArray();

    // Formatear datos para visualización de ruta
    const route = locations.map((loc) => ({
      lat: loc.location.coordinates[1],
      lng: loc.location.coordinates[0],
      timestamp: loc.timestamp,
      accuracy: loc.accuracy || 0,
    }));

    res.json({
      success: true,
      deviceId: deviceId,
      startDate: startDate,
      endDate: endDate,
      pointCount: route.length,
      route: route,
    });
  } catch (error) {
    logger.error('Error al obtener ruta del dispositivo:', error);
    next(error);
  }
};

// Versión pública de las últimas ubicaciones con datos limitados
exports.getPublicLocations = async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection('deviceLocations');

    // Agregación para obtener la última ubicación por dispositivo
    const latestLocations = await collection
      .aggregate([
        {
          $sort: { timestamp: -1 },
        },
        {
          $group: {
            _id: '$deviceId',
            latestLocation: { $first: '$$ROOT' },
          },
        },
        {
          $replaceRoot: { newRoot: '$latestLocation' },
        },
        {
          $project: {
            deviceId: 1,
            timestamp: 1,
            location: 1,
            // Excluir datos sensibles
            _id: 0,
            accuracy: 0,
            isMock: 0,
          },
        },
      ])
      .toArray();

    res.json({
      success: true,
      count: latestLocations.length,
      data: latestLocations,
    });
  } catch (error) {
    logger.error('Error al obtener ubicaciones públicas:', error);
    next(error);
  }
};
