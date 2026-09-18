/* GET /api/slots  →  /.netlify/functions/slots  (see netlify.toml) */
'use strict';
var cal = require('../../lib/cal.js');

exports.handler = async function (event) {
  var headers = cal.corsHeaders();
  headers['Content-Type'] = 'application/json';

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, message: 'Method not allowed' }) };
  }

  if (!cal.configured()) {
    return { statusCode: 503, headers, body: JSON.stringify({ ok: false, code: 'NOT_CONFIGURED', message: 'CAL_API_KEY is not set' }) };
  }

  var q = event.queryStringParameters || {};
  var result = await cal.getSlots({
    eventTypeId: q.eventTypeId,
    start: q.start,
    end: q.end,
    timeZone: q.timeZone
  });

  if (result.ok) headers['Cache-Control'] = 'public, max-age=30';
  return { statusCode: result.ok ? 200 : (result.status || 500), headers, body: JSON.stringify(result) };
};
