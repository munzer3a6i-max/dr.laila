/* POST /api/admin — dashboard actions, session-guarded (Vercel) */
'use strict';
var api = require('../lib/api.js');

module.exports = async function handler(req, res) {
  /* Never cross-origin: the dashboard is served from this same site. */
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed' });

  var body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  var out = await api.admin(String(body.action || ''), body, req.headers.cookie || '');
  if (out.headers) Object.keys(out.headers).forEach(function (k) { res.setHeader(k, out.headers[k]); });
  return res.status(out.status).json(out.body);
};
