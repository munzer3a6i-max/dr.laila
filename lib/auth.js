/* ============================================================
   Admin authentication
   ------------------------------------------------------------
   One admin, one password. Built on Node's own crypto — no
   dependencies and no home-made cryptography.

     · password stored only as a scrypt hash (never plaintext)
     · comparison is constant-time
     · session is an HMAC-signed token in an HttpOnly cookie,
       so JavaScript on the page cannot read or forge it
     · failed logins are slowed down and counted per instance

   Env:
     ADMIN_PASSWORD_HASH   scrypt$<saltHex>$<hashHex>
                           generate with: node scripts/hash-password.js
     SESSION_SECRET        long random string (openssl rand -hex 32)
     SESSION_HOURS         optional, defaults to 12
   ============================================================ */
'use strict';

var crypto = require('crypto');

var COOKIE = 'dl_admin';
var SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function configured() {
  return Boolean(process.env.ADMIN_PASSWORD_HASH && process.env.SESSION_SECRET);
}

function sessionHours() {
  var h = parseInt(process.env.SESSION_HOURS || '12', 10);
  return (isNaN(h) || h < 1) ? 12 : Math.min(h, 168);
}

/* ── password ────────────────────────────────────────────── */

function hashPassword(password, saltHex) {
  var salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  var key = crypto.scryptSync(String(password), salt, SCRYPT.keylen,
    { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return 'scrypt$' + salt.toString('hex') + '$' + key.toString('hex');
}

function verifyPassword(password) {
  var stored = process.env.ADMIN_PASSWORD_HASH || '';
  var parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  var candidate;
  try { candidate = hashPassword(password, parts[1]); }
  catch (e) { return false; }

  var a = Buffer.from(candidate);
  var b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* ── session token ───────────────────────────────────────── */

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payload) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || '')
    .update(payload).digest('hex');
}

function issue() {
  var exp = Date.now() + sessionHours() * 3600 * 1000;
  var payload = b64url(JSON.stringify({ exp: exp, v: 1 }));
  return payload + '.' + sign(payload);
}

function valid(token) {
  if (!token || typeof token !== 'string') return false;
  var bits = token.split('.');
  if (bits.length !== 2) return false;

  var expected = sign(bits[0]);
  var a = Buffer.from(bits[1]);
  var b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;

  try {
    var data = JSON.parse(Buffer.from(bits[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    return typeof data.exp === 'number' && Date.now() < data.exp;
  } catch (e) { return false; }
}

/* ── cookies ─────────────────────────────────────────────── */

function readCookie(header, name) {
  if (!header) return null;
  var parts = String(header).split(';');
  for (var i = 0; i < parts.length; i++) {
    var kv = parts[i].trim().split('=');
    if (kv[0] === name) return decodeURIComponent(kv.slice(1).join('='));
  }
  return null;
}

function cookieFor(token) {
  var bits = [
    COOKIE + '=' + token,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=' + (sessionHours() * 3600)
  ];
  /* Secure everywhere except plain-HTTP local development */
  if (process.env.ALLOW_INSECURE_COOKIE !== 'true') bits.push('Secure');
  return bits.join('; ');
}

function clearCookie() {
  return COOKIE + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
    + (process.env.ALLOW_INSECURE_COOKIE !== 'true' ? '; Secure' : '');
}

function authed(cookieHeader) {
  return valid(readCookie(cookieHeader, COOKIE));
}

/* ── brute-force damping ─────────────────────────────────────
   Serverless instances are short-lived so this is not a complete
   defence, but it removes the cheap high-rate attempt. Combine
   with a long password. */
var attempts = [];

function tooManyAttempts() {
  var now = Date.now();
  attempts = attempts.filter(function (t) { return now - t < 15 * 60 * 1000; });
  return attempts.length >= 10;
}

function recordFailure() { attempts.push(Date.now()); }
function clearFailures() { attempts = []; }

function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

module.exports = {
  COOKIE: COOKIE,
  configured: configured,
  hashPassword: hashPassword,
  verifyPassword: verifyPassword,
  issue: issue,
  valid: valid,
  authed: authed,
  readCookie: readCookie,
  cookieFor: cookieFor,
  clearCookie: clearCookie,
  tooManyAttempts: tooManyAttempts,
  recordFailure: recordFailure,
  clearFailures: clearFailures,
  delay: delay
};
