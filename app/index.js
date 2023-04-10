const debug = require('debug')('money-diary-server:->index');
const { variables: { isDemoEnv, }, } = require('./libs');

// CommonJs
const server = require('fastify')({
  // disableRequestLogging: true,
  logger: false, pluginTimeout: 10000
});

server.register(require('./middleware/logger'));
// server.register(require('./middleware/db_connector'));
server.register(require('./middleware/redis'));
server.register(require('./middleware/check'));

/*
server.register(require('@fastify/multipart'), {
  attachFieldsToBody: true,
  sharedSchemaId: '#fileUploadSchema',
  throwFileSizeLimit: false,
  limits: { fileSize: 1000000 * 1 }
});
*/

server.register(require('@fastify/cookie'), {
  secret: process.env.COOKIE_ENCRYPT, // for cookies signature
  parseOptions: {} // options for parsing cookies
});

server.register(require('@fastify/cors'), {
  exposedHeaders: ['Content-Disposition'],
  allowedHeaders: ['authorization', 'content-type', 'location', 'retry-after'],
  origin: (origin, cb) => {
    // allow all
    cb(null, true);

    /* allow special host
    if (/localhost/.test(origin)) {
      //  Request from localhost will pass
      cb(null, true);
      return;
    }
    // Generate an error on other origins, disabling access
    cb(new Error("Not allowed"));
    */ 
  }
});

server.register(require('./routes/errors'));
server.register(require('./routes/home'));
server.register(require('./routes/diaries'), { prefix: '/api/diaries' });
server.register(require('./routes/categories'), { prefix: '/api/categories' });
if (isDemoEnv)
  server.register(require('./routes/generate'), { prefix: '/api/generate' });
server.register(require('./routes/login'));

debug(`Started at: ${new Date()}`);
module.exports = server;
