const { MongoClient } = require('mongodb');
const { broadcastToDeviceSubscribers } = require('../websocket/broadcast');

// MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;
let cachedDb = null;

// Conectar o reutilizar conexión a MongoDB
async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  cachedDb = client.db(MONGODB_DB);
  return cachedDb;
}

// Manejador principal para procesar ubicaciones desde IoT Core
exports.processLocation = async (event, context) => {
  // Hacer que Lambda espere hasta que la ejecución termine
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    console.log('Evento recibido:', JSON.stringify(event));

    // Extraer datos de ubicación del evento
    const payload = typeof event === 'object' ? event : JSON.parse(event);

    // Validar datos mínimos requeridos
    if (!payload.deviceId || !payload.latitude || !payload.longitude) {
      throw new Error(
        'Datos incompletos: deviceId, latitude y longitude son obligatorios'
      );
    }

    // Convertir a formato GeoJSON
    const locationDoc = {
      deviceId: payload.deviceId,
      timestamp: new Date(payload.timestamp || Date.now()),
      location: {
        type: 'Point',
        coordinates: [
          parseFloat(payload.longitude),
          parseFloat(payload.latitude),
        ],
      },
      accuracy: parseFloat(payload.accuracy) || 0,
      speed: parseFloat(payload.speed) || 0,
      altitude: parseFloat(payload.altitude) || 0,
      heading: parseFloat(payload.heading) || 0,
      isMock: !!payload.isMock,
      city: payload.city || 'Desconocido',
      metadata: payload.metadata || {},
      receivedAt: new Date(),
      isActive: true, // Marcar como activo al recibir una nueva ubicación
    };

    // Conectar a MongoDB
    const db = await connectToDatabase();

    // Almacenar en colección de ubicaciones
    const locationCollection = db.collection('deviceLocations');
    await locationCollection.insertOne(locationDoc);

    // Actualizar el estado de actividad del dispositivo en la misma colección
    await locationCollection.updateMany(
      { deviceId: payload.deviceId },
      {
        $set: {
          isActive: true, // Marcar como activo
        },
      }
    );

    // Si WebSockets está habilitado, enviar notificación
    if (
      process.env.WEBSOCKET_ENABLED === 'true' &&
      process.env.WEBSOCKET_API_ID
    ) {
      try {
        const stage = process.env.STAGE || 'dev';
        const region = process.env.AWS_REGION || 'us-east-1';

        // Construir endpoint del API Gateway WebSocket
        const endpoint = `https://${process.env.WEBSOCKET_API_ID}.execute-api.${region}.amazonaws.com/${stage}`;

        // Preparar mensaje para WebSocket
        const locationMessage = {
          type: 'locationUpdate',
          deviceId: payload.deviceId,
          data: {
            lat: locationDoc.location.coordinates[1],
            lng: locationDoc.location.coordinates[0],
            timestamp: locationDoc.timestamp,
            accuracy: locationDoc.accuracy,
            speed: locationDoc.speed,
            city: locationDoc.city,
            isMock: locationDoc.isMock,
          },
        };

        // Enviar mensaje a todos los clientes suscritos
        await broadcastToDeviceSubscribers(
          endpoint,
          payload.deviceId,
          locationMessage
        );
      } catch (error) {
        console.error('Error enviando notificación WebSocket:', error);
        // Continuamos con la ejecución aunque falle la notificación
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Ubicación procesada correctamente',
      }),
    };
  } catch (error) {
    console.error('Error procesando ubicación:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Error procesando ubicación',
        error: error.message,
      }),
    };
  }
};
