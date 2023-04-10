const debug = require('debug')('money-diary-server:->routes->diaries');
const { variables: { statusCodes, baseSearchQuerySchema, },
  DiariesHelpers, helpers: { getSchema, } } = require('../libs');
const { addHandleSimpleAction, addOnRequest, } = require('../libs/route_helpers');

const diarySchema = {
  reason: 'string',
  created_at: 'string',
  money: 'number',
  category_id: 'number',
};

const Promise = require('bluebird');
let diariesHelpers = null;

const reportBodySchema = {
  type: 'array',
  items: { $ref: 'reportSchema#' },
};

const searchQuerySchema = {
  type: 'object',
  properties: {
    ...baseSearchQuerySchema.properties,
    reason: { type: 'string' },
    from_money: { type: ['null', 'number'] },
    to_money: { type: ['null', 'number'] },
    show_total: { type: 'boolean' },
    category_ids: {
      type: ['null', 'array'],
      items: { type: ['string', 'number'] },
    },
  },
};

const addSchema = (server) => {

  server.addSchema({
    $id: 'reportSchema',
    type: 'object',
    properties: {
      name: { type: 'string' },
      range: { type: 'array', items: { type: 'string' } },
    },
    required: ['name', 'range']
  });

  server.addSchema({
    $id: 'diarySchema',
    type: 'object',
    properties: getSchema(diarySchema),
    required: ['reason', 'money',],
  });

};

const processRanges = (ranges) => {
  return Promise.map(ranges, async item => {
    const { name, range: [from_date, to_date] } = item || {};
    try {
      const { /*code = statusCodes.UNPROCESSABLE_ENTITY, err, */ message: result } = await diariesHelpers.getByDateRange({
        from_date, to_date,
      });
      // debug('/report Code get report', from_date, to_date, err);
      return { name, result };
    } catch (error) {
      debug('/report Error get report', from_date, to_date, error);
      return { name, result: null };
    }
  }, { concurrency: 1 });
};

const handleReport = async (request, reply) => {
  debug('/report request.body', request.body);

  const ranges = request.body;
  if (!Array.isArray(ranges) || ranges.length === 0) {
    reply.code(statusCodes.UNPROCESSABLE_ENTITY).send({ error: 'Missing array of ranges.' });
    return;
  }

  const result = await processRanges(ranges);
  reply.send(result);
};

async function routes(server/*, options*/) {

  addSchema(server);
  addOnRequest(server, 'diaries');

  diariesHelpers = new DiariesHelpers();
  await diariesHelpers.init();

  /*
  server.get('/', { schema: { querystring: indexQuerySchema } }, async (request, reply) => {
    reply('Nothing!');
  });
  */

  server.post('/report', { schema: { body: reportBodySchema } }, handleReport);

  addHandleSimpleAction(diariesHelpers, server, searchQuerySchema,
    { modelSchemaId: 'diarySchema#', model_name: 'diaries' });

}

module.exports = routes;
