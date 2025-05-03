// src/websocket/broadcast.js
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require('@aws-sdk/client-apigatewaymanagementapi');
const {
  getConnectionsByDevice,
  getGlobalSubscriptions,
  deleteConnection,
} = require('./connection');
const logger = require('../utils/logger');

// Función para enviar mensaje a una única conexión
async function sendToConnection(apiGatewayClient, connectionId, message) {
  try {
    // En entorno local
    if (global.sendToConnection) {
      await global.sendToConnection(connectionId, message);
      return true;
    }

    // En AWS
    await apiGatewayClient.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(message)),
      })
    );
    return true;
  } catch (error) {
    if (error.statusCode === 410) {
      // Conexión ya no disponible, eliminarla
      await deleteConnection(connectionId);
      return false;
    }

    logger.error(`Error enviando mensaje a conexión ${connectionId}:`, error);
    return false;
  }
}

// Función para broadcast de mensaje a múltiples conexiones
async function broadcastToDeviceSubscribers(endpoint, deviceId, message) {
  const apiGatewayClient = new ApiGatewayManagementApiClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint,
  });

  try {
    // Obtener todas las conexiones relevantes
    const deviceConnections = await getConnectionsByDevice(deviceId);
    const globalConnections = await getGlobalSubscriptions();

    // Combinar conexiones, evitando duplicados
    const allConnectionIds = new Set([
      ...deviceConnections.map((c) => c.connectionId),
      ...globalConnections.map((c) => c.connectionId),
    ]);

    logger.info(
      `Enviando broadcast a ${allConnectionIds.size} conexiones para dispositivo ${deviceId}`
    );

    // Enviar mensaje a todas las conexiones
    const sendPromises = Array.from(allConnectionIds).map((connectionId) =>
      sendToConnection(apiGatewayClient, connectionId, message)
    );

    const results = await Promise.allSettled(sendPromises);

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value === true
    ).length;
    logger.info(
      `Broadcast completado: ${successCount}/${allConnectionIds.size} exitosos`
    );

    return {
      success: true,
      total: allConnectionIds.size,
      sent: successCount,
    };
  } catch (error) {
    logger.error(`Error en broadcast para ${deviceId}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  sendToConnection,
  broadcastToDeviceSubscribers,
};
