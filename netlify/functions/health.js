/* GET /api/health  →  /.netlify/functions/health */
'use strict';
var api = require('../../lib/api.js');

exports.handler = async function (event) {
  var headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, message: 'Method not allowed' }) };
  }
  var out = await api.health();
  return { statusCode: out.status, headers, body: JSON.stringify(out.body) };
};
