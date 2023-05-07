const AdmZip = require('adm-zip');
const moment = require('moment');
const { ISO8601format = [], initializeStatuses,
  statusCodes, maxLimit, sortDirectionAscending, } = require('./variables');
const debug = require('debug')('money-diary-server:->libs->helpers');
const postgres_format = 'YYYY-MM-DD HH:mm:ss.SSSS';
const lodash = require('lodash/string');
const { handleBulkDeleteAction, handleDeleteAction,
  baseHandleAction, handleUpdateAction,
  handleImportAction, handleCreateAction,
  handleExportAction, handleGetQueryAction,
  groupByDate, } = require('./route_helpers');

const actionMessages = {
  insert: { msg: 'data', code: statusCodes.UNPROCESSABLE_ENTITY },
  update: { msg: 'data', code: statusCodes.NOT_FOUND },
  delete: { msg: 'id', code: statusCodes.NOT_FOUND },
  bulkDelete: { msg: 'ids', code: statusCodes.OK },
};

const checkInit = async function () {
  if (!this.initialize_status)
    return false;

  if (this.initialize_status === initializeStatuses.done)
    return true;
  else {
    debug('checkInit: wait for 100 miliseconds');
    await sleep(100);
    return this.checkInit();
  }
};

const getSortField = (sort_field = '', sort_direction = '') => {
  if (sort_field)
    return {
      [sort_field]: sort_direction && sortDirectionAscending.includes(sort_direction.toLowerCase())
    };
  else
    return null;
};

const flatten = (arr) => {
  while (arr.some((item) => Array.isArray(item))) {
    arr = [].concat(...arr);
  }
  return arr;
};

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const randomDate = (start, end) => {
  return moment(new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())));
};

const isValidDate = (date) => {
  return date && Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date);
};

const validateDate = (date) => {
  if (!date)
    return false;

  if (isValidDate(date))
    return true;

  if (typeof (date) === 'number' && date > 28800000) // January 1, 1970 on Unix like systems.
    return true;

  return moment(date, ISO8601format, true).isValid();
};

const buildQueryDateRange = (from_date, to_date) => {
  debug('buildQueryDateRange', { from_date, to_date });
  const query = { created_at: {} };

  from_date = validateDate(from_date) ? moment(from_date) : null;
  to_date = validateDate(to_date) ? moment(to_date) : null;

  if (from_date && to_date) {
    query.created_at.$between = {
      $min: from_date.format(postgres_format),
      $max: to_date.format(postgres_format)
    }
  } else if (from_date)
    query.created_at.$gte = from_date.format(postgres_format)
  else if (to_date)
    query.created_at.$lte = to_date.format(postgres_format);
  else
    return null;

  return query;
};

const buildQueryMoneyRange = (from_money, to_money) => {
  debug('buildQueryMoneyRange', { from_money, to_money });
  const query = { money: {} };
  if (from_money && to_money) {
    query.money.$between = {
      $min: from_money,
      $max: to_money,
    }
  } else if (from_money > 0)
    query.money.$gte = from_money;
  else if (to_money > 0)
    query.money.$lte = to_money;
  else
    return null;

  return query;
};

const jsonToCSV = (arrayOfJson, csv = null) => {
  const replacer = (key, value) => value === null ? '' : value;
  const header = Object.keys(arrayOfJson[0]);
  const arr = arrayOfJson.map(row => {
    return header.map(fieldName => {
      return JSON.stringify(row[fieldName], replacer).replace(/\\"/g, '""');
    }).join(',');
  });

  if (csv === null) {
    arr.unshift(header.join(','));
    csv = [];
  }

  return csv.concat(arr);
};

const jsonToZip = (type, arrayOfJson, zip = null) => {
  // creating archives
  if (zip === null)
    zip = new AdmZip();

  for (const record of arrayOfJson) {
    zip.addFile(`${type}_${record.id}.json`, Buffer.from(JSON.stringify(record), 'utf8'));
  }

  return zip;
};

const streamToString = (stream) => {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  })
};

