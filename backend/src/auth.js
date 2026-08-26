const crypto = require('crypto');

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signingSecret() {
  // A production deployment must provide JWT_SECRET. The fallback keeps local development usable.
  return process.env.JWT_SECRET || 'local-development-secret-change-me';
}

function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }));
  const input = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', signingSecret()).update(input).digest('base64url');
  return `${input}.${signature}`;
}

function verifyToken(token) {
  const [header, body, signature] = String(token || '').split('.');
  if (!header || !body || !signature) throw new Error('Malformed token');
  const expected = crypto.createHmac('sha256', signingSecret()).update(`${header}.${body}`).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid token signature');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

module.exports = { signToken, verifyToken, TOKEN_TTL_SECONDS };
