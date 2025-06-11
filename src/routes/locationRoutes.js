// src/routes/locationRoutes.js
const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticate } = require('../middleware/auth');

// Determinar si estamos en entorno de desarrollo
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.IS_OFFLINE === 'true';

// Rutas públicas
router.get('/public', locationController.getPublicLocations);

// Condicionar la autenticación según el entorno
if (!isDevelopment) {
  // En producción, usar autenticación
  router.use(authenticate);
}

// En desarrollo, estas rutas no requerirán autenticación
// En producción, estarán protegidas por el middleware anterior

// Rutas para obtener ubicaciones
router.get('/', locationController.getAllLocations);
router.get('/device/:deviceId', locationController.getLocationsByDevice);
router.get('/latest', locationController.getLatestLocations);
router.get('/device/:deviceId/latest', locationController.getLatestLocation);
router.get('/device/:deviceId/route', locationController.getDeviceRoute);
router.get('/search', locationController.searchLocationsInArea);
router.get('/active', locationController.getActiveDevices);

// Rutas para registrar ubicaciones
router.post('/', locationController.storeLocation);

// Nueva ruta para actualizar estado activo de dispositivos
router.patch('/device/:deviceId/active', locationController.updateDeviceActiveStatus);

module.exports = router;