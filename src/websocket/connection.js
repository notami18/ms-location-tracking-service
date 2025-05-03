// src/websocket/connection.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const logger = require('../utils/logger');

// Detectar entorno local
const isLocal =
  process.env.NODE_ENV === 'development' || process.env.IS_OFFLINE === 'true';

// Configuración para DynamoDB
const dynamoConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
};

// Para desarrollo local
if (isLocal) {
  dynamoConfig.endpoint =
    process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
  dynamoConfig.credentials = {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy',
  };
}

// Crear clientes
const dynamoClient = new DynamoDBClient(dynamoConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
  },
});

// Nombre de la tabla
const CONNECTIONS_TABLE =
  process.env.CONNECTIONS_TABLE || 'gps-tracking-system-connections-dev';
const TTL_DURATION = 86400; // 24 horas en segundos

// Mock DynamoDB para desarrollo local si no está disponible
let mockConnections = new Map();

// Almacenar nueva conexión con TTL
async function storeConnection(connectionId, data = {}) {
  const now = Math.floor(Date.now() / 1000);

  const params = {
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId,
      timestamp: new Date().toISOString(),
      ttl: now + TTL_DURATION, // TTL configurado para 24 horas
      ...data,
    },
  };

  try {
    if (isLocal && process.env.MOCK_DYNAMODB === 'true') {
      // Usar mock en memoria para desarrollo sin DynamoDB local
      mockConnections.set(connectionId, params.Item);
      logger.info(`[MOCK] Conexión almacenada: ${connectionId}`);
    } else {
      await docClient.send(new PutCommand(params));
      logger.info(`Conexión almacenada: ${connectionId}`);
    }
    return true;
  } catch (error) {
    logger.error('Error almacenando conexión:', error);
    return false;
  }
}

// Actualizar suscripción a dispositivo
async function updateSubscription(connectionId, deviceId) {
  try {
    let connection;

    if (isLocal && process.env.MOCK_DYNAMODB === 'true') {
      // Obtener de mock
      connection = mockConnections.get(connectionId);
    } else {
      // Obtener conexión actual para preservar otros datos
      const result = await docClient.send(
        new GetCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connectionId },
        })
      );
      connection = result.Item;
    }

    if (!connection) {
      logger.warn(`Conexión no encontrada: ${connectionId}`);
      return false;
    }

    // Actualizar conexión con nuevo deviceId y renovar TTL
    const now = Math.floor(Date.now() / 1000);
    const updatedConnection = {
      ...connection,
      deviceId,
      ttl: now + TTL_DURATION, // Renovar TTL
    };

    if (isLocal && process.env.MOCK_DYNAMODB === 'true') {
      // Actualizar en mock
      mockConnections.set(connectionId, updatedConnection);
      logger.info(
        `[MOCK] Suscripción actualizada para ${connectionId} a ${deviceId}`
      );
    } else {
      await docClient.send(
        new PutCommand({
          TableName: CONNECTIONS_TABLE,
          Item: updatedConnection,
        })
      );
      logger.info(`Suscripción actualizada para ${connectionId} a ${deviceId}`);
    }

    return true;
  } catch (error) {
    logger.error('Error actualizando suscripción:', error);
    return false;
  }
}

// Eliminar conexión
async function deleteConnection(connectionId) {
  try {
    if (isLocal && process.env.MOCK_DYNAMODB === 'true') {
      // Eliminar de mock
      mockConnections.delete(connectionId);
      logger.info(`[MOCK] Conexión eliminada: ${connectionId}`);
    } else {
      await docClient.send(
        new DeleteCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connectionId },
        })
      );
      logger.info(`Conexión eliminada: ${connectionId}`);
    }

    return true;
  } catch (error) {
    logger.error('Error eliminando conexión:', error);
    return false;
  }
}

// Obtener conexiones por dispositivo
async function getConnectionsByDevice(deviceId) {
  try {
    if (isLocal && process.env.MOCK_DYNAMODB === 'true') {
      // Filtrar en mock
      const connections = Array.from(mockConnections.values()).filter(
        (conn) => conn.deviceId === deviceId
      );
      logger.info(
        `[MOCK] Encontradas ${connections.length} conexiones para ${deviceId}`
      );
      return connections;
    } else {
      const result = await docClient.send(
        new QueryCommand({
          TableName: CONNECTIONS_TABLE,
          IndexName: 'deviceId-index',
          KeyConditionExpression: 'deviceId = :deviceId',
          ExpressionAttributeValues: {
            ':deviceId': deviceId,
          },
        })
      );

      logger.info(
        `Encontradas ${result.Items.length} conexiones para ${deviceId}`
      );
      return result.Items || [];
    }
  } catch (error) {
    logger.error('Error obteniendo conexiones por dispositivo:', error);
    return [];
  }
}

// Obtener todas las conexiones que están suscritas a todos los dispositivos
async function getGlobalSubscriptions() {
  try {
    if (isLocal && process.env.MOCK_DYNAMODB === 'true') {
      // Filtrar en mock
      const connections = Array.from(mockConnections.values()).filter(
        (conn) => conn.deviceId === 'all'
      );
      logger.info(
        `[MOCK] Encontradas ${connections.length} suscripciones globales`
      );
      return connections;
    } else {
      const result = await docClient.send(
        new QueryCommand({
          TableName: CONNECTIONS_TABLE,
          IndexName: 'deviceId-index',
          KeyConditionExpression: 'deviceId = :all',
          ExpressionAttributeValues: {
            ':all': 'all',
          },
        })
      );

      logger.info(`Encontradas ${result.Items.length} suscripciones globales`);
      return result.Items || [];
    }
  } catch (error) {
    logger.error('Error obteniendo suscripciones globales:', error);
    return [];
  }
}

module.exports = {
  storeConnection,
  updateSubscription,
  deleteConnection,
  getConnectionsByDevice,
  getGlobalSubscriptions,
};
