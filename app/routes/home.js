// const debug = require('debug')('money-diary-server:->routes->home');
const fs = require('fs');
const path = require('path');

const getIconData = async (extension) => {
  if (!extension)
    return [];

  const buffer = await fs.readFileSync(path.join(process.cwd(), `./app/imgs/favicon.${extension}`));
  let mime = extension.toLowerCase();
  if (mime === 'icon')
    mime = 'x-icon';
  return [mime, buffer];
};

const routes = (server, options, next) => {

  server.get('/', (/*request, reply*/) => {
    return 'Welcome !!!'
  });

  for (const extension of ['ico', 'png']) {
    server.get(`/favicon.${extension}`, async (request, reply) => {
      const [mime, buffer] = await getIconData(extension);
      reply.type(`image/${mime}`).send(buffer);
    });
  }

  next();

}

module.exports = routes;
