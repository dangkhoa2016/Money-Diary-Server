const debug = require('debug')('money-diary-server:->libs->postgres_helpers');
const SQLBuilder = require('json-sql-builder2');
const sqlHelper = new SQLBuilder('PostgreSQL');
const { statusCodes, tableDefinition, initializeStatuses, } = require('./variables');
const pool = require('./pg_client');
const main_table_name = 'diaries';
const systemDBErrorCodes = [{ code: '57P03', message: 'the database system is shutting down' },
{ code: 'XX000', message: 'Unexpected Error' }];
const { tableExistsQuery, sleep, flatten,
  checkInit, getBuilder, convertFieldsToColumns, } = require('./helpers');

class PostgresHelpers {
  constructor() {
    this.initialize_status = null;
  }

  async createTables() {
    const already_exists = await this.tableExists(main_table_name);
    if (already_exists) {
      debug(`createTables: table ${main_table_name} already exists.`);
      return;
    }

    debug('createTables: need to create table', main_table_name);
    const created = await this.query(tableDefinition);
    debug('createTables: created result', created);
    if (await this.tableExists(main_table_name) === false)
      debug(`init: Can not create table ${main_table_name}. Exiting...`);
    // client.end();
  }

  async init() {
    if (await checkInit.call(this))
      return this;

    debug('PostgresHelpers: init');
    this.initialize_status = initializeStatuses.start;

    try {
      await this.createTables();

      this.initialize_status = initializeStatuses.done;
    } catch (ex) {
      // client = null;
      debug('init: Error', ex);
      this.initialize_status = null;
    }

    return this;
  }

  async tableExists(table_name) {
    const tableExists_query = tableExistsQuery(sqlHelper, table_name);
    // debug('tableExists: query', tableExists_query);
    const result = await this.query(tableExists_query);
    // debug('tableExists', result);
    return Array.isArray(result.rows) && result.rows.length === 1
      && result.rows[0].count.toString() === '1';
  }

  getById(table_name, id, fields = '') {
    if (!table_name) {
      debug('getById: Please provide table name.');
      return null;
    }

    /*
    if (!client) {
      debug('getById: Please init database first.');
      return null;
    }
    */

    if (!id) {
      debug('getById: Please provide id.');
      return null;
    }

    const select_command = sqlHelper.$select({
      $columns: convertFieldsToColumns(fields),
      $from: table_name,
      $where: { id }
    });

    // debug('getById: select_command', select_command);
    return this.query(select_command);
  }

  async internalGetById(table_name, id, fields = '') {
    try {
      const result = await this.getById(table_name, id, fields);
      if (Array.isArray(result.rows) && result.rows > 0)
        return result.rows[0];
    } catch (ex) {
      debug('internalGetById Error', ex);
    }

    return null;
  }

  async getByQuery(options = {}) {
    options = options || {};
    const { table_name, show_total = false } = options;

    if (!table_name) {
      debug('getByQuery: Please provide table name.');
      return null;
    }

    /*
    if (!client) {
      debug('getByQuery: Please init database first.');
      return null;
    }
    */

    const builder = getBuilder(options);

    debug('getByQuery: builder', JSON.stringify(builder));
    const result = await this.query(sqlHelper.$select(builder));
    // debug('result', result);

    const returnData = { data: (result && result.rows) || [] };
    await this.queryTotal(show_total, returnData, builder);
    return returnData;
  }

  async queryTotal(show_total, returnData, builder) {
    if (!show_total || (returnData.data.length === 0 && !builder.$offset))
      return;

    builder.$columns = { total: { '$count': 'id' } };
    delete builder.$orderBy;
    delete builder.$limit;
    delete builder.$offset;

    const result = await this.query(sqlHelper.$select(builder));
    returnData.total = (result && result.rowCount) ? parseFloat(result.rows[0].total) : 0;
  }

  validateInsert(isArray, obj) {
    if (isArray) {
      if (obj.length === 0)
        return statusCodes.UNPROCESSABLE_ENTITY;

      obj.forEach(element => {
        delete element.id;
      });

      return null;
    }

    delete obj.id;
    if (Object.keys(obj).length === 0) {
      debug('validateInsert: Object is empty', this.initialize_status);
      return statusCodes.UNPROCESSABLE_ENTITY;
    }

    return null;
  }

