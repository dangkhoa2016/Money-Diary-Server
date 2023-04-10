const debug = require('debug')('money-diary-server:->libs->redis');
const { createClient } = require('redis');
const { REDIS_USERNAME = 'default', REDIS_PASS, REDIS_HOST, REDIS_INDEX = 0, } = process.env;

const url = `redis://${REDIS_USERNAME}:${REDIS_PASS}@${REDIS_HOST}/${REDIS_INDEX}`;
debug('redis url', url);

const client = createClient({ url });

client.on('error', (err) => {
  debug('client error', err);
  process.exit();
});

module.exports = client;
