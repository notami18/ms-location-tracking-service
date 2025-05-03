// src/config/aws.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const {
  ApiGatewayManagementApiClient,
} = require('@aws-sdk/client-apigatewaymanagementapi');

// Detectar entorno local
const isLocal =
  process.env.NODE_ENV === 'development' || process.env.IS_OFFLINE === 'true';

// Configuración base para DynamoDB
const dynamoConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
};

// Si estamos en entorno local, usar DynamoDB local
if (isLocal) {
  dynamoConfig.endpoint =
    process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
  dynamoConfig.credentials = {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy',
  };
}

// Crear cliente DynamoDB
const dynamoClient = new DynamoDBClient(dynamoConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
  },
});

// Función para crear cliente de API Gateway Management
const createApiGatewayClient = (endpoint) => {
  // En desarrollo local, creamos un cliente mock
  if (isLocal) {
    return {
      send: async (command) => {
        // En local, usamos la función global sendToConnection
        if (
          command &&
          command.input &&
          command.input.ConnectionId &&
          global.sendToConnection
        ) {
          await global.sendToConnection(
            command.input.ConnectionId,
            command.input.Data instanceof Buffer
              ? JSON.parse(command.input.Data.toString())
              : command.input.Data
          );
        }
        return { $metadata: { httpStatusCode: 200 } };
      },
    };
  }

  // En producción, crear cliente real
  return new ApiGatewayManagementApiClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint,
  });
};

module.exports = {
  dynamoClient,
  docClient,
  createApiGatewayClient,
};
