const debug = require('debug')('money-diary-server:->routes->errors');
const fp = require('fastify-plugin');
const { variables: { statusCodes }, } = require('../libs');
const actions = [
  { decorate: 'notFound', code: statusCodes.NOT_FOUND, error: '404 - Not Found.', },
  { decorate: 'exception', code: statusCodes.INTERNAL_SERVER_ERROR, error: '500 - Internal Server Error.' , },
];

const addErrorHandle = (server) => {

  server.setErrorHandler((error, request, reply) => {
    debug('server.setErrorHandler', error, request.headers);
    if (error.validation) {
      reply.code(statusCodes.UNPROCESSABLE_ENTITY).send({ error: error.message });
      return;
    }

    server.exception(request, reply);
  });

  server.setNotFoundHandler(server.notFound);

};

const addDecorate = (server) => {

  for (const action of actions) {
    server.decorate(action.decorate, (request, reply) => {
      debug(`decorate: ${action.decorate} url`, request.url);
      reply.code(action.code).send({
        error: action.error, message: 'Please go home'
      });
    });
  }

};

module.exports = fp((server, options, done) => {

  addDecorate(server);

  server.get('/404', (request, reply) => {
    server.notFound(request, reply);
  });

  server.get('/500', (request, reply) => {
    server.exception(request, reply);
  });

  addErrorHandle(server);

  done();

});
