const debug = require('debug')('money-diary-server:->routes->login');
const { JwtService, randomCrypto,
  variables: { statusCodes, jwtConfig, redisNamespace, isProductionEnv, isDemoEnv, },
} = require('../libs');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const vercelMs = require('ms');

//will be replace with User Model object
const userDemo = { user_name: 'demo', full_name: 'Demo' };
const user = isDemoEnv ? userDemo : { user_name: 'admin', full_name: 'Admin', phone: '0000.000.0000' };

//will be replace with Role Model object
const roles = ['diaries', 'categories', 'login'];
const blockMinutes = 60 * 60 * 3;


function getFibonacciBlockDurationMinutes(countConsecutiveOutOfLimits) {
  if (countConsecutiveOutOfLimits <= 1) {
    return 1;
  }

  return getFibonacciBlockDurationMinutes(countConsecutiveOutOfLimits - 1) +
    getFibonacciBlockDurationMinutes(countConsecutiveOutOfLimits - 2);
}

const gen_token = () => {
  const payload = { user: { user_name: user.user_name, full_name: user.full_name }, roles };
  const accessTokenExpiresIn = vercelMs(jwtConfig.options.expiresIn) / 1000;

  return {
    accessToken: JwtService.sign(payload),
    accessTokenExpiresIn,
  };
};

const get_tokens = async (refreshToken = null) => {
  const token = gen_token();
  if (!refreshToken)
    refreshToken = await JwtService.signRefreshToken(`${user.user_name}--^--${(new Date().valueOf())}`);
  const refreshTokenExpiresIn = token.accessTokenExpiresIn +
    (vercelMs(process.env.REFRESH_TOKEN_EXPIRES_AFTER_JWT_EXPIRES_IN || '2m') / 1000);

  return {
    ...token, refreshToken, refreshTokenExpiresIn,
  };
};

const update_token = async (refreshToken) => {
  const key = await JwtService.updateRefreshToken(refreshToken);
  return key ? get_tokens(refreshToken) : '';
};


const loginSchema = {
  type: 'object',
  properties: {
    username: { type: 'string' },
    pass: { type: 'string' },
  },
  required: ['username', 'pass']
};

const refreshSchema = {
  type: 'object',
  properties: {
    refresh_token: { type: 'string' },
  },
  required: ['refresh_token']
};

let limiterConsecutiveOutOfLimits = null;
let loginLimiter = null;

const blockWhenInvalid = async (router_path, userIP, resConsume) => {
  debug(`api/${router_path}: resConsume`, resConsume);
  if (resConsume.remainingPoints <= 0) {
    const resPenalty = await limiterConsecutiveOutOfLimits.penalty(userIP);
    debug(`api/${router_path}: resPenalty`, resPenalty);
    const nn = getFibonacciBlockDurationMinutes(resPenalty.consumedPoints);
    debug(`api/${router_path}: nn`, nn);
    await loginLimiter.block(userIP, blockMinutes * (nn / 2));
  }
};

const handleInvalid = async (router_path, userIP, info, reply) => {
  const resConsume = await loginLimiter.consume(userIP);

  try {
    await blockWhenInvalid(router_path, userIP, resConsume);
  } catch (rlRejected) {
    debug(`api/${router_path}: rlRejected`, rlRejected);

    if (rlRejected instanceof Error)
      throw rlRejected;

    reply.set('Retry-After', Math.round(rlRejected.msBeforeNext / 1000) || 1);
    debug(`api/${router_path}: Too many failed ${info} requests`);
    reply.code(statusCodes.TOO_MANY_REQUESTS).send();
    return;
  }

  debug(`api/${router_path}: Invalid ${info}`);
  reply.header('Remain', resConsume.remainingPoints);
  reply.code(router_path === 'login' ? statusCodes.INVALID_USERNAME_OR_PASSWORD : statusCodes.INVALID_REFRESH_TOKEN).send();
};

