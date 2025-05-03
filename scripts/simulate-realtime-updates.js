// scripts/simulate-realtime-updates.js

require('dotenv').config();
const { MongoClient } = require('mongodb');
const fetch = require('node-fetch');
const logger = require('../src/utils/logger');

// Configuración
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'tracking_system';
const DEVICE_COUNT = 3; // Número de dispositivos a simular
const UPDATE_INTERVAL = 5000; // ms
const LOCATION_ENDPOINT = 'http://localhost:3000/simulate-location-update';

// Ciudades con coordenadas aproximadas (Colombia)
const CITIES = [
  { name: 'Medellín', lat: 6.244338, lng: -75.573553 },
  { name: 'Bello', lat: 6.333176, lng: -75.558991 },
  { name: 'Envigado', lat: 6.175294, lng: -75.591888 },
  { name: 'Sabaneta', lat: 6.151537, lng: -75.615293 },
  { name: 'Itagüí', lat: 6.184409, lng: -75.599051 },
];

// Función para generar ubicación aleatoria cerca de un punto
function generateRandomLocation(baseLat, baseLng, radiusKm = 1) {
  // Convertir radio a grados (aproximadamente)
  const radiusLat = radiusKm / 111; // 1 grado ~ 111 km
  const radiusLng = radiusKm / (111 * Math.cos((baseLat * Math.PI) / 180));

  const lat = baseLat + (Math.random() * 2 - 1) * radiusLat;
  const lng = baseLng + (Math.random() * 2 - 1) * radiusLng;

  return { lat, lng };
}

// Función para generar datos de ubicación
async function generateLocationData(deviceId) {
  // Elegir ciudad aleatoria
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];

  // Generar ubicación cercana a las coordenadas de la ciudad
  const { lat, lng } = generateRandomLocation(city.lat, city.lng, 1);

  return {
    deviceId,
    lat,
    lng,
    timestamp: new Date().toISOString(),
    accuracy: Math.random() * 10 + 5, // 5-15 metros
    speed: Math.random() * 60, // 0-60 km/h
    city: city.name,
    isMock: true,
    altitude: Math.random() * 100 + 1500, // Altura aproximada para Colombia
    battery: Math.floor(Math.random() * 100), // Nivel de batería
  };
}

// Conectar a MongoDB
async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    logger.info('Conectado a MongoDB');
    return client.db(MONGODB_DB);
  } catch (error) {
    logger.error('Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

// Generar y almacenar ubicaciones
async function simulateLocations() {
  let db;

  try {
    // Conectar a MongoDB
    db = await connectToMongoDB();
    const locationCollection = db.collection('deviceLocations');
    const deviceCollection = db.collection('devices');

    logger.info('Iniciando simulación de ubicaciones...');

    // Crear dispositivos de ejemplo si no existen
    for (let i = 1; i <= DEVICE_COUNT; i++) {
      const deviceId = `dev${i.toString().padStart(3, '0')}`;

      await deviceCollection.updateOne(
        { deviceId },
        {
          $setOnInsert: {
            deviceId,
            name: `Dispositivo ${i}`,
            createdAt: new Date(),
            isActive: true,
          },
        },
        { upsert: true }
      );
    }

    // Iniciar simulación
    setInterval(async () => {
      for (let i = 1; i <= DEVICE_COUNT; i++) {
        const deviceId = `dev${i.toString().padStart(3, '0')}`;

        try {
          // Generar datos
          const locationData = await generateLocationData(deviceId);

          // Almacenar en MongoDB
          await locationCollection.insertOne({
            deviceId: locationData.deviceId,
            timestamp: new Date(locationData.timestamp),
            location: {
              type: 'Point',
              coordinates: [locationData.lng, locationData.lat],
            },
            accuracy: locationData.accuracy,
            speed: locationData.speed,
            altitude: locationData.altitude,
            heading: Math.random() * 360,
            isMock: locationData.isMock,
            city: locationData.city,
            metadata: {
              battery: locationData.battery,
            },
            receivedAt: new Date(),
          });

          // Actualizar dispositivo
          await deviceCollection.updateOne(
            { deviceId },
            {
              $set: {
                lastSeen: new Date(),
                lastLocation: {
                  type: 'Point',
                  coordinates: [locationData.lng, locationData.lat],
                },
                lastCity: locationData.city,
                updatedAt: new Date(),
              },
            }
          );

          logger.info(
            `Ubicación generada para ${deviceId} en ${locationData.city}`
          );

          // Enviar notificación al servidor WebSocket
          try {
            const response = await fetch(LOCATION_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(locationData),
            });

            if (!response.ok) {
              logger.warn(
                `Error enviando ubicación al servidor: ${response.status}`
              );
            }
          } catch (error) {
            logger.warn(
              `No se pudo enviar la ubicación al servidor: ${error.message}`
            );
          }
        } catch (error) {
          logger.error(`Error procesando ubicación para ${deviceId}:`, error);
        }
      }
    }, UPDATE_INTERVAL);
  } catch (error) {
    logger.error('Error en simulación:', error);

    if (db) {
      await db.client.close();
    }

    process.exit(1);
  }
}

// Iniciar simulación
simulateLocations();
