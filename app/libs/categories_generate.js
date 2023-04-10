const debug = require('debug')('money-diary-server:->libs->categories_generate');
const moment = require('moment');
const table_name = 'categories';
const Promise = require('bluebird');
const { faker } = require('@faker-js/faker');
const client = require('../libs/postgres_helpers');
const { randomDate, getRandomDates, } = require('./helpers');

const variantOptions = [
  { text: 'Danger', value: 'danger' },
  { text: 'Info', value: 'info' },
  { text: 'Primary', value: 'primary' },
  { text: 'Warning', value: 'warning' },
  { text: 'Secondary', value: 'secondary' },
  { text: 'Success', value: 'success' },
  { text: 'White', value: 'white' },
  { text: 'Black', value: 'black' },
  { text: 'Transparent', value: 'transparent' },
  { text: 'Lightest', value: 'lightest' },
  { text: 'Lighter', value: 'lighter' },
  { text: 'Light', value: 'light' },
  { text: 'Gray', value: 'gray' },
];

const generate_category_for_date = (date) => {
  const start_date = moment(date).startOf('day').toDate();
  const end_date = moment(date).endOf('day').toDate();
  let category = null;
  const text_color_variant = variantOptions[Math.floor(Math.random() * variantOptions.length)].value;
  let bg_color_variant = null;
  do {
    bg_color_variant = variantOptions[Math.floor(Math.random() * variantOptions.length)].value;
  } while (bg_color_variant === text_color_variant);

  category = {
    created_at: randomDate(start_date, end_date).toDate(),
    name: faker.company.name(),
    text_color_variant,
    bg_color_variant,
    enabled: true,
  };

  // debug(date, category);
  return category;
};

class CategoriesGenerate {
  constructor() {
    this.default_num = 10;
  }

  async run(number_of_rows) {
    await client.init();

    const max_date = moment().add(2, 'weeks').toDate();
    const min_date = moment(max_date).add(-90, 'days').toDate();
    let num = Number(number_of_rows) || 0;
    if (num < 10 || num > 50)
      num = this.default_num;
    const arr_dates = getRandomDates(num, min_date, max_date);

    // console.log(arr_dates.sort((a,b) => (a - b)));

    const categories = await Promise.map(arr_dates, date => {
      return generate_category_for_date(date.toDate());
    }, { concurrency: 5 });

    debug('run', categories);

    const result = await client.insert(table_name, categories);
    return result.rowCount;
  }
}

module.exports = new CategoriesGenerate();
