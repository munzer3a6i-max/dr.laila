/* GET /api/health — is this deployment wired up? Booleans only. (Vercel) */
'use strict';
var api = require('../lib/api.js');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Method not allowed' });
  var out = await api.health();
  return res.status(out.status).json(out.body);
};
