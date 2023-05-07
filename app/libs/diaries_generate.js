const debug = require('debug')('money-diary-server:->libs->diaries_generate');
const CategoriesHelpers = require('./categories_helpers');
const moment = require('moment');
const Promise = require('bluebird');
const { faker } = require('@faker-js/faker');
const client = require('../libs/postgres_helpers');
const table_name = 'diaries';
const { randomDate, getRandomDates, } = require('./helpers');

const random_money = (min, max, decimalPlaces) => {
  const rand = Math.random() * (max - min) + min;
  const power = Math.pow(10, decimalPlaces);
  return (Math.floor(rand * power) / power) * 1000;
};


class DiariesGenerate {
  constructor() {
    this.categories_helpers = null;
    this.categories = [];
  }

  generate_diary_for_date(date) {
    const num = Math.floor(Math.random() * 6);
    const start_date = moment(date).startOf('day').toDate();
    const end_date = moment(date).endOf('day').toDate();
    const diaries = [];

    for (let index = 0; index < num; index++) {
      diaries.push({
        created_at: randomDate(start_date, end_date).toDate(),
        reason: faker.lorem.sentence(),
        money: random_money(100, 1000, 0),
        category_ids: `{${faker.helpers.arrayElements(this.categories, faker.mersenne.rand(4, 1)).map(c => c.id).join(', ')}}`
      });
    }

    debug('generate_diary_for_date', date, diaries);

    return client.insert(table_name, diaries);
  }

  async getCategories() {
    const { data = [] } = (await this.categories_helpers.getByQuery()) || {};
    this.categories = data;
  }

  async run() {
    await client.init();
    this.categories_helpers = new CategoriesHelpers();
    await this.getCategories();

    const max_date = moment().add(2, 'weeks').toDate();
    const min_date = moment(max_date).add(-90, 'days').toDate();
    const num = 60;
    const arr_dates = getRandomDates(num, min_date, max_date);

    // console.log(arr_dates.sort((a,b) => (a - b)));

    const arr = await Promise.map(arr_dates, date => this.generate_diary_for_date(date.toDate()), { concurrency: 1 });

    return arr.reduce((total, result) => {
      return (typeof (result) === 'object' ? result.rowCount : 0) + total;
    }, 0);
  }
}

module.exports = new DiariesGenerate();
