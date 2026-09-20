#!/usr/bin/env node
/* ============================================================
   Setup check — tells you what is wired up and what is not,
   without printing any secret.

       node scripts/check-setup.js
   ============================================================ */
'use strict';

var fs = require('fs');
var path = require('path');

var ENV_FILE = path.join(__dirname, '..', '.env');
var ENV_FOUND = fs.existsSync(ENV_FILE);

/* pick up .env the same way dev-server.js does */
(function () {
  var file = ENV_FILE;
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

/* ── remote mode: ask a deployment about itself ───────────── */
async function checkRemote(site) {
  var base = site.replace(/\/+$/, '');
  console.log('\nChecking ' + base + '\n');

  var res, text, data = null;
  try {
    res = await fetch(base + '/api/health', { headers: { Accept: 'application/json' } });
    text = await res.text();                 /* read as text first: a static
                                                host answers with an HTML 404,
                                                and .json() would throw before
                                                we could say anything useful */
    try { data = JSON.parse(text); } catch (e) { data = null; }
  } catch (e) {
    no('could not reach ' + base, e.message);
    note('is the site deployed and is the address right?');
    console.log('');
    process.exit(1);
  }

  if (!data || !data.checks) {
    var looksStatic = res.status === 404 || /^\s*</.test(text || '');
    if (looksStatic) {
      no('/api/health is not running', 'HTTP ' + res.status);
      note('the site is being served as plain static files');
      note('serverless functions are needed — GitHub Pages cannot run them');
      note('deploy to Netlify or Vercel, or run: node dev-server.js');
    } else {
      no('unexpected reply from /api/health', 'HTTP ' + res.status);
      note(String(text || '').slice(0, 120));
    }
    console.log('');
    process.exit(1);
  }

  var c = data.checks;
  console.log('Supabase');
  if (!c.supabase.configured) {
    no('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing on the host');
    note('add them in your host settings, then redeploy');
  } else {
    ok('keys are set on the host');
    if (c.supabase.table) ok('requests table reachable');
    else {
      no('cannot read the requests table');
      note(c.supabase.problem || 'run supabase/schema.sql in the Supabase SQL editor');
    }
  }

  console.log('\nCal.com');
  if (c.cal.configured) ok('CAL_API_KEY is set on the host');
  else { no('CAL_API_KEY missing on the host'); note('needed to confirm a booking when you mark it paid'); }

  console.log('\nAdmin dashboard');
  if (c.admin.configured) ok('ADMIN_PASSWORD_HASH and SESSION_SECRET are set');
  else { no('admin variables missing on the host'); note('node scripts/hash-password.js "your password"'); }

  console.log('\n' + (data.ready
    ? GREEN + 'Everything is connected.' + OFF + '  Open ' + base + '/admin\n'
    : RED + 'Not ready yet' + OFF + ' — fix the ✗ lines above and redeploy.\n'));

  process.exit(data.ready ? 0 : 1);
}

(async function main() {
  var site = process.argv[2];
  if (site) {
    if (!/^https?:\/\//.test(site)) site = 'https://' + site;
    return checkRemote(site);
  }

  console.log('\nChecking this machine\n');
  console.log(DIM + '  .env: ' + (ENV_FOUND ? ENV_FILE : 'none found at ' + ENV_FILE) + OFF);
  if (!ENV_FOUND) {
    console.log(DIM + '  Variables set in Netlify or Vercel do NOT appear here —' + OFF);
    console.log(DIM + '  to check a deployment run:  node scripts/check-setup.js your-site.com' + OFF);
  }
  console.log('');

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
