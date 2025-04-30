const express = require('express');
const dashboardController = require('../controllers/dashboardController');
// const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación si no estamos en modo desarrollo con SKIP_AUTH
// if (!(process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true')) {
//   router.use(authMiddleware);
// }

router.get('/stats', dashboardController.getStats);
router.get('/route-history', dashboardController.getRouteHistory);

module.exports = router;