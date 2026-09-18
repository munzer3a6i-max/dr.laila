/* POST /api/book  →  /.netlify/functions/book  (see netlify.toml) */
'use strict';
var cal = require('../../lib/cal.js');

exports.handler = async function (event) {
  var headers = cal.corsHeaders();
  headers['Content-Type'] = 'application/json';

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, message: 'Method not allowed' }) };
  }

  if (!cal.configured()) {
    return { statusCode: 503, headers, body: JSON.stringify({ ok: false, code: 'NOT_CONFIGURED', message: 'CAL_API_KEY is not set' }) };
  }

  var body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }

  var result = await cal.createBooking(body);
  return { statusCode: result.ok ? 201 : (result.status || 500), headers, body: JSON.stringify(result) };
};
