const fp = require('fastify-plugin');
// const debug = require('debug')('money-diary-server:->middleware->redis');
const { redis } = require('../libs');

module.exports = fp((server, otpions, done) => {

  // debug(redis);
  server.decorate('redis', redis);
  done();

});
