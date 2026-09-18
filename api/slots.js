/* GET /api/slots?eventTypeId=123&start=2026-09-01&end=2026-09-30  (Vercel) */
'use strict';
var cal = require('../lib/cal.js');

module.exports = async function handler(req, res) {
  var h = cal.corsHeaders();
  Object.keys(h).forEach(function (k) { res.setHeader(k, h[k]); });

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Method not allowed' });

  var q = req.query || {};

  if (!cal.configured(q)) {
    return res.status(503).json({ ok: false, code: 'NOT_CONFIGURED', message: 'No Cal.com event type configured' });
  }
  var result = await cal.getSlots({
    eventTypeId: q.eventTypeId,
    eventTypeSlug: q.eventTypeSlug,
    username: q.username,
    start: q.start,
    end: q.end,
    timeZone: q.timeZone
  });

  if (!result.ok) return res.status(result.status || 500).json(result);

  /* short cache: availability moves, but not second to second */
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
  return res.status(200).json(result);
};
