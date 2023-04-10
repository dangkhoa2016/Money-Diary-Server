const fp = require('fastify-plugin');
const debug = require('debug')('money-diary-server:->middleware->check');
const { GuardMiddleware, } = require('../libs');

module.exports = fp((server, otpions, done) => {

  server.addHook('preHandler', async (request, reply) => {
    // debug('preHandler: request.custom_config', request.custom_config);
    const { permission = false } = request.custom_config || {};
    debug('preHandler: permission', permission);

    if (permission)
      await new GuardMiddleware(server.redis, request.userIP).verify(permission)(request, reply);
  });

  done();

});
