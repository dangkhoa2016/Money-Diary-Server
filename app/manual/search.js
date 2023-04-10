const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
let diaries_helpers = null;
const DiariesHelpers = require('../libs/diaries_helpers');
const moment = require('moment');
const debug = require('debug')('money-diary-server:->manual->search');

(async () => {

  diaries_helpers = new DiariesHelpers();
  await diaries_helpers.init();
  const search = diaries_helpers.search;

  try {
    let result = null;
    result = await search({ from_date: moment().startOf('month').valueOf() });
    debug(result);

    result = await search({ from_date: 0 });
    debug(result);

    result = await search({ from_date: null });
    debug(result);

    result = await search({ from_date: new Date() });
    debug(result);

    result = await search({ to_date: 0 });
    debug(result);

    result = await search({ to_date: null });
    debug(result);

    result = await search({ to_date: new Date() });
    debug(result);

    result = await search({ from_date: null, to_date: 0, utc_offset: 420 });
    debug(result);

    result = await search({ from_date: moment().startOf('month').valueOf(), utc_offset: 0 });
    debug(result);

    result = await search({ from_date: new Date('2023-02-06'), utc_offset: 0 });
    debug(result);

    result = await search({ from_date: moment().startOf('month').valueOf(), utc_offset: 120 });
    debug(result);

    result = await search({ from_date: new Date('2022-10-07'), limit: 2 });
    debug(result);

    result = await search({ from_date: new Date('2022-10-07'), limit: 2, offset: 2 });
    debug(result);

    result = await search({ from_date: new Date('2022-10-07'), offset: 1 });
    debug(result);

    result = await search({ from_date: new Date('2022-10-07'), offset: 1, sort_field: 'id', sort_direction: 'desc' });
    debug(result);

    result = await search({ from_date: new Date('2022-10-07'), offset: 0, sort_field: 'money', sort_direction: 'desc' });
    debug(result);

    result = await search({
      from_date: new Date('2022-10-07'), to_date: new Date('2022-12-07'),
      from_money: 200000, to_money: 1000000,
      offset: 0, sort_field: 'money', sort_direction: 'desc'
    });
    debug(result);

    result = await search({
      from_date: new Date('2022-10-07'), to_date: new Date('2022-12-07'),
      from_money: 200000, to_money: 1000000, reason: 'xx',
      offset: 0, sort_field: 'money', sort_direction: 'desc'
    });
    debug(result);

    result = await search({
      from_date: new Date('2022-10-07'), to_date: new Date('2022-12-07'),
      from_money: 200000, to_money: 1000000, reason: 'Ariatu', limit: 5,
      offset: 0, sort_field: 'money', sort_direction: 'desc'
    });
    debug(result);

    result = await search({
      from_date: new Date('2022-10-07'), to_date: new Date('2022-12-07'),
      from_money: 200000, to_money: 1000000, reason: 'Ariatu', limit: 5,
      offset: 0, sort_field: 'money', sort_direction: 'desc', show_total: true
    });
    debug(result);

  } catch (err) {
    debug('Error connect', err);
    process.exit();
  }

})();
