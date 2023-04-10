const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
let categories_helpers = null;
const CategoriesHelpers = require('./app/libs/categories_helpers');
const moment = require('moment');
const debug = require('debug')('money-diary-server:->manual->categories');

(async () => {

  categories_helpers = new CategoriesHelpers();
  await categories_helpers.init();

  // create
  try {
    let result = null;
    result = await categories_helpers.insert({ created_at: moment().startOf('month').valueOf(), utc_offset: 420, name: 'test' });
    debug(result);

    // check for duplicate name
    result = await categories_helpers.insert({ name: 'test', enabled: false, });
    debug(result);

    result = await categories_helpers.update(2, { name: 'test' });
    debug(result);
    // check for duplicate name


    result = await categories_helpers.update(2, { name: 'test2' });
    debug(result);

    result = await categories_helpers.update(3, { created_at: moment().startOf('month').valueOf(), utc_offset: 420, name: 'test' });
    debug(result);

    result = await categories_helpers.delete(3);
    debug(result);

    result = await categories_helpers.bulkDelete([1, 3]);
    debug(result);

    result = await categories_helpers.bulkDelete([2, 4]);
    debug(result);

    result = await categories_helpers.getByQuery({ query: { name: 'test' } });
    debug(result);

    result = await categories_helpers.getByQuery({ query: { name: 'test', enabled: false } });
    debug(result);

    result = await categories_helpers.getByQuery({ query: {} });
    debug(result);

    result = await categories_helpers.search({ name: 'tes', enabled: false });
    debug(result);

  } catch (err) {
    debug('Error connect', err);
    process.exit();
  }

})();
