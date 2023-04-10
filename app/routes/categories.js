// const debug = require('debug')('money-diary-server:->routes->categories');
const {
  variables: { baseQuerySchema, baseSearchQuerySchema, },
  CategoriesHelpers, helpers: { getSchema, },
} = require('../libs');
const { handleGetQueryAction, addHandleSimpleAction, addOnRequest, } = require('../libs/route_helpers');
let categoriesHelpers = null;

const categorySchema = {
  enabled: 'boolean',
  name: 'string',
  text_color_variant: 'string',
  bg_color_variant: 'string',
};

const searchQuerySchema = {
  type: 'object',
  properties: {
    ...baseSearchQuerySchema.properties,
    enabled: { type: 'boolean' },
    name: { type: 'string' },
  },
};

const querySchema = {
  name: { type: 'string' },
  enabled: { type: 'boolean' },
  group_by_date: { type: 'boolean' }
};

const indexQuerySchema = {
  type: 'object',
  properties: {
    ...baseQuerySchema.properties,
    ...querySchema,
  },
};

const addSchema = (server) => {
  server.addSchema({
    $id: 'categorySchema',
    type: 'object',
    properties: getSchema(categorySchema),
    required: ['name',],
  });

};

async function routes(server/*, options*/) {

  addSchema(server);
  addOnRequest(server, 'categories');

  categoriesHelpers = new CategoriesHelpers();
  await categoriesHelpers.init();

  server.get('/', { schema: { querystring: indexQuerySchema } },
    handleGetQueryAction(categoriesHelpers, 'getByQuery'));

  addHandleSimpleAction(categoriesHelpers, server, searchQuerySchema,
    { modelSchemaId: 'categorySchema#', model_name: 'categories' });

}

module.exports = routes;
