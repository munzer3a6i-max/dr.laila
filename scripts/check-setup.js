#!/usr/bin/env node
/* ============================================================
   Setup check — tells you what is wired up and what is not,
   without printing any secret.

       node scripts/check-setup.js
   ============================================================ */
'use strict';

var fs = require('fs');
var path = require('path');

/* pick up .env the same way dev-server.js does */
(function () {
  var file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(function (line) {
    var t = line.trim();
    if (!t || t.charAt(0) === '#') return;
    var eq = t.indexOf('=');
    if (eq < 1) return;
    var k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
    if (v.length > 1 && ((v[0] === '"' && v.slice(-1) === '"') || (v[0] === "'" && v.slice(-1) === "'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  });
})();

var GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', YEL = '\x1b[33m', OFF = '\x1b[0m';
var pass = 0, fail = 0;

function ok(label, detail) { pass++; console.log('  ' + GREEN + '✓' + OFF + ' ' + label + (detail ? DIM + '  ' + detail + OFF : '')); }
function no(label, detail) { fail++; console.log('  ' + RED + '✗' + OFF + ' ' + label + (detail ? DIM + '  ' + detail + OFF : '')); }
function note(text) { console.log('    ' + YEL + '→ ' + text + OFF); }

/** Never print a secret — only whether it is there and roughly right. */
function shape(v, n) { return v ? v.slice(0, n) + '…(' + v.length + ' chars)' : ''; }

(async function main() {
  console.log('\nChecking setup\n');

  /* ── Supabase ─────────────────────────────────────────── */
  console.log('Supabase');
  var url = process.env.SUPABASE_URL || '';
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url) { no('SUPABASE_URL not set'); }
  else if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url.trim())) {
    no('SUPABASE_URL looks wrong', url);
    note('expected https://<project-ref>.supabase.co with no trailing path');
  } else ok('SUPABASE_URL', url);

  if (!key) no('SUPABASE_SERVICE_ROLE_KEY not set');
  else if (key.split('.').length !== 3 && key.indexOf('sb_') !== 0) {
    no('SUPABASE_SERVICE_ROLE_KEY does not look like a key', shape(key, 6));
  } else ok('SUPABASE_SERVICE_ROLE_KEY present', shape(key, 6));

  if (url && key) {
    try {
      var r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/requests?select=id&limit=1', {
        headers: { apikey: key, Authorization: 'Bearer ' + key }
      });
      if (r.ok) ok('reached the requests table');
      else if (r.status === 401 || r.status === 403) {
        no('Supabase rejected the key (' + r.status + ')');
        note('make sure this is the service_role key, not anon');
      } else if (r.status === 404) {
        no('table "requests" not found');
        note('run supabase/schema.sql in the Supabase SQL editor');
      } else no('Supabase returned ' + r.status);
    } catch (e) { no('could not reach Supabase', e.message); }
  }

  /* ── Cal.com ──────────────────────────────────────────── */
  console.log('\nCal.com');
  var cal = process.env.CAL_API_KEY || '';
  if (!cal) {
    no('CAL_API_KEY not set');
    note('required to confirm bookings when you mark a request paid');
  } else ok('CAL_API_KEY present', shape(cal, 9));
  ok('CAL_TIMEZONE', process.env.CAL_TIMEZONE || 'Asia/Riyadh (default)');

  var cfg = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'booking.js'), 'utf8');
  var slugs = (cfg.match(/calEventSlug:\s*'([^']+)'/g) || []).length;
  var ids = (cfg.match(/calEventTypeId:\s*(\d+)/g) || []).length;
  if (slugs + ids === 0) {
    no('no session type is linked to a Cal.com event type');
    note('set calEventSlug or calEventTypeId in assets/js/booking.js');
  } else if (slugs + ids < 4) {
    no((slugs + ids) + ' of 4 session types linked');
    note('unlinked ones show as unavailable, which is safe but incomplete');
  } else ok('all 4 session types linked');

  /* ── Admin ────────────────────────────────────────────── */
  console.log('\nAdmin dashboard');
  var hash = process.env.ADMIN_PASSWORD_HASH || '';
  var secret = process.env.SESSION_SECRET || '';

  if (!hash) {
    no('ADMIN_PASSWORD_HASH not set');
    note('node scripts/hash-password.js "your password"');
  } else if (!/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(hash)) {
    no('ADMIN_PASSWORD_HASH is malformed');
    note('it must be the whole scrypt$…$… line, quoted if your shell needs it');
  } else ok('ADMIN_PASSWORD_HASH looks right');

  if (!secret) no('SESSION_SECRET not set');
  else if (secret.length < 32) { no('SESSION_SECRET is too short', secret.length + ' chars'); note('use at least 32'); }
  else ok('SESSION_SECRET', secret.length + ' chars');

  if (process.env.ALLOW_INSECURE_COOKIE === 'true') {
    console.log('  ' + YEL + '!' + OFF + ' ALLOW_INSECURE_COOKIE is on' + DIM + '  fine locally, never in production' + OFF);
  }

  console.log('\n' + (fail === 0
    ? GREEN + 'All ' + pass + ' checks passed.' + OFF + ' Run: node dev-server.js\n'
    : RED + fail + ' problem' + (fail > 1 ? 's' : '') + OFF + ' (' + pass + ' fine). Fix the ✗ lines above.\n'));

  process.exit(fail === 0 ? 0 : 1);
})();
