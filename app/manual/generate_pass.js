const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
const randomCrypto = require('../libs/random_crypto');
const debug = require('debug')('money-diary-server:->manual->generate_pass');

(async () => {

  try {
    const pass = await randomCrypto.encrypt(process.env.SECRET);
    debug(pass);
  } catch (error) {
    debug('Error generate pass', error);
  }

})();