const convertFieldsToColumns = (fields) => {
  let columns = [];
  if (Array.isArray(fields))
    columns = fields;
  else if (typeof (fields) === 'string')
    columns = fields.split(',').map(f => lodash.trim(f)).filter(f => f);

  if (columns.length === 0)
    columns = ['*'];

  return columns;
};

const tableExistsQuery = (sqlHelper, table_name) => {
  return sqlHelper.$select({
    $columns: {
      count: { $count: 'table_name' }
    },
    $from: 'information_schema.tables',
    $where: {
      table_name,
      table_schema: 'public'
    },
  });
};

const getRandomDates = (num, min_date, max_date) => {
  const arr_dates = [];
  const formatDate = (d) => d.format('DD-MM-YYYY');
  for (let index = 0; index < num; index++) {
    let date = randomDate(min_date, max_date);
    let fmDate = formatDate(date);
    while (arr_dates.findIndex(x => formatDate(x) === fmDate) !== -1) {
      date = randomDate(min_date, max_date);
      fmDate = formatDate(date);
    }
    arr_dates.push(date);
  }
  return arr_dates;
};

const capitalizeFirstLetter = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const getBuilder = (options = {}) => {
  options = options || {};
  let { table_name, query = null, fields = null,
    limit = null, offset = null,
    sort_field = '', sort_direction = '', } = options;
  debug('getBuilder', query, fields, limit, offset);

  const builder = {
    $from: table_name,
    $columns: convertFieldsToColumns(fields),
  };

  if (!query) query = {};

  let temp = Number(limit) || 0;
  limit = (temp > maxLimit || temp <= 0) ? maxLimit : temp;

  temp = Number(offset) || 0;
  offset = (temp <= 0) ? 0 : temp;

  builder.$limit = limit;
  builder.$offset = offset;
  builder.$orderBy = getSortField(sort_field, sort_direction);

  builder.$where = query;

  return builder;
};

const processStatusNumber = (result, action, id, model_name) => {
  if (result === statusCodes.NOT_FOUND)
    debug(`processStatusNumber: Not found ${model_name.toLowerCase()} with id: [${id}]`);
  else if (result === statusCodes.UNPROCESSABLE_ENTITY)
    debug(`processStatusNumber: Please provide ${model_name.toLowerCase()} ${actionMessages[action].msg}`);

  return { code: result };
};

const verifyResult = (result, action, id, model_name) => {
  if (typeof (result) === 'number')
    return processStatusNumber(result, action, id, model_name);
  else if (result.rowCount === 0) {
    const code = actionMessages[action].code;
    let debugMsg = '';

    if (action === 'update')
      debugMsg = `Not found ${model_name.toLowerCase()} with id: [${id}] or missing required data`;
    else if (action === 'insert')
      debugMsg = `Please provide ${model_name.toLowerCase()} data`;
    else
      debugMsg = `Not found ${model_name.toLowerCase()} with ${actionMessages[action].msg}: [${id}]`;

    debug(`verifyResult: ${debugMsg}`);

    return { code };
  }

  return null;
};

const getSchema = (definedFields = {}) => {
  const obj = {};
  definedFields = definedFields || {};

  for (const field of Object.keys(definedFields)) {
    obj[field] = { type: definedFields[field] };
  }

  return obj;
};

module.exports = {
  jsonToCSV, jsonToZip, tableExistsQuery,
  streamToString, sleep, isValidDate, getSchema,
  handleGetQueryAction, groupByDate,
  convertFieldsToColumns, handleExportAction,
  handleImportAction, handleCreateAction,
  handleUpdateAction, handleDeleteAction,
  handleBulkDeleteAction, baseHandleAction,
  randomDate, buildQueryDateRange,
  getRandomDates, capitalizeFirstLetter,
  buildQueryMoneyRange, validateDate, checkInit,
  flatten, getSortField, getBuilder, verifyResult,
};