  insert(table_name, obj) {
    if (!table_name) {
      debug('insert: Please provide table name.');
      return null;
    }

    /*
    if (!client) {
      debug('insert: Please init database first.');
      return null;
    }
    */

    const isArray = Array.isArray(obj);
    debug('insert', table_name, obj);
    const code = this.validateInsert(isArray, obj);
    if (code)
      return { code };

    const insert_command = sqlHelper.$insert({
      $table: table_name, $documents: obj
    });

    const cmd = insert_command.sql;
    return this.query(isArray ? cmd : `${cmd} returning *;`, insert_command.values);
  }

  async update(table_name, id, obj, check_exists = false) {
    if (!table_name) {
      debug('update: Please provide table name.');
      return null;
    }

    /*
    if (!client) {
      debug('update: Please init database first.');
      return null;
    }
    */

    debug('update', table_name, id, obj);

    const code = await this.checkExistsCode(check_exists, table_name, id);
    if (code)
      return code;

    delete obj.id;
    /*
    for (var key in obj) {
      if (obj[key] === null || obj[key] === undefined)
        delete obj[key];
    }
    */

    if (Object.keys(obj).length === 0) {
      debug('update: Please provide id.');
      return statusCodes.UNPROCESSABLE_ENTITY;
    }

    obj.updated_at = new Date().toISOString();
    // debug('update: obj', obj);
    const update_command = sqlHelper.$update({
      $table: table_name, $set: obj,
      $where: { id }
    });

    return this.query(update_command);
  }

  async checkExistsCode(check_exists, table_name, id) {
    id = flatten([id]);

    if (!check_exists || id.length !== 1 || !id[0])
      return null;

    id = id[0];
    const record = await this.internalGetById(table_name, id, 'id');
    if (!record) {
      debug(`checkExistsCode: Record with id: [${id}] from table: [${table_name}] does not exists.`);
      return statusCodes.UNPROCESSABLE_ENTITY;
    }

    return null;
  }

  checkUnprocessable(check_exists, table_name, id_or_ids) {
    if ((!Array.isArray(id_or_ids) && !id_or_ids) || (Array.isArray(id_or_ids) && id_or_ids.length === 0)) {
      debug('delete: Please provide id or ids array.');
      return statusCodes.UNPROCESSABLE_ENTITY;
    }

    return this.checkExistsCode(check_exists, table_name, id_or_ids);
  }

  async delete(table_name, id_or_ids, check_exists = false) {
    if (!table_name) {
      debug('delete: Please provide table_name.');
      return statusCodes.UNPROCESSABLE_ENTITY;
    }

    /*
    if (!client) {
      debug('delete: Please init database first.');
      return null;
    }
    */

    const code = await this.checkUnprocessable(check_exists, table_name, id_or_ids);
    if (code)
      return code;

    let idsQuery = {};
    id_or_ids = flatten([id_or_ids]);

    if (id_or_ids.length > 1)
      idsQuery = { id: { $in: id_or_ids } };
    else
      idsQuery = { id: id_or_ids[0] };

    const delete_command = sqlHelper.$delete({
      $from: table_name, $where: idsQuery
    });

    return this.query(delete_command);
  }

  async handleRetryQuery(error, sql, values, retryCount) {
    debug('handleRetryQuery: Error', error);
    if (!error)
      return null;

    const systemDBError = systemDBErrorCodes.find(z => z.code === error.code);
    if (systemDBError && retryCount < 3) { // bit.io error
      debug('handleRetryQuery: sleep 2 seconds and retry...');
      await sleep(2000);
      return this.query(sql, values, ++retryCount);
    }

    return null;
  }

  query(sql, values = null, retryCount = 0) {
    if (!sql) {
      debug('query: empty command');
      return null;
    }

    const [queryCommand, params] = pool.extractSqlParam(sql);

    sql = queryCommand.replace(/ LIKE /ig, ' ILIKE ');
    // debug('query', sql, values);
    values = (!values || !Array.isArray(values)) ? params : values;

    try {
      return pool.query(sql, values);
    } catch (error) {
      return this.handleRetryQuery(error, sql, values, retryCount);
    }
  }
}

module.exports = new PostgresHelpers();
