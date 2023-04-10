const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
let diaries_helpers = null;
const DiariesHelpers = require('../libs/diaries_helpers');
const moment = require('moment');
const debug = require('debug')('money-diary-server:->manual->by_month');

(async () => {

  diaries_helpers = new DiariesHelpers();
  await diaries_helpers.init();

  const getByMonth = diaries_helpers.getByMonth;

  try {
    let result = null;
    result = await getByMonth({ date: moment().startOf('month').valueOf(), utc_offset: 420 });
    debug(result);

    result = await getByMonth({ date: 0, utc_offset: 420 });
    debug(result);

    result = await getByMonth({ date: null, utc_offset: 420 });
    debug(result);

    result = await getByMonth({ date: new Date(), utc_offset: 420 });
    debug(result);

    result = await getByMonth({ date: moment().startOf('month').valueOf(), utc_offset: 0 });
    debug(result);

    result = await getByMonth({ date: moment().startOf('month').valueOf(), utc_offset: 120 });
    debug(result);

    result = await getByMonth({  utc_offset: 420, limit: 2, date: moment().startOf('month').valueOf(), });
    debug(result);

    result = await getByMonth({ date: moment().startOf('month').valueOf(), limit: 2, offset: 2 });
    debug(result);

    result = await getByMonth({ date: moment().startOf('month').valueOf(), offset: 1 });
    debug(result);

    result = await getByMonth({ date: moment().startOf('month').valueOf(), offset: 1, sort_field: 'id', sort_direction: 'desc' });
    debug(result);

    result = await getByMonth({ sort_field: 'money', sort_direction: 'desc', date: moment().startOf('month').valueOf(), offset: 0, });
    debug(result);

    result = await getByMonth({ date: moment().startOf('month').valueOf(), offset: 0, sort_field: 'money', sort_direction: 'desc', show_total: true });
    debug(result);
  } catch (err) {
    debug('Error connect', err);
    process.exit();
  }

})();
