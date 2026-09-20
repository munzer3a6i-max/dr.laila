/* POST /api/request — public: hold the slot and record the request (Vercel) */
'use strict';
var cal = require('../lib/cal.js');
var api = require('../lib/api.js');

module.exports = async function handler(req, res) {
  var h = cal.corsHeaders();
  Object.keys(h).forEach(function (k) { res.setHeader(k, h[k]); });

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({
      ok: false,
      message: 'This endpoint accepts POST only — you are seeing this because a browser sent a GET.',
      hint: 'The booking form is on the home page. To check the deployment, open /api/health.',
      healthy: true
    });

  var body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  var out = await api.createRequest(body || {});
  return res.status(out.status).json(out.body);
};
