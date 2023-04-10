const fp = require('fastify-plugin');
const debug = require('debug')('money-diary-server:->middleware->logger');
const requestIp = require('request-ip');
const { variables: { statusCodes }, } = require('../libs');

const now = () => Date.now();

const addRequestLog = (server) => {

  server.addHook('onRequest', (request, reply, done) => {
    reply.startTime = now();
    debug({
      info: 'received request', url: request.raw.url,
      method: request.method, id: request.id
    });

    done();
  });

  server.addHook('onResponse', (request, reply, done) => {
    debug(
      {
        info: 'response completed',
        url: request.raw.url, // add url to response as well for simple correlating
        statusCode: reply.raw.statusCode,
        durationMs: now() - reply.startTime, // recreate duration in ms - use process.hrtime() - https://nodejs.org/api/process.html#process_process_hrtime_bigint for most accuracy
      }
    );

    done();
  });

};

const preHandler = (request, reply, done) => {
  reply.startTime = now();

  if (request.body)
    debug({ info: 'parse body', body: request.body });

  const userIP = /*request.headers['x-real-ip'] || */request.ip || requestIp.getClientIp(request);
  debug('userIP', userIP);
  if (!userIP) {
    debug('preHandler: Must provide user IP address');
    reply.code(statusCodes.MUST_PROVIDE_USER_IP_ADDRESS).send(null);
    done();
    return;
  }

  request.userIP = userIP;
  done();
};

module.exports = fp((server, otpions, done) => {

  /*
  server.addHook('preSerialization', function (req, reply, done) {
    debug('preSerialization', reply);
  });
  */

  server.addHook('preHandler', preHandler);

  addRequestLog(server);
  done();

});