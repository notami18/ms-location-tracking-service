// src/websocket/handler.js
const {
  storeConnection,
  updateSubscription,
  deleteConnection,
} = require('./connection');

// Manejador para $connect
exports.onConnect = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const authorizer = event.requestContext.authorizer || {};
  const userId = authorizer.principalId || 'anonymous';

  try {
    await storeConnection(connectionId, {
      userId,
      createdAt: new Date().toISOString(),
    });

    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    console.error('Error en conexión WebSocket:', error);
    return { statusCode: 500, body: 'Connection failed' };
  }
};

// Manejador para $disconnect
exports.onDisconnect = async (event) => {
  const connectionId = event.requestContext.connectionId;

  try {
    await deleteConnection(connectionId);
    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    console.error('Error en desconexión WebSocket:', error);
    return { statusCode: 500, body: 'Disconnect failed' };
  }
};

// Manejador para $default y mensajes
exports.onDefault = async (event) => {
  const connectionId = event.requestContext.connectionId;

  try {
    // Parsear el mensaje
    let message;
    try {
      message = JSON.parse(event.body);
    } catch (e) {
      return { statusCode: 400, body: 'Invalid JSON' };
    }

    // Manejar diferentes acciones
    switch (message.action) {
      case 'subscribe':
        if (message.deviceId) {
          await updateSubscription(connectionId, message.deviceId);

          // Responder al cliente
          const domainName = event.requestContext.domainName;
          const stage = event.requestContext.stage;
          const endpoint = `https://${domainName}/${stage}`;

          await sendWebSocketResponse(endpoint, connectionId, {
            type: 'subscription',
            status: 'success',
            deviceId: message.deviceId,
          });
        }
        break;

      case 'subscribeAll':
        await updateSubscription(connectionId, 'all');
        break;

      case 'ping':
        // Manejar ping para mantener conexión viva
        const domainName = event.requestContext.domainName;
        const stage = event.requestContext.stage;
        const endpoint = `https://${domainName}/${stage}`;

        await sendWebSocketResponse(endpoint, connectionId, {
          type: 'pong',
          timestamp: Date.now(),
        });
        break;

      default:
        console.log(`Acción no reconocida: ${message.action}`);
    }

    return { statusCode: 200, body: 'Message processed' };
  } catch (error) {
    console.error('Error procesando mensaje WebSocket:', error);
    return { statusCode: 500, body: 'Failed to process message' };
  }
};

// Función auxiliar para enviar respuestas
async function sendWebSocketResponse(endpoint, connectionId, data) {
  try {
    // En entorno local
    if (global.sendToConnection) {
      await global.sendToConnection(connectionId, data);
      return;
    }

    // En AWS
    const ApiGatewayManagementApi = require('@aws-sdk/client-apigatewaymanagementapi');
    const client = new ApiGatewayManagementApi.ApiGatewayManagementApiClient({
      endpoint,
    });

    await client.send(
      new ApiGatewayManagementApi.PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(data)),
      })
    );
  } catch (error) {
    console.error(`Error enviando respuesta a ${connectionId}:`, error);
  }
}
