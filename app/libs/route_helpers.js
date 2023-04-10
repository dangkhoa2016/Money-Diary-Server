const debug = require('debug')('money-diary-server:->libs->route_helpers');
const moment = require('moment');
const { statusCodes, paramSchema, bulkDeleteParamSchema,
  dateQuerySchema, tokenQuerySchema,
  dateRangeQuerySchema, } = require('./variables');
const updateActions = ['post', 'put', 'patch'];

const baseHandleAction = async (action, helper, request, reply) => {
  let params = null;
  switch (action) {
    case 'delete':
      params = request.params.id;
      break;
    case 'bulkDelete':
      params = request.body || [];
      break;
    default:
      params = request.body;
      break;
  }

  const { code = statusCodes.UNPROCESSABLE_ENTITY, error, message } = await helper[action](params);
  reply.code(code).send(message || { error });
};

const groupByDate = (rows, utc_offset = 0) => {
  const group = {};

  if (!Array.isArray(rows) || rows.length === 0)
    return group;

  rows.forEach(row => {
    const date = moment(row.created_at).utcOffset(utc_offset).startOf('day').valueOf().toString();
    if (group[date])
      group[date].push(row);
    else
      group[date] = [row];
  });

  return group;
};

const handleResult = (response, { group_by_date, utc_offset, show_total = false }, reply) => {
  let { code = statusCodes.OK, error, message: result, data = [], total = 0 } = response;
  if (!result && data.length > 0)
    result = data;
  // debug('handleResult', result);
  if (result && group_by_date)
    result = groupByDate(result, utc_offset);
  if (show_total)
    result = { result, total };
  reply.code(code).send(result || { error });
};

const handleGetQueryAction = (helper, method) => {
  return async (request, reply) => {
    debug(`${request.routerPath} request.query`, request.query);
    const { group_by_date = false, utc_offset = 0, show_total = false, } = request.query;

    try {
      const response = await helper[method](request.query);
      // debug('handleGetQueryAction: result', response);
      handleResult(response, { group_by_date, utc_offset, show_total, }, reply);
    } catch (error) {
      debug(`${request.routerPath} Error`, error);
      reply.code(statusCodes.INTERNAL_SERVER_ERROR).send({ error: error.message });
    }
  };
};

const handleExportAction = (helper, model_name) => {
  return async (request, reply) => {
    const { format = 'json' } = request.query;
    let buf = null;

    try {
      buf = await helper.export(format);
    } catch (error) {
      debug('/export Error getByQuery', error);
      reply.code(statusCodes.INTERNAL_SERVER_ERROR).send({ error: error.message });
      return;
    }

    const fileName = `export-${model_name}-${(new Date()).valueOf()}.${format.toLowerCase()}`;
    reply.header('Content-Disposition', `attachment; filename=${fileName}`);
    reply.type('application/json');

    reply.send(buf);
  };
};

const handleImportAction = (server, helper) => {
  return async (request, reply) => {
    const { url, auth_token } = request.body;
    if (!url || typeof (url) !== 'string') {
      server.notFound(request, reply);
      return;
    }

    const { code, message, error } = await helper.import(url, auth_token.trim());
    reply.code(code).send(code === statusCodes.INTERNAL_SERVER_ERROR ? { error } : { message });
  };
};

const handleCreateAction = (helper) => {
  return async (request, reply) => {
    await baseHandleAction('insert', helper, request, reply);
  };
};

const handleUpdateAction = (helper) => {
  return async (request, reply) => {
    const { id } = request.params;

    const { code = statusCodes.UNPROCESSABLE_ENTITY, error, message } = await helper.update(id, request.body);
    reply.code(code).send(message || { error });
  };
};

const handleDeleteAction = (helper) => {
  return async (request, reply) => {
    await baseHandleAction('delete', helper, request, reply);
  };
};

const handleBulkDeleteAction = (helper) => {
  return async (request, reply) => {
    await baseHandleAction('bulkDelete', helper, request, reply);
  };
};

const addOnRequest = (server, role) =>{

  server.addHook('onRequest', (request, reply, done) => {
    request.custom_config = { permission: role };
    // debug('diaries request.custom_config', request.custom_config);
    done();
  });

};

const addHandleSimpleAction = (helper, server, searchQuerySchema, { modelSchemaId, model_name }) => {

  server.get('/by_date_range', { schema: { querystring: dateRangeQuerySchema } }, handleGetQueryAction(helper, 'getByDateRange'));

  server.get('/by_date', { schema: { querystring: dateQuerySchema } }, handleGetQueryAction(helper, 'getByDate'));

  server.get('/by_month', { schema: { querystring: dateQuerySchema } }, handleGetQueryAction(helper, 'getByMonth'));

  server.get('/search', { schema: { querystring: searchQuerySchema } }, handleGetQueryAction(helper, 'search'));

  server.get('/:id/delete', { schema: { params: paramSchema, querystring: tokenQuerySchema } }, handleDeleteAction(helper));
  server.delete('/:id', { schema: { params: paramSchema, querystring: tokenQuerySchema } }, handleDeleteAction(helper));
  server.post('/bulk_delete', { schema: { body: bulkDeleteParamSchema, querystring: tokenQuerySchema } }, handleBulkDeleteAction(helper));

  server.post('/', { schema: { body: { $ref: modelSchemaId }, querystring: tokenQuerySchema } }, handleCreateAction(helper));

  const updateDataOptions = { schema: { params: paramSchema, body: { $ref: modelSchemaId }, querystring: tokenQuerySchema } };
  updateActions.forEach(action => {
    server[action]('/:id', updateDataOptions, handleUpdateAction(helper));
  });

  server.get('/export', handleExportAction(helper, model_name));
  server.post('/import', handleImportAction(server, helper));

};

module.exports = {
  handleBulkDeleteAction, handleDeleteAction,
  baseHandleAction, handleUpdateAction,
  handleImportAction, handleCreateAction,
  handleExportAction, handleGetQueryAction,
  groupByDate, addHandleSimpleAction, addOnRequest,
}
