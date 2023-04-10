const debug = require('debug')('money-diary-server:->libs->base_helpers');
const { statusCodes, jwtConfig, } = require('./variables');
const client = require('./postgres_helpers');
const moment = require('moment');
const axios = require('axios');
const axiosHelpers = require('./axios_helpers');
const urlModule = require('url');
const { jsonToZip, jsonToCSV, streamToString,
  buildQueryDateRange, validateDate, capitalizeFirstLetter, verifyResult,
} = require('./helpers');
const Promise = require('bluebird');

const baseMethods = ['getById', 'delete', 'bulkDelete', 'import', 'export'];
const clientMethods = ['init', 'query'];

const getByDateRange = async (options = {}) => {
  options = options || {};
  const { from_date, to_date, fields = null, limit = 0, table_name,
    offset = 0, sort_field = '', sort_direction = '', show_total = false, } = options;

  if (!validateDate(from_date) && !validateDate(to_date))
    return { code: statusCodes.UNPROCESSABLE_ENTITY };

  const query = buildQueryDateRange(from_date, to_date);
  // debug('query', query);
  if (!query) return { code: statusCodes.UNPROCESSABLE_ENTITY };

  const { data: message, total = 0, } = await client.getByQuery({
    query, fields, limit, offset, table_name, sort_field, sort_direction, show_total,
  });

  return { code: statusCodes.OK, message, total, };
};

const baseGetByTime = (method, options = {}) => {
  options = options || {};
  const { date, utc_offset = 0, } = options;

  if (!validateDate(date)) return { code: statusCodes.UNPROCESSABLE_ENTITY };

  let from_date = moment(date).utcOffset(utc_offset);
  from_date = from_date.startOf(method);
  const temp = moment(from_date.toObject());
  const to_date = temp.clone().utcOffset(utc_offset).endOf(method);

  return getByDateRange({ ...options, from_date: from_date.utc(), to_date: to_date.utc(), });
}

class BaseHelpers {
  constructor() {
    for (const method of baseMethods) {
      this[method] = (...args) => {
        const methodName = `base${capitalizeFirstLetter(method)}`;
        return this[methodName](...args);
      }
    }

    for (const method of clientMethods) {
      this[method] = (...args) => { return client[method](...args); }
    }
  }

  validate(obj) {
    // debug('BaseHelpers validate', obj);
    if (!obj || Object.keys(obj).length === 0) {
      debug('validate: Please provide record data');
      return { code: statusCodes.UNPROCESSABLE_ENTITY };
    } 
    
    for (const field of this.requiredFields) {
      if (!obj[field]) {
        debug(`validate: Please provide ${this.model_name} ${field}`);
        return { code: statusCodes.UNPROCESSABLE_ENTITY };
      }
    };

    return null;
  }

  getByQuery(options = {}) {
    return client.getByQuery({ ...options, table_name: this.table_name });
  }

  getByDate(options = {}) {
    return baseGetByTime('day', { ...options, table_name: this.table_name });
  }

  getByMonth(options = {}) {
    return baseGetByTime('month', { ...options, table_name: this.table_name });
  }

  getByDateRange(options = {}) {
    return getByDateRange({ ...options, table_name: this.table_name });
  }

  search(options = {}) {
    debug('search', this.table_name, options);
  }

  async baseInsert(record = {}) {
    if (!this.table_name) {
      debug('baseInsert: Please provide table name.');
      return { code: statusCodes.UNPROCESSABLE_ENTITY };
    }

    debug('baseInsert: record', record);

    try {
      const result = await client.insert(this.table_name, record);
      // debug('baseInsert: inserted result', result);

      const verify = verifyResult(result, 'insert', null, this.model_name);
      if (verify) return verify;

      debug(`baseInsert: ${this.model_name} with id: [${result.rows[0].id}] has been created`);
      return { code: statusCodes.DATA_CREATED, message: result.rows[0] };
    } catch (error) {
      debug('baseInsert: Error', error);
      return { code: statusCodes.INTERNAL_SERVER_ERROR, error: error.message };
    }
  }

  async baseUpdate(id, record = {}, check_exists = false) {
    if (!this.table_name) {
      debug('baseUpdate: Please provide table name.');
      return { code: statusCodes.UNPROCESSABLE_ENTITY };
    }

    debug('baseUpdate: record', record);

    try {
      const result = await client.update(this.table_name, id, record, check_exists);
      // debug('baseUpdate: updated result', result);

      const verify = verifyResult(result, 'update', id, this.model_name);
      if (verify) return verify;

      return this.baseGetById(id);
    } catch (error) {
      debug('baseUpdate: Error', error);
      return { code: statusCodes.INTERNAL_SERVER_ERROR, error: error.message };
    }
  }

