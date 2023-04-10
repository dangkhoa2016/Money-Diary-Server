const debug = require('debug')('money-diary-server:->libs->axios_helpers');

module.exports = function(error) {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    if (Buffer.isBuffer(error.response.data))
      debug(Buffer.from(error.response.data, 'binary').toString());
    else
      debug(error.response.data);
    debug(error.response.status);
    // debug(error.response.headers);
  } else if (error.request) {
    // The request was made but no response was received
    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    // debug(error.request);
  } else {
    // Something happened in setting up the request that triggered an Error
    debug(error.message);
  }
  // debug(error.config);
}
