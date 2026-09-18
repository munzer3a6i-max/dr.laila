/* POST /api/book  (Vercel) */
'use strict';
var cal = require('../lib/cal.js');

module.exports = async function handler(req, res) {
  var h = cal.corsHeaders();
  Object.keys(h).forEach(function (k) { res.setHeader(k, h[k]); });

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed' });

  if (!cal.configured()) {
    return res.status(503).json({ ok: false, code: 'NOT_CONFIGURED', message: 'CAL_API_KEY is not set' });
  }

  var body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  var result = await cal.createBooking(body || {});
  if (!result.ok) return res.status(result.status || 500).json(result);
  return res.status(201).json(result);
};
