// server.js
require('dotenv').config();
const { server } = require('./app');
const logger = require('./src/utils/logger');

// Puerto
const PORT = process.env.PORT || 3000;

// Iniciar servidor
server.listen(PORT, () => {
  logger.info(`Servidor escuchando en http://localhost:${PORT}`);
  logger.info(`WebSocket disponible en ws://localhost:${PORT}/ws`);
});
