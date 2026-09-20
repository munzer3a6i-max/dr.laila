/* ============================================================
   Supabase access (server-side only)
   ------------------------------------------------------------
   Talks to PostgREST and Storage over plain fetch — no SDK, so
   the project stays dependency-free.

   Uses the SERVICE ROLE key, which bypasses Row Level Security.
   It must never reach the browser. Everything here runs inside
   the serverless functions.

   Env:
     SUPABASE_URL              https://<ref>.supabase.co
     SUPABASE_SERVICE_ROLE_KEY the service_role secret
   ============================================================ */
'use strict';

var BUCKET = 'receipts';

function base() {
  return (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
}

function configured() {
  return Boolean(base() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function headers(extra) {
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  var h = { apikey: key, Authorization: 'Bearer ' + key };
  Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
  return h;
}

async function rest(path, options) {
  var opts = options || {};
  var res = await fetch(base() + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers: headers(opts.headers),
    body: opts.body
  });

  var text = await res.text();
  var data = null;
  if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }

  if (!res.ok) {
    var msg = (data && (data.message || data.hint || data.error)) || ('Supabase returned ' + res.status);
    return { ok: false, status: res.status, message: msg };
  }
  return { ok: true, data: data };
}

/* ── requests table ──────────────────────────────────────── */

/** Columns a public visitor is allowed to set. Anything else — status,
    cal_booking_uid, receipt_path — is decided by the server. */
var PUBLIC_FIELDS = [
  'service', 'session_type', 'session_label', 'price', 'duration_minutes',
  'starts_at', 'time_zone', 'name', 'email', 'whatsapp', 'child', 'reason', 'language'
];

function pickPublic(input) {
  var row = {};
  PUBLIC_FIELDS.forEach(function (k) {
    if (input[k] !== undefined && input[k] !== null && input[k] !== '') row[k] = input[k];
  });
  return row;
}

async function createRequest(input) {
  var row = pickPublic(input);
  if (input.cal_booking_uid) row.cal_booking_uid = input.cal_booking_uid;

  var out = await rest('requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  if (!out.ok) return out;
  return { ok: true, row: Array.isArray(out.data) ? out.data[0] : out.data };
}

async function listRequests(opts) {
  var o = opts || {};
  var q = 'requests?select=*&order=created_at.desc&limit=' + (o.limit || 200);
  if (o.status && o.status !== 'all') q += '&status=eq.' + encodeURIComponent(o.status);

  var out = await rest(q);
  if (!out.ok) return out;
  return { ok: true, rows: out.data || [] };
}

async function getRequest(id) {
  var out = await rest('requests?select=*&id=eq.' + encodeURIComponent(id));
  if (!out.ok) return out;
  var row = (out.data || [])[0];
  if (!row) return { ok: false, status: 404, message: 'Request not found' };
  return { ok: true, row: row };
}

/** Only these may be changed from the dashboard. */
var UPDATABLE = ['status', 'admin_note', 'receipt_path', 'paid_at', 'cal_booking_uid'];

async function updateRequest(id, patch) {
  var body = {};
  UPDATABLE.forEach(function (k) { if (patch[k] !== undefined) body[k] = patch[k]; });
  if (!Object.keys(body).length) return { ok: false, status: 400, message: 'Nothing to update' };

  var out = await rest('requests?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body)
  });
  if (!out.ok) return out;
  var row = Array.isArray(out.data) ? out.data[0] : out.data;
  if (!row) return { ok: false, status: 404, message: 'Request not found' };
  return { ok: true, row: row };
}

/* ── storage: payment screenshots ────────────────────────── */

var ALLOWED = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf'
};
var MAX_BYTES = 5 * 1024 * 1024;

async function uploadReceipt(id, contentType, buffer) {
  var ext = ALLOWED[contentType];
  if (!ext) return { ok: false, status: 415, message: 'Only PNG, JPEG, WebP or PDF are accepted' };
  if (!buffer || !buffer.length) return { ok: false, status: 400, message: 'Empty file' };
  if (buffer.length > MAX_BYTES) return { ok: false, status: 413, message: 'File is larger than 5 MB' };

  var path = id + '/receipt-' + Date.now() + '.' + ext;
  var res = await fetch(base() + '/storage/v1/object/' + BUCKET + '/' + path, {
    method: 'POST',
    headers: headers({ 'Content-Type': contentType, 'x-upsert': 'true' }),
    body: buffer
  });

  if (!res.ok) {
    var t = await res.text();
    return { ok: false, status: res.status, message: 'Upload failed: ' + t.slice(0, 200) };
  }
  return { ok: true, path: path };
}

/** Screenshots are private; hand out a short-lived signed link instead. */
async function signReceipt(path, seconds) {
  var res = await fetch(base() + '/storage/v1/object/sign/' + BUCKET + '/' + path, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn: seconds || 300 })
  });
  if (!res.ok) {
    var t = await res.text();
    return { ok: false, status: res.status, message: 'Could not sign: ' + t.slice(0, 200) };
  }
  var json = await res.json();
  var signed = json.signedURL || json.signedUrl || '';
  return { ok: true, url: base() + '/storage/v1' + signed };
}

async function removeReceipt(path) {
  var res = await fetch(base() + '/storage/v1/object/' + BUCKET + '/' + path, {
    method: 'DELETE', headers: headers()
  });
  return { ok: res.ok };
}

module.exports = {
  configured: configured,
  createRequest: createRequest,
  listRequests: listRequests,
  getRequest: getRequest,
  updateRequest: updateRequest,
  uploadReceipt: uploadReceipt,
  signReceipt: signReceipt,
  removeReceipt: removeReceipt,
  ALLOWED_TYPES: ALLOWED,
  MAX_BYTES: MAX_BYTES
};