  async baseGetById(id) {
    if (!this.table_name) {
      debug('baseGetById: Please provide table name.');
      return { code: statusCodes.UNPROCESSABLE_ENTITY };
    }

    try {
      const result = await client.getById(this.table_name, id);
      if (!result || result.rowCount === 0) {
        debug(`baseGetById: Not found ${this.model_name.toLowerCase()} with id: [${id}]`);
        return { code: statusCodes.NOT_FOUND };
      }

      return { code: statusCodes.OK, message: result.rows[0] };
    } catch (error) {
      debug('baseGetById: Error', error);
      return { code: statusCodes.INTERNAL_SERVER_ERROR, error: error.message };
    }
  }

  async baseDelete(id, check_exists = false) {
    if (!this.table_name) {
      debug('baseDelete: Please provide table name.');
      return { code: statusCodes.UNPROCESSABLE_ENTITY };
    }

    try {
      const result = await client.delete(this.table_name, id, check_exists);
      // debug('baseDelete: deleted result', result);

      const verify = verifyResult(result, 'delete', id, this.model_name);
      if (verify) return verify;

      debug(`baseDelete: ${this.model_name} with id: [${id}] has been deleted`);
      return { code: statusCodes.OK, message: statusCodes.NO_CONTENT };
    } catch (error) {
      debug('baseDelete: Error', error);
      return { code: statusCodes.INTERNAL_SERVER_ERROR, error: error.message };
    }
  }

  async baseBulkDelete(ids) {
    if (!this.table_name) {
      debug('baseBulkDelete: Please provide table name.');
      return { code: statusCodes.UNPROCESSABLE_ENTITY };
    }

    try {
      const result = await client.delete(this.table_name, ids);
      // debug('baseBulkDelete deleted: result', result);

      const verify = verifyResult(result, 'bulkDelete', ids, this.model_name);
      if (verify) return verify;

      debug(`baseBulkDelete: ${this.model_name} with ids: [${ids}] has been deleted`);
      return { code: statusCodes.OK, message: statusCodes.NO_CONTENT };
    } catch (error) {
      debug('baseBulkDelete: Error', error);
      return { code: statusCodes.INTERNAL_SERVER_ERROR, error: error.message };
    }
  }

  appendResult(export_type, records, result) {
    switch (export_type.toLowerCase()) {
      case 'zip':
        return jsonToZip(this.model_name, records, result);
      case 'csv':
        return jsonToCSV(records, result);
      default:
        return (result || []).concat(records);
    }
  }

  async getExportData(export_type) {
    let page_index = 1;
    let is_continue = true;
    let result = null;
    const page_size = 10;

    do {
      const { data: records = [] } = await this.getByQuery({
        limit: page_size, offset: (page_index - 1) * page_size,
      });

      is_continue = records.length > 0;
      if (is_continue) {
        result = this.appendResult(export_type, records, result);
        page_index += 1;
      }
    } while (is_continue);

    return result;
  }

  async baseExport(export_type = 'json') {
    if (!this.table_name) {
      debug('delete: Please provide table_name.');
      return null;
    }

    const result = await this.getExportData(export_type);

    debug('export', export_type, result);
    if (!result) return null;

    switch (export_type.toLowerCase()) {
      case 'zip':
        return result.toBuffer();
      case 'csv':
        return Buffer.from(result.join('\n'));
      default:
        return Buffer.from(JSON.stringify(result));
    }
  }

  async importData(data) {
    if (!Array.isArray(data) || data.length === 0) {
      debug('importData: Nothing to import');
      return { code: statusCodes.NOTHING_TO_IMPORT };
    }

    const arr = await Promise.map(data, async row => {
      const { code, message } = await this.insert(row);
      debug('importData: insert result', code, message);
      return code === statusCodes.DATA_CREATED ? message.id : null;
    }, { concurrency: 1 }).filter(f => f);

    debug(`importData: Imported ${arr.length} records`);
    return { code: statusCodes.OK, message: arr.length };
  }

  async baseImport(url, auth_token) {
    if (!url || typeof (url) !== 'string' || !url.toLowerCase().startsWith('http')) {
      debug('baseImport: Empty url');
      return { code: statusCodes.UNPROCESSABLE_ENTITY };
    }

    const current_domain = urlModule.parse(jwtConfig.options.audience);
    const same_domain = urlModule.parse(url).hostname === current_domain.hostname;
    if (same_domain) {
      debug('baseImport: Same domain');
      return { code: statusCodes.NOTHING_TO_IMPORT };
    }

    const sym = url.includes('?') ? '&' : '?';
    url = `${url}${sym}auth_token=${auth_token}`;

    try {
      let { data } = (await axios.get(url, { responseType: 'stream' })) || {};
      data = await streamToString(data);
      if (data) data = JSON.parse(data);
      debug('baseImport: json data', data);

      return this.importData(data);
    } catch (error) {
      debug('baseImport: Error load json data');
      axiosHelpers(error);
      return { code: statusCodes.INTERNAL_SERVER_ERROR, error: error.message };
    }
  }
}

module.exports = BaseHelpers;
