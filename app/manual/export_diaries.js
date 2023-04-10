const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
const DiariesHelpers = require('../libs/diaries_helpers');
const debug = require('debug')('money-diary-server:->manual->export_diaries');

(async () => {

  try {
    // const export_type = 'csv';
    // const export_type = 'json';
    const export_type = 'zip';

    const diaries_helpers = new DiariesHelpers();
    await diaries_helpers.init();
    const result = await diaries_helpers.export(export_type);

    debug(export_type, result);
  } catch (error) {
    debug('Error export', error);
  }

})();