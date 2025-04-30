const express = require('express');
const router = express.Router();
// Si aún no tienes un controlador, puedes crear uno básico
const dashboardController = {
  getStats: (req, res) => {
    res.json({ message: 'Estadísticas del dashboard (pendiente de implementar)' });
  }
};

router.get('/stats', dashboardController.getStats);

module.exports = router;  // Exporta el router