/* POST /api/admin  →  /.netlify/functions/admin */
'use strict';
var api = require('../../lib/api.js');

exports.handler = async function (event) {
  var headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false,
      message: 'This endpoint accepts POST only — you are seeing this because a browser sent a GET.',
      hint: 'The dashboard is at /admin. To check the deployment, open /api/health.', healthy: true }) };
  }

  var body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }

  var cookie = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  var out = await api.admin(String(body.action || ''), body, cookie);

  if (out.headers) Object.keys(out.headers).forEach(function (k) { headers[k] = out.headers[k]; });
  return { statusCode: out.status, headers, body: JSON.stringify(out.body) };
};
