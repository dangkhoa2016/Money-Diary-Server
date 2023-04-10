const debug = require('debug')('money-diary-server:->routes->generate');
const DiariesGenerate = require('../libs/diaries_generate');
const CategoriesGenerate = require('../libs/categories_generate');
const client = require('../libs/postgres_helpers');

const handleResetDiaries = async (request, reply) => {
  debug('start generate diaries');

  const resetCommand = `
  TRUNCATE diaries;
  DELETE FROM diaries;
  ALTER SEQUENCE diaries_id_seq RESTART WITH 1;
  `;

  await client.init();
  await client.query(resetCommand);
  const result = await DiariesGenerate.run();
  debug(result);
  reply.send(result);
};

const handleResetCategories = async (request, reply) => {
  debug('handleResetCategories: start generate categories');

  const resetCommand = `
TRUNCATE categories;
DELETE FROM categories;
ALTER SEQUENCE categories_id_seq RESTART WITH 1;
`;

  await client.init();
  await client.query(resetCommand);
  const result = await CategoriesGenerate.run(10);
  debug('handleResetCategories: result', result);
  reply.send(result);
};

const routes = (server, options, next) => {

  server.addHook('onRequest', (request, reply, done) => {
    request.custom_config = { permission: 'demo' };
    done();
  });

  server.get('/diaries', handleResetDiaries);
  server.get('/categories', handleResetCategories);

  next();

}

module.exports = routes;
