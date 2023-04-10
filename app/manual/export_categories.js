const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
const CategoriesHelpers = require('../libs/categories_helpers');
const debug = require('debug')('money-diary-server:->manual->export_categories');

(async () => {

  try {
    // const export_type = 'csv';
    const export_type = 'json';
    // const export_type = 'zip';

    const categories_helpers = new CategoriesHelpers();
    await categories_helpers.init();
    const result = await categories_helpers.export(export_type);

    debug(export_type, result);
  } catch (error) {
    debug('Error export', error);
  }

})();