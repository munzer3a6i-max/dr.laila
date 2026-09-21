/* GET /api/slots  →  /.netlify/functions/slots  (see netlify.toml) */
'use strict';
var cal = require('../../lib/cal.js');
var db = require('../../lib/db.js');


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

exports.handler = async function (event) {
  var headers = cal.corsHeaders();
  headers['Content-Type'] = 'application/json';

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, message: 'Method not allowed' }) };
  }

  var q = event.queryStringParameters || {};

  if (!cal.configured(q)) {
    return { statusCode: 503, headers, body: JSON.stringify({ ok: false, code: 'NOT_CONFIGURED', message: 'No Cal.com event type configured' }) };
  }
  var result = await cal.getSlots({
    eventTypeId: q.eventTypeId,
    eventTypeSlug: q.eventTypeSlug,
    username: q.username,
    start: q.start,
    end: q.end,
    timeZone: q.timeZone
  });

  /* Report the length Cal.com will actually reserve — see api/slots.js. */
  if (result.ok) {
    var type = await cal.getEventType({
      eventTypeId: q.eventTypeId,
      eventTypeSlug: q.eventTypeSlug,
      username: q.username
    });
    if (type.ok && type.lengthInMinutes) result.lengthInMinutes = type.lengthInMinutes;
    result = await withoutHeldSlots(result, q);
    headers['Cache-Control'] = 'public, max-age=30';
  }
  return { statusCode: result.ok ? 200 : (result.status || 500), headers, body: JSON.stringify(result) };
};
