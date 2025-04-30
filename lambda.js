const serverless = require('serverless-http');
const app = require('./app');
const logger = require('./src/utils/logger');

// Serverless handler
module.exports.handler = serverless(app, {
  request: (request, event, context) => {
    logger.info(`Request received: ${event.httpMethod} ${event.path}`);
    context.callbackWaitsForEmptyEventLoop = false;
  },
  response: (response, event, context) => {
    logger.info(`Response sent with status: ${response.statusCode}`);
  }
});