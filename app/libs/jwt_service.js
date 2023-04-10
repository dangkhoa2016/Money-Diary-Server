const debug = require('debug')('money-diary-server:->libs->jwt_service');
const axios = require('axios');
const fs = require('fs');
const vercelMs = require('ms');
const jwt = require('jsonwebtoken');
const namespace = 'money-diary-server';
const { jwtConfig, initializeStatuses, } = require('./variables');
const moment = require('moment');
const path = require('path');
const configFolder = path.join(process.cwd(), process.env.DATA_FOLDER);
const randomCrypto = require('./random_crypto.js');
const { checkInit, } = require('./helpers');

class JwtService {
  constructor() {
    this.caches = [];
    const expiresIn = jwtConfig.options.expiresIn;
    const milliseconds = vercelMs(expiresIn) + vercelMs(process.env.REFRESH_TOKEN_EXPIRES_AFTER_JWT_EXPIRES_IN || '2m');
    this.seconds = milliseconds / 1000;
    this.tokenServerEndpoint = process.env.REFRESH_TOKEN_SERVER;
    this.tokenServerKey = process.env.REFRESH_TOKEN_KEY;
    this.initialize_status = null;
    this.privateKey = null;
    this.publicKey = null;
  }

  async init() {
    if (await checkInit.call(this))
      return;

    debug('JwtService: init');
    this.initialize_status = initializeStatuses.start;

    const privateKey = await fs.readFileSync(path.join(configFolder, 'private.key'), 'utf8');
    const publicKey = await fs.readFileSync(path.join(configFolder, 'public.key'), 'utf8');
    this.privateKey = await randomCrypto.decrypt(privateKey);
    this.publicKey = await randomCrypto.decrypt(publicKey);
    // debug('JwtService: init: privateKey', this.privateKey);
    // debug('JwtService: init: publicKey', this.publicKey);

    this.initialize_status = initializeStatuses.done;
  }

  sign(payload) {
    if (typeof (payload) === 'string')
      payload = { payload };
    const index = this.findIndex(payload);
    if (index === -1)
      this.caches.push(JSON.stringify(payload));
    // debug('sign:', jwtConfig.options, payload);
    return jwt.sign(payload, this.privateKey, jwtConfig.options);
  }

  async getRefreshToken(key) {
    if (!key)
      return '';

    // debug('getRefreshToken: key', key);
    try {
      const response = await axios.get(`${this.tokenServerEndpoint}/${namespace}:${key}`,
        { headers: { 'authorization': `Bearer ${this.tokenServerKey}` } });
      debug('getRefreshToken: Result', response.data);
      return response.data;
    } catch (err) {
      debug('getRefreshToken: Error', err);
      return '';
    }
  }

  isRefreshTokenValid(token) {
    try {
      // debug('isRefreshTokenValid', this.caches);
      jwt.verify(token, this.privateKey);
      return true;
    } catch (error) {
      debug('isRefreshTokenValid: Error', error);
      return false;
    }
  }

  signRefreshToken(payload) {
    if (!payload)
      return '';

    debug('signRefreshToken: payload', payload);
    const key = jwt.sign(payload, this.privateKey, { algorithm: jwtConfig.options.algorithm });
    // debug('signRefreshToken: key', key);

    return this.updateRefreshToken(key);
  }

  async updateRefreshToken(key) {
    if (!key)
      return '';

    // debug('updateRefreshToken: key', key);

    try {
      const response = await axios.post(this.tokenServerEndpoint,
        { key: `${namespace}:${key}`, value: key, expiration: moment().add(this.seconds, 'seconds').valueOf() },
        { headers: { 'authorization': `Bearer ${this.tokenServerKey}` } });
      debug('updateRefreshToken: Updated RefreshToken', response.data);
    } catch (err) {
      debug('updateRefreshToken: Error', err);
    }

    return key;
  }

  findIndex(obj, isVerify = false) {
    if (!obj)
      return -1;

    if (!this.caches)
      this.caches = [];

    const str = JSON.stringify(obj);
    let indx = -1;
    if (this.caches.length > 0)
      indx = this.caches.indexOf(str);

    if (isVerify && indx === -1) {
      this.caches.push(str);
      indx = 0;
    }

    return indx;
  }

  verify(token, skipVerify = false) {
    try {
      // get the decoded payload and header
      const obj = this.getPayload(token);
      // debug('verify obj', obj, skipVerify);
      if (!obj)
        return false;
      else if (skipVerify)
        return true;

      const index = this.findIndex(obj, true);

      return index === -1 ? false : jwt.verify(token, this.publicKey, jwtConfig.options);
    } catch (error) {
      debug('verify: Error', error);
      return false;
    }
  }

  getPayload(token) {
    if (!token) return null;
    let object = null;

    try {
      object = jwt.decode(token, { complete: false });
      // debug('getPayload: object', object, this.caches);

      if (object) {
        // debug('getPayload: Decode', jwtConfig.options, object);
        delete object.iat;
        delete object.exp;
        delete object.aud;
        delete object.iss;
      }
    } catch (error) {
      debug('getPayload: Error', error);
    }

    return object;
  }

  decode(token) {
    debug('decode', this.caches);
    return jwt.decode(token, { complete: true });
  }

  logout(token) {
    if (!token)
      return;

    const obj = this.getPayload(token);
    if (!obj)
      return;

    const index = this.findIndex(obj);
    if (index !== -1)
      this.caches.splice(index, 1);
  }
}

module.exports = new JwtService();
