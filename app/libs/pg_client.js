const { DB_CONNECTION_STRING = '' } = process.env;
const debug = require('debug')('money-diary-server:->libs->pg_client');

const { Pool, Query } = require('pg');
const submit = Query.prototype.submit;
Query.prototype.submit = function (...args) {
  const text = this.text;
  const values = this.values || [];
  const query = text.replace(/\$([0-9]+)/g, (m, v) => JSON.stringify(values[(Number(v) || 0) - 1]))
  debug('trace query:', query);
  submit.apply(this, args);
};

const pool = new Pool({ connectionString: DB_CONNECTION_STRING });

pool.on('connect', () => {
  debug('database connected!');
});

const extractSqlParam = (sql) => {
  let values = null;

  if (Array.isArray(sql) && sql.length > 0) {
    values = sql[1];
    sql = sql[0];
  } else if (typeof sql !== 'string') {
    values = sql.values;
    sql = sql.sql;

  }

  return [sql, values];
};

module.exports = {
  extractSqlParam,
  query(sql, values = null) {
    if (!sql) {
      debug('query: empty command');
      return null;
    }

    const [queryCommand, params] = extractSqlParam(sql);
    if (!values)
      values = params;
    sql = null;

    // debug('query', queryCommand, values);
    return pool.query(queryCommand, values);
  },
};
