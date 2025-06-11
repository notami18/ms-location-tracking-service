// src/websocket/handler.js
const {
  storeConnection,
  updateSubscription,
  deleteConnection,
} = require('./connection');
const { sendToConnection } = require('./broadcast');
const logger = require('../utils/logger');
const { connectToDatabase } = require('../config/mongodb');

// Manejador para $connect
exports.onConnect = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const authorizer = event.requestContext.authorizer || {};
  const userId = authorizer.principalId || 'anonymous';

  try {
    logger.info(
      `Nueva conexión WebSocket: ${connectionId}, usuario: ${userId}`
    );

    await storeConnection(connectionId, {
      userId,
      createdAt: new Date().toISOString(),
    });

    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    logger.error('Error en conexión WebSocket:', error);
    return { statusCode: 500, body: 'Connection failed' };
  }
};

// Manejador para $disconnect
exports.onDisconnect = async (event) => {
  const connectionId = event.requestContext.connectionId;

  try {
    logger.info(`Desconexión WebSocket: ${connectionId}`);
    await deleteConnection(connectionId);
    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    logger.error('Error en desconexión WebSocket:', error);
    return { statusCode: 500, body: 'Disconnect failed' };
  }
};

// Manejador para $default y mensajes
exports.onDefault = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const endpoint = `https://${domainName}/${stage}`;

  try {
    // Parsear el mensaje
    let message;
    try {
      message = JSON.parse(event.body);
    } catch (e) {
      logger.warn(`Mensaje JSON inválido recibido de ${connectionId}`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON format' }),
      };
    }

    logger.info(
      `Mensaje recibido de ${connectionId}: ${JSON.stringify(message)}`
    );

    // Manejar diferentes acciones
    switch (message.action) {
      case 'subscribe':
        if (message.deviceId) {
          await updateSubscription(connectionId, message.deviceId);
          logger.info(
            `Cliente ${connectionId} suscrito a dispositivo ${message.deviceId}`
          );

          // Responder al cliente
          await sendMessageToClient(endpoint, connectionId, {
            type: 'subscription_response',
            status: 'success',
            deviceId: message.deviceId,
            message: `Suscrito exitosamente a ${message.deviceId}`,
          });

          // Enviar último estado conocido del dispositivo
          try {
            await sendDeviceLatestStatus(
              endpoint,
              connectionId,
              message.deviceId
            );
          } catch (err) {
            logger.warn(
              `Error enviando estado inicial a ${connectionId}:`,
              err
            );
          }
        } else {
          await sendMessageToClient(endpoint, connectionId, {
            type: 'subscription_response',
            status: 'error',
            message: 'Se requiere deviceId para suscribirse',
          });
        }
        break;

      case 'subscribeAll':
        await updateSubscription(connectionId, 'all');
        logger.info(
          `Cliente ${connectionId} suscrito a todos los dispositivos`
        );

        await sendMessageToClient(endpoint, connectionId, {
          type: 'subscription_response',
          status: 'success',
          deviceId: 'all',
          message: 'Suscrito exitosamente a todos los dispositivos',
        });

        // Enviar estado actual de todos los dispositivos activos
        try {
          const activeDevices = await getActiveDevices();
          if (activeDevices.success) {
            await sendMessageToClient(endpoint, connectionId, {
              type: 'active_devices_init',
              data: activeDevices.devices,
              count: activeDevices.count,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (err) {
          logger.warn(
            `Error enviando estado inicial de dispositivos a ${connectionId}:`,
            err
          );
        }
        break;

      case 'getActiveDevices':
        try {
          const activeDevices = await getActiveDevices();
          if (activeDevices.success) {
            await sendMessageToClient(endpoint, connectionId, {
              type: 'active_devices_response',
              data: activeDevices.devices,
              count: activeDevices.count,
              timestamp: new Date().toISOString(),
            });
          } else {
            await sendMessageToClient(endpoint, connectionId, {
              type: 'error',
              message: 'Error obteniendo dispositivos activos',
              timestamp: new Date().toISOString(),
            });
          }
        } catch (err) {
          logger.error(`Error procesando getActiveDevices:`, err);
        }
        break;

      case 'ping':
        // Manejar ping para mantener conexión viva
        await sendMessageToClient(endpoint, connectionId, {
          type: 'pong',
          timestamp: new Date().toISOString(),
        });
        break;

      case 'unsubscribe':
        const deviceToUnsubscribe = message.deviceId || 'all';
        // Aquí podrías implementar la lógica para anular suscripciones específicas
        // Por ahora simplemente informamos que recibimos el mensaje
        await sendMessageToClient(endpoint, connectionId, {
          type: 'unsubscribe_response',
          status: 'success',
          deviceId: deviceToUnsubscribe,
          message: `Suscripción cancelada para ${deviceToUnsubscribe}`,
        });
        break;

      default:
        logger.warn(
          `Acción no reconocida de ${connectionId}: ${message.action}`
        );
        await sendMessageToClient(endpoint, connectionId, {
          type: 'error',
          message: `Acción no soportada: ${message.action}`,
          timestamp: new Date().toISOString(),
        });
    }

    return { statusCode: 200, body: 'Message processed' };
  } catch (error) {
    logger.error('Error procesando mensaje WebSocket:', error);

    try {
      await sendMessageToClient(endpoint, connectionId, {
        type: 'error',
        message: 'Error interno procesando mensaje',
        timestamp: new Date().toISOString(),
      });
    } catch (sendError) {
      logger.error('Error enviando mensaje de error:', sendError);
    }

    return { statusCode: 500, body: 'Failed to process message' };
  }
};

// Función auxiliar para enviar mensajes al cliente
async function sendMessageToClient(endpoint, connectionId, data) {
  try {
    // En entorno local
    if (global.sendToConnection) {
      return await global.sendToConnection(connectionId, data);
    }

    // En AWS
    const {
      ApiGatewayManagementApiClient,
      PostToConnectionCommand,
    } = require('@aws-sdk/client-apigatewaymanagementapi');

    const client = new ApiGatewayManagementApiClient({
      endpoint,
      region: process.env.AWS_REGION || 'us-east-1',
    });

    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(data)),
      })
    );

    return true;
  } catch (error) {
    logger.error(`Error enviando mensaje a ${connectionId}:`, error);

    // Si es un error de conexión ya cerrada (410 Gone)
    if (error.statusCode === 410) {
      // Eliminar la conexión de nuestra base de datos
      await deleteConnection(connectionId);
      logger.info(
        `Conexión ${connectionId} eliminada por desconexión (410 Gone)`
      );
    }

    throw error;
  }
}

