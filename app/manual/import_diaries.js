const debug = require('debug')('money-diary-server:->manual->import');
const table_name = 'diaries';
const client = require('../libs/postgres_helpers');
const _chunk = require('lodash/chunk');
const _pick = require('lodash/pick');
const Promise = require('bluebird');

class ImportJson {
  constructor() {
    this.batch_size = 10;
  }

  async run(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      debug('No data to run.');
      return [];
    }

    await client.init();

    return Promise.map(_chunk(arr, this.batch_size), async chunk => {
      const documents = chunk.map(json => (_pick(json, ['reason', 'money', 'created_at', 'updated_at', 'category_id'])));
      // debug('documents', documents);
      const result = await client.insert(table_name, documents);
      debug('bulk insert result', result);
      return result;
    });
  }
}

module.exports = new ImportJson();
