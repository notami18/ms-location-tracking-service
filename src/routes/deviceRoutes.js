const express = require('express');
const router = express.Router();
// Si aún no tienes un controlador, puedes crear uno básico
const deviceController = {
  getDevices: (req, res) => {
    res.json({ message: 'Lista de dispositivos (pendiente de implementar)' });
  },
  registerDevice: (req, res) => {
    res.json({ message: 'Dispositivo registrado (pendiente de implementar)' });
  },
};

router.get('/', deviceController.getDevices);
router.post('/register', deviceController.registerDevice);

module.exports = router; // Exporta el router
