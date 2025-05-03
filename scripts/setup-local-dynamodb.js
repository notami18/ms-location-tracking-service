const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Configuración para DynamoDB local
const dynamoDB = new AWS.DynamoDB({
  region: 'localhost',
  endpoint: 'http://localhost:8000',
  accessKeyId: 'dummy',
  secretAccessKey: 'dummy',
});

// Nombre de la tabla de conexiones
const CONNECTIONS_TABLE = 'gps-tracking-system-connections-dev';

// Función para crear tabla de conexiones
async function createConnectionsTable() {
  const params = {
    TableName: CONNECTIONS_TABLE,
    KeySchema: [{ AttributeName: 'connectionId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'connectionId', AttributeType: 'S' },
      { AttributeName: 'deviceId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'deviceId-index',
        KeySchema: [{ AttributeName: 'deviceId', KeyType: 'HASH' }],
        Projection: {
          ProjectionType: 'ALL',
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
    StreamSpecification: {
      StreamEnabled: false,
    },
  };

  try {
    await dynamoDB.createTable(params).promise();
    console.log(`Tabla ${CONNECTIONS_TABLE} creada correctamente`);
  } catch (error) {
    if (error.code === 'ResourceInUseException') {
      console.log(`La tabla ${CONNECTIONS_TABLE} ya existe`);
    } else {
      console.error(`Error creando tabla ${CONNECTIONS_TABLE}:`, error);
      throw error;
    }
  }
}

// Crear tablas y datos de ejemplo
async function setupDynamoDB() {
  try {
    await createConnectionsTable();
    console.log('Configuración de DynamoDB Local completada con éxito');
  } catch (error) {
    console.error('Error en la configuración:', error);
  }
}

// Ejecutar setup
setupDynamoDB();