const handleUnblockUser = async (userIP, reply, refresh_token) => {
  await limiterConsecutiveOutOfLimits.delete(userIP);

  let data = null;
  if (refresh_token) {
    data = await JwtService.getRefreshToken(refresh_token);
    if (!data) {
      debug('handleUnblockUser: Refresh token expired');
      reply.code(statusCodes.REFRESH_TOKEN_EXPIRED).send();
      return;
    }

    data = await update_token(refresh_token);
  }
  else
    data = await get_tokens();

  reply.cookie('auth_token', data.token, {
    maxAge: vercelMs(jwtConfig.options.expiresIn),
    // You can't access these tokens in the client's javascript
    httpOnly: true,
    // Forces to use https in production
    secure: isProductionEnv ? false : true,
  });

  reply.send({ ...data, user });
};

const handleRefreshToken = async (request, reply) => {
  const { refresh_token } = request.body;
  const userIP = request.userIP;
  debug('api/refresh_token: userIP', userIP);

  const resById = await loginLimiter.get(userIP);

  let retrySecs = 0;

  if (resById !== null && resById.remainingPoints <= 0) {
    retrySecs = Math.round(resById.msBeforeNext / 1000) || 1;
  }

  debug('api/refresh_token: retrySecs', retrySecs);

  if (retrySecs > 0) {
    reply.header('Retry-After', retrySecs);
    debug('api/refresh_token: Too many refresh token requests');
    reply.code(statusCodes.TOO_MANY_REQUESTS).send();
    return;
  }

  const isTokenValid = JwtService.isRefreshTokenValid(refresh_token);
  debug('api/refresh_token: isTokenValid', isTokenValid);
  if (!isTokenValid) {
    await handleInvalid('refresh_token', userIP, 'refresh token', reply);
    return;
  }

  await handleUnblockUser(userIP, reply, refresh_token);
};

const checkForBlocked = async (userIP, reply) => {
  const resById = await loginLimiter.get(userIP);

  let retrySecs = 0;

  if (resById !== null && resById.remainingPoints <= 0)
    retrySecs = Math.round(resById.msBeforeNext / 1000) || 1;

  debug('checkForBlocked: retrySecs', retrySecs);

  if (retrySecs > 0) {
    reply.header('Retry-After', retrySecs);
    debug('checkForBlocked: Too many login attempted');
    reply.code(statusCodes.TOO_MANY_LOGIN_ATTEMPS).send();
    return true;
  }

  return false;
};

const handleLogin = async (request, reply) => {
  let { username, pass } = request.body;
  const userIP = request.userIP;
  debug('api/login: userIP', userIP);

  try {
    pass = await randomCrypto.decrypt(pass);
  } catch (errx) {
    pass = '';
  }

  if (!pass || !username) {
    debug('api/login: Must provide username and password');
    reply.code(statusCodes.MUST_PROVIDE_USERNAME_AND_PASSWORD).send();
    return;
  }

  if (await checkForBlocked(userIP, reply))
    return;

  if (pass !== process.env.SECRET) {
    await handleInvalid('login', userIP, 'username or password', reply);
    return;
  }

  await handleUnblockUser(userIP, reply);
};

const routes = (server, options, next) => {

  if (isDemoEnv)
    roles.push('demo');

  loginLimiter = new RateLimiterRedis({
    storeClient: server.redis,
    keyPrefix: `${redisNamespace}:login`,
    points: 5, // 5 attempts
    duration: 60 * 60, // within 60 minutes
  });

  limiterConsecutiveOutOfLimits = new RateLimiterRedis({
    storeClient: server.redis,
    keyPrefix: `${redisNamespace}:login_consecutive_outoflimits`,
    points: 99999, // doesn't matter much, this is just counter
    duration: 0, // never expire
  });

  server.addHook('onRequest', (request, reply, done) => {
    request.custom_config = { permission: 'login' };
    done();
  });

  server.post('/api/refresh_token', { schema: { body: refreshSchema } }, handleRefreshToken);

  server.post('/api/login', { schema: { body: loginSchema } }, handleLogin);

  server.get('/api/me', {}, (request, reply, done) => {
    reply.send(user);
    done();
  });

  next();

}

module.exports = routes;
