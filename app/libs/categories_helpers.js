const debug = require('debug')('money-diary-server:->libs->categories_helpers');
const { statusCodes, } = require('./variables');
const BaseHelpers = require('./base_helpers');
const { buildQueryDateRange, } = require('./helpers');

const extractFields = (category = {}) => {
  category = category || {};
  const { name = '', enabled = true, text_color_variant = '', bg_color_variant = '', } = category;
  return { name, enabled, text_color_variant, bg_color_variant, };
};

class CategoriesHelpers extends BaseHelpers {
  constructor() {
    super();
    this.table_name = 'categories';
    this.model_name = 'Category';
    this.requiredFields = ['name'];
  }

  async validate(obj) {
    const code = super.validate(obj);
    if (code)
      return code;

    if (await this.checkDuplicateName(obj.name, obj.id)) // check for duplicate name
      return { code: statusCodes.DUPLICATED };
    else
      return null;
  }

  async checkDuplicateName(name, id) {
    if (!name || !id)
      return false;

    const { data = [] } = await this.getByQuery({
      table_name: this.table_name,
      query: { name, id: { $ne: id } }, fields: 'id', limit: 1
    });

    debug('checkDuplicateName: data', data);
    return data.length > 0;
  }

  async search(options = {}) {
    options = options || {};
    const { name = '', enabled, from_date, to_date } = options;
    const query = buildQueryDateRange(from_date, to_date) || {};

    if (name && name.length > 1) {
      query.name = {
        '$ilike': `%${name}%`,
      }
    }

    if (typeof enabled !== 'undefined')
      query.enabled = enabled;

    if (Object.keys(query).length === 0)
      return { code: statusCodes.UNPROCESSABLE_ENTITY };

    // debug('query', query);
    const { data: message, total = 0, } = await this.getByQuery({ ...options, query });
    return { code: statusCodes.OK, message, total, };
  }

  async insert(category = {}) {
    category = category || {};
    const validate_result = await this.validate(category);
    if (validate_result)
      return validate_result;

    return this.baseInsert(extractFields(category));
  }

  async update(id, category = {}, check_exists = false) {
    category = category || {};
    category.id = id;
    const validate_result = await this.validate(category);
    if (validate_result)
      return validate_result;

    return this.baseUpdate(id, extractFields(category), check_exists);
  }
}

module.exports = CategoriesHelpers;
