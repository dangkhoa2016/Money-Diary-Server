const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 256 bits (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text) {
  return new Promise(resolve => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);

    encrypted = Buffer.concat([encrypted, cipher.final()]);

    resolve(`${iv.toString('hex')}:${encrypted.toString('hex')}`);
  });
}

function decrypt(text, force_empty = false) {
  return new Promise(resolve => {
    text = text || ''
    if (text.length < 2)
      return resolve(force_empty ? '' : text);

    try {
      const textParts = text.split(':');
      const iv = Buffer.from(textParts.shift(), 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
      let decrypted = decipher.update(encryptedText);

      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return resolve(decrypted.toString());
    } catch (err) {
      return resolve(force_empty ? '' : text);
    }
  });
}

module.exports = { decrypt, encrypt };
