/**
 * Script para simular actualizaciones en tiempo real de ubicaciones
 * Útil para probar la funcionalidad de seguimiento en tiempo real
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

// Configuración
const DEVICE_IDS = [
  'AndroidDevice_2a4985f7'  // Usar un solo dispositivo para simular movimiento continuo
];

// Ubicaciones en el área metropolitana
const LOCATIONS = [
  // Bello - varios puntos
  { lat: 6.333333, lng: -75.558333, city: "Bello" },  // Centro de Bello
  { lat: 6.339722, lng: -75.554722, city: "Bello" },  // Barrio Niquía
  { lat: 6.320833, lng: -75.570278, city: "Bello" },  // Barrio Cabañas
  { lat: 6.346111, lng: -75.542778, city: "Bello" },  // Barrio La Cumbre
  
  // Medellín - varios puntos
  { lat: 6.244747, lng: -75.573101, city: "Medellín" },  // Centro de Medellín
  { lat: 6.210129, lng: -75.572380, city: "Medellín" },  // El Poblado
  { lat: 6.256773, lng: -75.589861, city: "Medellín" },  // Laureles
  { lat: 6.231144, lng: -75.586700, city: "Medellín" },  // Estadio
  
  // Envigado - varios puntos
  { lat: 6.175742, lng: -75.591370, city: "Envigado" },  // Centro de Envigado
  { lat: 6.168900, lng: -75.574300, city: "Envigado" },  // Zona norte de Envigado
  { lat: 6.184722, lng: -75.585833, city: "Envigado" },  // Barrio La Sebastiana
  { lat: 6.163889, lng: -75.594444, city: "Envigado" }   // Barrio La Mina
];

// Función para simular actualizaciones en tiempo real
async function simulateRealTimeUpdates() {
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

    // Elegir un camino inicial aleatorio
    let currentLocIndex = Math.floor(Math.random() * LOCATIONS.length);
    
    console.log(`Iniciando simulación para ${DEVICE_IDS[0]}...`);
    console.log('Presiona Ctrl+C para detener la simulación.');
    
    // Ejecutar en bucle hasta que se detenga con Ctrl+C
    let updateCount = 0;
    
    while (true) {
      const deviceId = DEVICE_IDS[0];
      
      // Determinar la siguiente ubicación (simular un recorrido)
      if (Math.random() < 0.3) {
        // 30% de probabilidad de cambiar a una ubicación diferente
        currentLocIndex = Math.floor(Math.random() * LOCATIONS.length);
      } else {
        // 70% de probabilidad de moverse a un punto cercano en la misma ciudad
        // Encontrar índices de la misma ciudad
        const currentCity = LOCATIONS[currentLocIndex].city;
        const sameCity = LOCATIONS.map((loc, idx) => loc.city === currentCity ? idx : -1)
                                 .filter(idx => idx !== -1);
        
        if (sameCity.length > 0) {
          currentLocIndex = sameCity[Math.floor(Math.random() * sameCity.length)];
        }
      }
      
      // Seleccionar ubicación base
      const baseLocation = LOCATIONS[currentLocIndex];
      
      // Añadir variación para simular movimiento
      const lat = baseLocation.lat + (Math.random() - 0.5) * 0.001;
      const lng = baseLocation.lng + (Math.random() - 0.5) * 0.001;
      const city = baseLocation.city;
      
      // Crear documento de ubicación
      const timestamp = new Date();
      const locationDoc = {
        deviceId,
        timestamp,
        location: {
          type: 'Point',
          coordinates: [lng, lat] // [longitud, latitud] - Formato GeoJSON
        },
        accuracy: Math.random() * 5 + 3, // Entre 3 y 8 metros (mayor precisión)
        speed: Math.random() * 50, // Entre 0 y 50 km/h
        altitude: 1500 + Math.random() * 100, 
        heading: Math.random() * 360,
        isMock: true,
        battery: Math.max(10, Math.min(100, 70 + (Math.random() - 0.5) * 20)), // Entre 60-80%
        city,
        metadata: {
          provider: 'gps',
          appVersion: '1.2.3'
        },
        receivedAt: new Date()
      };
      
      // Insertar en la base de datos
      await locationCollection.insertOne(locationDoc);
      updateCount++;
      
      console.log(`[${new Date().toLocaleTimeString()}] Ubicación #${updateCount} insertada en ${city}: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      
      // Esperar 2-5 segundos antes de la siguiente actualización
      const delay = 2000 + Math.floor(Math.random() * 3000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
  } catch (error) {
    console.error('Error en la simulación:', error);
  } finally {
    await client.close();
    console.log('Conexión a MongoDB cerrada');
  }
}

// Ejecutar script
simulateRealTimeUpdates().catch(console.error);