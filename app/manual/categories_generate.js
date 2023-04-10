const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
const CategoriesGenerate = require('../libs/categories_generate');
const client = require('../libs/postgres_helpers');

(async() => {

  const resetCommand = `
TRUNCATE categories;
DELETE FROM categories;
ALTER SEQUENCE categories_id_seq RESTART WITH 1;
`;

  await client.init();
  await client.query(resetCommand);
  await CategoriesGenerate.run(10);

})();
