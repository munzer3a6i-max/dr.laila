#!/usr/bin/env node
/* Turns a password into the scrypt hash for ADMIN_PASSWORD_HASH.
   Usage:  node scripts/hash-password.js "your password here"        */
'use strict';
var auth = require('../lib/auth.js');
var crypto = require('crypto');

var pw = process.argv.slice(2).join(' ');
if (!pw) {
  console.error('Usage: node scripts/hash-password.js "your password"');
  process.exit(1);
}
if (pw.length < 12) {
  console.error('Refusing: use at least 12 characters. This is the only lock on the dashboard.');
  process.exit(1);
}

console.log('\nAdd these to your hosting environment variables:\n');
console.log('ADMIN_PASSWORD_HASH=' + auth.hashPassword(pw));
console.log('SESSION_SECRET=' + crypto.randomBytes(32).toString('hex'));
console.log('\nKeep them secret and out of git.\n');
