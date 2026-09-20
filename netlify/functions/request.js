/* POST /api/request  →  /.netlify/functions/request */
'use strict';
var cal = require('../../lib/cal.js');
var api = require('../../lib/api.js');

exports.handler = async function (event) {
  var headers = cal.corsHeaders();
  headers['Content-Type'] = 'application/json';

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, message: 'Method not allowed' }) };
  }

  var body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }

  var out = await api.createRequest(body);
  return { statusCode: out.status, headers, body: JSON.stringify(out.body) };
};
