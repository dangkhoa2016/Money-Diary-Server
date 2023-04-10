const timeHelper = require('./time_helpers');
const debug = require('debug')('money-diary-server:->libs->guard_middleware');
const _includes = require('lodash/includes');
const { mustExcludes, statusCodes, redisNamespace, } = require('./variables');
const JwtService = require('./jwt_service');
const { RateLimiterRedis } = require('rate-limiter-flexible');

const getToken = (req) => {
  const bearer = req.headers.authorization || '';
  let token = bearer.split(' ')[1];
  if (token)
    return token;

  token = req.cookies.auth_token;
  if (token)
    return token;

  return req.query.auth_token;
};

const handleRejected = (rlRejected, reply) => {
  if (rlRejected instanceof Error) {
    debug('verify: Error consume point', rlRejected);
    reply.code(statusCodes.ERROR_CONSUME_POINT).send();
    return;
  }

  const number_seconds = Math.round(rlRejected.msBeforeNext / 1000) || 1;
  debug('verify: Wrong password so many times');
  reply.header('Retry-After', number_seconds).code(statusCodes.INVALID_REQUEST_SO_MANY_TIMES).send({
    humanReadable: timeHelper.formatHumanReadable(number_seconds)
  });
};

class GuardMiddleware {
  constructor(redisClient, userIP) {
    this.limiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: `${redisNamespace}:login_fail_consecutive_username`,
      points: 3, // only 3 failed attemps
      duration: 60 * 60 * 3, // Store number for three hours since first fail
      blockDuration: 60 * 360, // Block for 360 minutes
    });
    this.rlResUsername = null;
    this.forResetDB = false;
    this.clientIp = userIP;
  }

  async getRateLimitResUsername() {
    if (!this.rlResUsername)
      this.rlResUsername = await this.limiter.get(this.clientIp);
    return this.rlResUsername;
  }

  async handleBlocked(reply) {
    const rlResUsername = await this.getRateLimitResUsername();
    debug('handleBlocked: rlResUsername', rlResUsername, this.clientIp);
    if (rlResUsername && rlResUsername.consumedPoints > this.limiter.point) {
      const number_seconds = Math.round(rlResUsername.msBeforeNext / 1000) || 1;

      reply.header('Retry-After', number_seconds);
      debug('handleBlocked: Wrong password so many times');
      reply.code(statusCodes.INVALID_REQUEST_SO_MANY_TIMES).send({
        humanReadable: timeHelper.formatHumanReadable(number_seconds)
      });

      return true;
    }

    return false;
  }

  async handleInvalid(code, reply) {
    if (await this.handleBlocked(reply))
      return;

    const remain = this.limiter.points - ((this.rlResUsername && this.rlResUsername.consumedPoints) || 0) - 1;

    try {
      await this.limiter.consume(this.clientIp);
      reply.header('Remain', remain).code(code).send();
    } catch (rlRejected) {
      handleRejected(rlRejected, reply);
    }
  }

  async resetClientIp() {
    const rlResUsername = await this.getRateLimitResUsername();
    if (rlResUsername && rlResUsername.consumedPoints > 0) {
      try {
        // Reset on successful authorisation
        await this.limiter.delete(this.clientIp);
      } catch (error) {
        debug('resetClientIp: Error remove ip', error);
      }
    }
  }

  async checkTokenValid(req) {
    const token = getToken(req);
    debug('checkTokenValid: token', token);

    let payload = null;
    try {
      payload = JwtService.getPayload(token);
    } catch (errx) {
      debug('checkTokenValid: JwtService.getPayload Error', errx);
    }

    // debug('checkTokenValid: payload', payload);
    const tokenValid = await JwtService.verify(token, this.forResetDB);
    if (payload && !tokenValid) {
      debug('checkTokenValid: Invalid token');
      return 'invalid';
    }

    return payload;
  }

  async verifyPayload(payload, permission) {
    debug('verifyPayload', payload);
    if (!payload || !Array.isArray(payload.roles))
      return false;

    const is_valid = payload.roles.findIndex(r => (r.toLowerCase() === permission.toLowerCase())) !== -1;
    if (is_valid)
      await this.resetClientIp(this.clientIp);

    return is_valid;
  }

  verify(permission) {
    const gm = this;
    gm.forResetDB = (permission === 'demo');

    return async (req, reply) => {

      const url = (req.routerPath || req.url).substring(1).toLowerCase();
      if (!url || _includes(mustExcludes, url))
        return;

      // debug('verify: headers', req.headers);

      const payload = await gm.checkTokenValid(req, reply);

      let code = null;
      if (!payload)
        code = statusCodes.MISSING_TOKEN;
      else if (payload === 'invalid')
        code = statusCodes.INVALID_AUTH_TOKEN;
      if (code) {
        await gm.handleInvalid(code, reply);
        return;
      }

      const is_valid = await gm.verifyPayload(payload, permission);
      if (is_valid) return;

      debug('verify: User does not have permission');
      await gm.handleInvalid(statusCodes.NOT_HAVE_PERMISSION, reply);
    }
  }
}

module.exports = GuardMiddleware;
