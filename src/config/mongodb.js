const { MongoClient } = require('mongodb');
const logger = require('../utils/logger');
require('dotenv').config();

let cachedDb = null;
let client = null;

async function connectToDatabase() {
  try {
    if (cachedDb) {
      logger.debug('Usando conexión a MongoDB en caché');
      return cachedDb;
    }

    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB;

    if (!uri) {
      throw new Error('La variable de entorno MONGODB_URI no está definida');
    }

    logger.info('Conectando a MongoDB...');
    client = new MongoClient(uri);
    await client.connect();

    logger.info('Conexión a MongoDB exitosa');

    cachedDb = client.db(dbName);

    return cachedDb;
  } catch (error) {
    logger.error('Error al conectar a MongoDB:', error);
    throw error;
  }
}

async function closeConnection() {
  if (client) {
    await client.close();
    cachedDb = null;
    client = null;
    logger.info('Conexión a MongoDB cerrada');
  }
}

module.exports = {
  connectToDatabase,
  closeConnection,
};
