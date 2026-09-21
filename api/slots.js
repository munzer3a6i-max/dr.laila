/* GET /api/slots?eventTypeId=123&start=2026-09-01&end=2026-09-30  (Vercel) */
'use strict';
var cal = require('../lib/cal.js');
var db = require('../lib/db.js');


/* ── the site's own holds ──────────────────────────────────
   Explained in lib/db.js: an unconfirmed Cal.com booking does not take
   its time off the calendar, and every request here is unconfirmed until
   the admin marks it paid. So the requests table is the real record of
   what is taken, and the offered slots are filtered through it. A
   database that is unreachable or unconfigured leaves the list alone —
   better to show a slot twice than to show none at all. */
async function withoutHeldSlots(result, q) {
  if (!result.ok || !result.slots || !result.slots.length) return result;
  if (!db.configured()) return result;

  var minutes = Number(result.lengthInMinutes) || Number(q.minutes) || 50;
  var held = await db.heldRanges(result.slots[0], result.slots[result.slots.length - 1]);
  if (!held.ok || !held.ranges.length) return result;

  result.slots = result.slots.filter(function (iso) {
    var start = new Date(iso).getTime();
    var end = start + minutes * 60000;
    return !held.ranges.some(function (r) { return r.start < end && r.end > start; });
  });
  return result;
}

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

  /* Report the length Cal.com will actually reserve, so the page can quote
     that instead of the figure hardcoded beside each session type. A failed
     lookup is not fatal — the page falls back to its own number. */
  var type = await cal.getEventType({
    eventTypeId: q.eventTypeId,
    eventTypeSlug: q.eventTypeSlug,
    username: q.username
  });
  if (type.ok && type.lengthInMinutes) result.lengthInMinutes = type.lengthInMinutes;

  /* Drop the times this site has already promised to someone. Cal.com
     leaves an unconfirmed booking on the calendar as bookable, so these
     would otherwise be offered twice. */
  result = await withoutHeldSlots(result, q);

  /* short cache: availability moves, but not second to second */
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
  return res.status(200).json(result);
};
