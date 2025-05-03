const express = require('express');
const locationController = require('../controllers/locationController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Rutas públicas
router.get('/latest/public', locationController.getPublicLocations);

// Rutas protegidas
router.use(authenticate);
router.get('/', locationController.getAllLocations);
router.get('/latest', locationController.getLatestLocations);
router.get('/latest/:deviceId', locationController.getLatestLocation);
router.get('/device/:deviceId', locationController.getLocationsByDevice);
router.get('/area', locationController.searchLocationsInArea);
router.get('/route/:deviceId', locationController.getDeviceRoute);
router.get('/active-devices', locationController.getActiveDevices);

module.exports = router; // Asegúrate de que se exporte el router
