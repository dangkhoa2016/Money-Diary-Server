const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
let diaries_helpers = null;
const DiariesHelpers = require('../libs/diaries_helpers');
const moment = require('moment');
const debug = require('debug')('money-diary-server:->manual->by_date');

(async () => {

  diaries_helpers = new DiariesHelpers();
  await diaries_helpers.init();
  const getByDate = diaries_helpers.getByDate;

  try {
    let result = null;
    result = await getByDate({ date: moment().startOf('month').valueOf(), utc_offset: 420 });
    debug(result);

    result = await getByDate({ date: 0, utc_offset: 420 });
    debug(result);

    result = await getByDate({ date: null, utc_offset: 420 });
    debug(result);

    result = await getByDate({ date: new Date(), utc_offset: 420 });
    debug(result);

    result = await getByDate({ date: moment().startOf('month').valueOf(), utc_offset: 0 });
    debug(result);

    result = await getByDate({ date: new Date('2023-02-06'), utc_offset: 0 });
    debug(result);

    result = await getByDate({ date: moment().startOf('month').valueOf(), utc_offset: 120 });
    debug(result);

    result = await getByDate({ date: new Date('2022-10-07'), utc_offset: 420, limit: 2 });
    debug(result);

    result = await getByDate({ date: new Date('2022-10-07'), limit: 2, offset: 2 });
    debug(result);

    result = await getByDate({ date: new Date('2022-10-07'), offset: 1 });
    debug(result);

    result = await getByDate({ date: new Date('2022-10-07'), offset: 1, sort_field: 'id', sort_direction: 'desc' });
    debug(result);

    result = await getByDate({ date: new Date('2022-10-07'), offset: 0, sort_field: 'money', sort_direction: 'desc' });
    debug(result);

    result = await getByDate({ date: new Date('2022-10-07'), offset: 0, sort_field: 'money', sort_direction: 'desc', show_total: true });
    debug(result);

  } catch (err) {
    debug('Error connect', err);
    process.exit();
  }

})();
