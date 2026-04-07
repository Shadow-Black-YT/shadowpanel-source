import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;

export function encrypt(text: string, keyHex: string): string {
  const key = Buffer.from(keyHex.slice(0, 64).padEnd(64, '0'), 'hex');
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

export function decrypt(data: string, keyHex: string): string {
  const [ivHex, tagHex, encHex] = data.split(':');
  const key  = Buffer.from(keyHex.slice(0, 64).padEnd(64, '0'), 'hex');
  const iv   = Buffer.from(ivHex, 'hex');
  const tag  = Buffer.from(tagHex, 'hex');
  const enc  = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString('utf8') + decipher.final('utf8');
}

export function getSystemKey(): string {
  return (process.env.JWT_SECRET || 'default-insecure-key-change-me-please-123').slice(0, 64).padEnd(64, '0');
}
