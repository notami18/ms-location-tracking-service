/**
 * Script para crear índices geoespaciales en MongoDB
 * 
 * Uso:
 * 1. Configurar las variables de entorno MONGODB_URI y MONGODB_DB
 * 2. Ejecutar: node scripts/create-indexes.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
// Establece a true para eliminar índices existentes con conflictos
const FORCE_UPDATE = process.env.FORCE_INDEX_UPDATE === 'true';

async function createIndexes() {
  if (!uri || !dbName) {
    console.error('Error: Se requieren las variables MONGODB_URI y MONGODB_DB');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    console.log('Conectando a MongoDB...');
    await client.connect();
    console.log('Conexión exitosa');

    const db = client.db(dbName);
    const locationCollection = db.collection('deviceLocations');

    // Obtener índices existentes
    const existingIndexes = await locationCollection.indexes();
    console.log('Índices existentes:');
    existingIndexes.forEach(idx => {
      console.log(`- ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log('\nCreando o verificando índices necesarios...');

    // Crear índice geoespacial
    await createOrUpdateIndex(locationCollection, 
      'location_2dsphere', 
      { "location": "2dsphere" },
      {}
    );

    // Crear índice para deviceId
    await createOrUpdateIndex(locationCollection, 
      'deviceId_1', 
      { "deviceId": 1 },
      {}
    );

    // Crear índice compuesto para deviceId y timestamp
    await createOrUpdateIndex(locationCollection, 
      'deviceId_1_timestamp_-1', 
      { "deviceId": 1, "timestamp": -1 },
      {}
    );

    // Crear o actualizar índice TTL
    const ttlSeconds = 60 * 60 * 24 * 90; // 90 días
    await createOrUpdateIndex(locationCollection, 
      'timestamp_1', 
      { "timestamp": 1 },
      { expireAfterSeconds: ttlSeconds }
    );

    console.log('\n¡Proceso de creación de índices completado!');
  } catch (error) {
    console.error('Error general en el proceso:', error);
  } finally {
    await client.close();
    console.log('Conexión a MongoDB cerrada');
  }
}

async function createOrUpdateIndex(collection, indexName, keys, options) {
  try {
    console.log(`Procesando índice: ${indexName}`);
    
    // Verificar si el índice ya existe
    const existingIndex = await collection.indexExists(indexName);
    
    if (existingIndex) {
      console.log(`Índice ${indexName} ya existe`);
      
      // Si hay opciones específicas a verificar (como TTL)
      if (options.expireAfterSeconds) {
        console.log(`Verificando configuración de TTL para ${indexName}...`);
        
        // Obtener información del índice
        const indexInfo = await collection.indexInformation({ full: true });
        const targetIndex = indexInfo.find(idx => idx.name === indexName);
        
        if (targetIndex && targetIndex.expireAfterSeconds !== options.expireAfterSeconds) {
          console.log(`Configuración TTL difiere: actual=${targetIndex.expireAfterSeconds}, deseada=${options.expireAfterSeconds}`);
          
          if (FORCE_UPDATE) {
            console.log(`Eliminando índice ${indexName} para recrearlo con nuevas opciones...`);
            await collection.dropIndex(indexName);
            console.log(`Creando índice ${indexName} con nuevas opciones...`);
            await collection.createIndex(keys, { ...options, name: indexName });
            console.log(`Índice ${indexName} actualizado correctamente`);
          } else {
            console.log(`AVISO: El índice ${indexName} tiene diferente configuración TTL pero se mantiene.`);
            console.log(`Para forzar la actualización, establece FORCE_INDEX_UPDATE=true en las variables de entorno.`);
          }
        } else {
          console.log(`Configuración TTL correcta para ${indexName}`);
        }
      }
    } else {
      // Crear el índice si no existe
      console.log(`Creando índice ${indexName}...`);
      await collection.createIndex(keys, { ...options, name: indexName });
      console.log(`Índice ${indexName} creado correctamente`);
    }
  } catch (error) {
    console.error(`Error procesando índice ${indexName}:`, error);
    throw error;
  }
}

createIndexes().catch(console.error);