// Función para obtener dispositivos activos
async function getActiveDevices() {
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
    logger.error('Error al obtener dispositivos activos:', error);
    return {
      success: false,
      count: 0,
      devices: [],
      error: error.message,
    };
  }
}

// Función para enviar el último estado de un dispositivo a un cliente
async function sendDeviceLatestStatus(endpoint, connectionId, deviceId) {
  try {
    const db = await connectToDatabase();
    const collection = db.collection('deviceLocations');

    // Buscar la ubicación más reciente
    const latestLocation = await collection
      .find({ deviceId })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    if (latestLocation.length === 0) {
      return await sendMessageToClient(endpoint, connectionId, {
        type: 'device_status',
        deviceId,
        status: 'not_found',
        message: 'No hay datos para este dispositivo',
        timestamp: new Date().toISOString(),
      });
    }

    const location = latestLocation[0];

    // Formatear respuesta
    const formattedLocation = {
      deviceId: location.deviceId,
      timestamp: location.timestamp,
      location: {
        lat: location.location.coordinates[1],
        lng: location.location.coordinates[0],
      },
      accuracy: location.accuracy || 0,
      city: location.city || 'Desconocido',
      isMock: location.isMock || false,
      isActive: location.isActive || false,
      battery: location.battery || 0,
      heading: location.heading || 0,
      speed: location.speed || 0,
    };

    return await sendMessageToClient(endpoint, connectionId, {
      type: 'device_status',
      data: formattedLocation,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error obteniendo estado del dispositivo ${deviceId}:`, error);
    throw error;
  }
}

module.exports = {
  onConnect: exports.onConnect,
  onDisconnect: exports.onDisconnect,
  onDefault: exports.onDefault,
  sendMessageToClient,
};
