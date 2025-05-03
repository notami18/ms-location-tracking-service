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

    // Manejar fechas
    let startDate, endDate;

    if (queryParams.startDate) {
      startDate = new Date(queryParams.startDate);
    } else {
      // Por defecto, 24 horas atrás
      startDate = new Date();
      startDate.setHours(startDate.getHours() - 24);
    }

    if (queryParams.endDate) {
      endDate = new Date(queryParams.endDate);
    } else {
      // Por defecto, ahora
      endDate = new Date();
    }

    // Validar fechas
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message:
          'Fechas inválidas. Usa formato ISO 8601 (YYYY-MM-DDTHH:MM:SS.sssZ)',
      });
    }

    // Loguear la consulta para debugging
    console.log(
      `Buscando rutas para dispositivo ${deviceId} desde ${startDate.toISOString()} hasta ${endDate.toISOString()}`
    );

    // Ejecutar la consulta
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

    console.log(`Se encontraron ${locations.length} puntos de ubicación`);

    // Si no hay datos, devolver un arreglo vacío pero con mensaje informativo
    if (locations.length === 0) {
      return res.json({
        success: true,
        deviceId: deviceId,
        startDate: startDate,
        endDate: endDate,
        pointCount: 0,
        message:
          'No se encontraron datos de ubicación para este dispositivo en el rango de fechas especificado',
        route: [],
      });
    }

    // Formatear datos para visualización de ruta
    const route = locations
      .map((loc) => {
        // Verificar si la ubicación tiene el formato correcto
        if (
          !loc.location ||
          !loc.location.coordinates ||
          loc.location.coordinates.length < 2
        ) {
          console.warn(
            `Ubicación con formato incorrecto: ${JSON.stringify(loc)}`
          );
          return null;
        }

        return {
          lat: loc.location.coordinates[1], // Latitud es el segundo elemento en GeoJSON
          lng: loc.location.coordinates[0], // Longitud es el primer elemento en GeoJSON
          timestamp: loc.timestamp,
          accuracy: loc.accuracy || 0,
          city: loc.city || 'Desconocido', // Incluir ciudad si existe
        };
      })
      .filter((point) => point !== null); // Eliminar puntos nulos

    res.json({
      success: true,
      deviceId: deviceId,
      startDate: startDate,
      endDate: endDate,
      pointCount: route.length,
      route: route,
    });
  } catch (error) {
    console.error('Error al obtener ruta del dispositivo:', error);
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

// Obtener la última ubicación de un dispositivo
exports.getLatestLocation = async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection('deviceLocations');

    const deviceId = req.params.deviceId;

    // Buscar la ubicación más reciente
    const latestLocation = await collection
      .find({ deviceId })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    if (latestLocation.length === 0) {
      return res.json({
        success: true,
        deviceId,
        message: 'No se encontraron datos de ubicación para este dispositivo',
        location: null,
      });
    }

    const location = latestLocation[0];

    // Formatear respuesta
    const formattedLocation = {
      lat: location.location.coordinates[1],
      lng: location.location.coordinates[0],
      timestamp: location.timestamp,
      accuracy: location.accuracy || 0,
      city: location.city || 'Desconocido',
      speed: location.speed || 0,
      heading: location.heading || 0,
      battery: location.battery || 0,
      isMock: location.isMock || false,
    };

    res.json({
      success: true,
      deviceId,
      updatedAt: new Date(),
      location: formattedLocation,
    });
  } catch (error) {
    console.error('Error al obtener la última ubicación:', error);
    next(error);
  }
};

exports.getActiveDevices = async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const deviceCollection = db.collection('devices');
    const locationCollection = db.collection('deviceLocations');

    // Definir "activo" como dispositivos con ubicación en las últimas 2 horas
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Obtener los dispositivos activos
    const activeDevices = await deviceCollection
      .find({ lastSeen: { $gte: twoHoursAgo } })
      .toArray();

    // Para cada dispositivo, obtener su última ubicación
    const devicesWithLocation = await Promise.all(
      activeDevices.map(async (device) => {
        const latestLocation = await locationCollection
          .find({ deviceId: device.deviceId })
          .sort({ timestamp: -1 })
          .limit(1)
          .toArray();

        return {
          deviceId: device.deviceId,
          name: device.name || device.deviceId,
          lastSeen: device.lastSeen,
          location:
            latestLocation.length > 0
              ? {
                  lat: latestLocation[0].location.coordinates[1],
                  lng: latestLocation[0].location.coordinates[0],
                  timestamp: latestLocation[0].timestamp,
                  accuracy: latestLocation[0].accuracy || 0,
                  city: latestLocation[0].city || 'Desconocido',
                  isMock: latestLocation[0].isMock || false,
                }
              : null,
        };
      })
    );

    res.json({
      success: true,
      count: devicesWithLocation.length,
      devices: devicesWithLocation,
    });
  } catch (error) {
    console.error('Error al obtener dispositivos activos:', error);
    next(error);
  }
};
