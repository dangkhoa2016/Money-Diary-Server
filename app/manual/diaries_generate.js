const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
const DiariesGenerate = require('../libs/diaries_generate');
const client = require('../libs/postgres_helpers');

(async() => {

  const resetCommand = `
TRUNCATE diaries;
DELETE FROM diaries;
ALTER SEQUENCE diaries_id_seq RESTART WITH 1;
`;

  await client.init();
  await client.query(resetCommand);
  await DiariesGenerate.run();

})();
