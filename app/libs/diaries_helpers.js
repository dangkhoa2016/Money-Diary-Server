const debug = require('debug')('money-diary-server:->libs->diaries_helpers');
const { statusCodes, } = require('./variables');
const SQLBuilder = require('json-sql-builder2');
const sql = new SQLBuilder('PostgreSQL');
const BaseHelpers = require('./base_helpers');
const { buildQueryDateRange, buildQueryMoneyRange, } = require('./helpers');

const buildCategoriesAndReasonFields = (category_ids, reason) => {
  const query = {};

  if (Array.isArray(category_ids) && category_ids.length > 0)
    query['$or'] = category_ids.map(id => ` (${id} = ANY(category_ids)) `);

  if (reason && reason.length > 1)
    query.reason = { '$ilike': `%${reason}%`, };
  return query;
};

const extractFields = (diary = {}) => {
  diary = diary || {};
  let { reason = '', money = 0, created_at = new Date(), category_ids = [] } = diary;
  if (category_ids.length > 0)
    category_ids = `{${category_ids.join(', ')}}`
  return { reason, money, created_at, category_ids, };
};

class DiariesHelpers extends BaseHelpers {
  constructor() {
    super();
    this.table_name = 'diaries';
    this.model_name = 'Diary';
    this.requiredFields = ['reason', 'money',];
  }

  getArray(field) {
    field = Array.from(new Set([...[field]])).flat();
    return field.map(id => Number(id)).filter(c => c);
  }

  buildSearchQueries(options) {
    options = options || {};
    const { from_date, to_date, from_money = 0, to_money = 0, reason = '', } = options;

    let category_ids = this.getArray(options.category_ids);
    const temp_category_ids = this.getArray(options['category_ids[]'] || options['category_ids^%^5B^%^5D'] || []);
    category_ids = Array.from(new Set([...category_ids, ...temp_category_ids])).flat();

    const query = { ...(buildQueryDateRange(from_date, to_date) || {}), ...(buildQueryMoneyRange(from_money, to_money) || {}) };
    debug('buildSearchQueries', query, this.model_name);
    const query1 = Object.entries(query).map(field => ({ [field[0]]: field[1] }));
    const query2 = Object.entries(buildCategoriesAndReasonFields(category_ids, reason)).map(field => ({ [field[0]]: field[1] }));
    return { '$and': [...query1, ...query2] };
  }

  async search(options = {}) {
    options = options || {};
    const query = this.buildSearchQueries(options);
    if (Object.keys(query).length === 0)
      return { code: statusCodes.UNPROCESSABLE_ENTITY };

    // debug('query', query);
    const { data: message, total = 0, } = await this.getByQuery({ ...options, query });
    return { code: statusCodes.OK, message, total, };
  }

  insert(diary = {}) {
    const validate_result = this.validate(diary);
    if (validate_result)
      return validate_result;

    return this.baseInsert(extractFields(diary));
  }

  update(id, diary = {}, check_exists = false) {
    const validate_result = this.validate(diary);
    if (validate_result)
      return validate_result;

    return this.baseUpdate(id, extractFields(diary), check_exists);
  }

  async reportSummaryByDateRange(from_date, to_date) {
    const query = buildQueryDateRange(from_date, to_date);
    // debug('query', query);
    if (!query)
      return { code: statusCodes.UNPROCESSABLE_ENTITY };

    const queryInfo = sql.$select({
      $columns: {
        'reason_count': { $count: 'id' },
        total: { $sum: 'money' }
      },
      $from: 'diaries',
      $where: query,
    });

    try {
      const result = await this.query(queryInfo.sql, queryInfo.values);
      if (!result || result.rowCount === 0) {
        debug(`reportSummaryByDateRange: Not found diary with date range: [${from_date}, ${to_date}]`);
        return { code: statusCodes.OK, message: {} };
      }

      return { code: statusCodes.OK, message: result.rows[0] };
    } catch (error) {
      debug('reportSummaryByDateRange: Error', error);
      return { code: statusCodes.INTERNAL_SERVER_ERROR, error: error.message };
    }
  }

  async reportDetailByDateRange(from_date, to_date) {
    const query = buildQueryDateRange(from_date, to_date);
    // debug('query', query);

    if (!query)
      return { code: statusCodes.UNPROCESSABLE_ENTITY };

    const queryInfo = sql.$select({
      $columns: {
        'reason_count': { $count: 'id' }, total: { $sum: 'money' },
        created_atx: sql.aggregationHelper('created_at'),
      },
      $from: 'diaries', $where: query,
      $groupBy: ['created_atx'], $orderBy: ['created_atx']
    });

    queryInfo.sql = queryInfo.sql.replace('{aggName}(created_at)', 'DATE(created_at)');
    // debug(queryInfo);

    try {
      const result = await this.query(queryInfo.sql, queryInfo.values);
      if (!result || result.rowCount === 0) {
        debug(`reportDetailByDateRange: Not found diary with date range: [${from_date}, ${to_date}]`);
        return { code: statusCodes.OK, message: [] };
      }

      return { code: statusCodes.OK, message: result.rows };
    } catch (error) {
      debug('reportDetailByDateRange: Error', error);
      return { code: statusCodes.INTERNAL_SERVER_ERROR, error: error.message };
    }
  }

}

module.exports = DiariesHelpers;
