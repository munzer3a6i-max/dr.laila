/* ============================================================
   Cal.com API client (server-side only)
   ------------------------------------------------------------
   Lives on the server because CAL_API_KEY must never be shipped
   to the browser. Used by both the Vercel handlers in /api and
   the Netlify functions in /netlify/functions.

   Env vars:
     CAL_API_KEY    required — Cal.com API key (cal_live_…)
     CAL_TIMEZONE   optional — defaults to Asia/Riyadh
     SITE_ORIGIN    optional — lock CORS to your domain
   ============================================================ */
'use strict';

/* Override for a self-hosted Cal.com instance, or to point the tests at
   a mock. Defaults to Cal.com's hosted API. */
var BASE = process.env.CAL_API_BASE || 'https://api.cal.com/v2';

/* Cal.com pins behaviour per endpoint with a date-stamped version header. */
var V_SLOTS = '2024-09-04';
var V_BOOKINGS = '2024-08-13';
var V_EVENT_TYPES = '2024-06-14';

function timeZone() {
  return process.env.CAL_TIMEZONE || 'Asia/Riyadh';
}

function authHeaders(version) {
  var h = {
    'Content-Type': 'application/json',
    'cal-api-version': version
  };
  if (process.env.CAL_API_KEY) {
    h.Authorization = 'Bearer ' + process.env.CAL_API_KEY;
  }
  return h;
}

/**
 * Cal.com has shipped more than one shape for the slots payload.
 * Accept all of them and return a flat, sorted list of ISO start times.
 */
function normaliseSlots(json) {
  var data = json && json.data ? json.data : json;
  if (!data) return [];

  /* { slots: { "2026-09-20": [...] } } */
  if (data.slots && typeof data.slots === 'object') data = data.slots;

  var out = [];

  var push = function (entry) {
    if (!entry) return;
    if (typeof entry === 'string') { out.push(entry); return; }
    if (entry.start) out.push(entry.start);
    else if (entry.time) out.push(entry.time);
  };

  if (Array.isArray(data)) {
    data.forEach(push);
  } else if (typeof data === 'object') {
    /* { "2026-09-20": [ {start}, … ] } */
    Object.keys(data).forEach(function (dateKey) {
      var list = data[dateKey];
      if (Array.isArray(list)) list.forEach(push);
    });
  }

  /* de-duplicate and sort chronologically */
  var seen = Object.create(null);
  return out
    .filter(function (iso) {
      if (!iso || seen[iso]) return false;
      seen[iso] = true;
      return true;
    })
    .sort();
}

/**
 * Available slots for one event type across a date range.
 * @returns {Promise<{ok:boolean, slots?:string[], status?:number, message?:string}>}
 */
/**
 * An event type can be named either by its numeric id, or by the
 * username + slug pair that appears in its public booking link
 * (cal.com/<username>/<slug>). The slug form saves the owner from
 * digging the numeric ids out of the dashboard.
 */
function eventRef(opts) {
  if (opts.eventTypeId) return { query: 'eventTypeId=' + encodeURIComponent(opts.eventTypeId) };
  if (opts.username && opts.eventTypeSlug) {
    return {
      query: 'eventTypeSlug=' + encodeURIComponent(opts.eventTypeSlug)
           + '&username=' + encodeURIComponent(opts.username)
    };
  }
  return null;
}

/**
 * How long Cal.com actually books this event type for.
 *
 * The site quotes a duration and a price next to each session type, but
 * nothing it sends to Cal.com carries a length — the event type's own
 * setting decides both the spacing of the offered slots and how much of
 * the calendar a booking consumes. If the two disagree, the site sells a
 * 50-minute session and the calendar reserves whatever it was set to, so
 * the next visitor is offered a slot inside it. Read the real number
 * rather than trusting the table.
 *
 * @returns {Promise<{ok:boolean, lengthInMinutes?:number, title?:string,
 *                    status?:number, message?:string}>}
 */
var typeCache = Object.create(null);
var TYPE_TTL = 10 * 60 * 1000;   /* an event type's length changes rarely */

async function getEventType(opts) {
  var cacheKey = opts.eventTypeId
    ? 'id:' + opts.eventTypeId
    : 'slug:' + opts.username + '/' + opts.eventTypeSlug;
  var hit = typeCache[cacheKey];
  if (hit && Date.now() - hit.at < TYPE_TTL) return hit.value;

  var url;
  if (opts.eventTypeId) {
    url = BASE + '/event-types/' + encodeURIComponent(opts.eventTypeId);
  } else if (opts.username && opts.eventTypeSlug) {
    url = BASE + '/event-types'
        + '?username=' + encodeURIComponent(opts.username)
        + '&eventSlug=' + encodeURIComponent(opts.eventTypeSlug);
  } else {
    return { ok: false, status: 400, message: 'eventTypeId, or username + eventTypeSlug, is required' };
  }

  var res, json;
  try {
    res = await fetch(url, { method: 'GET', headers: authHeaders(V_EVENT_TYPES) });
    json = await res.json();
  } catch (err) {
    return { ok: false, status: 502, message: 'Could not reach Cal.com: ' + err.message };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: (json && (json.error && json.error.message || json.message)) || 'Cal.com returned ' + res.status
    };
  }

  /* The payload is {data: {...}} for a lookup by id and {data: [{...}]}
     for a lookup by slug; older builds answered with the bare object. */
  var data = json && json.data !== undefined ? json.data : json;
  if (Array.isArray(data)) data = data[0];
  if (!data) return { ok: false, status: 404, message: 'Event type not found' };

  var length = data.lengthInMinutes;
  if (typeof length !== 'number') length = data.length;              /* v1 spelling */
  if (typeof length !== 'number') length = data.duration;

  var value = {
    ok: true,
    lengthInMinutes: typeof length === 'number' ? length : null,
    title: data.title || data.slug || null,
    slug: data.slug || null
  };
  typeCache[cacheKey] = { at: Date.now(), value: value };
  return value;
}

async function getSlots(opts) {
  var start = opts.start;                 /* YYYY-MM-DD */
  var end = opts.end;                     /* YYYY-MM-DD */

  var ref = eventRef(opts);
  if (!ref) return { ok: false, status: 400, message: 'eventTypeId, or username + eventTypeSlug, is required' };
  if (!start || !end) return { ok: false, status: 400, message: 'start and end are required' };

  var url = BASE + '/slots'
    + '?' + ref.query
    + '&start=' + encodeURIComponent(start)
    + '&end=' + encodeURIComponent(end)
    + '&timeZone=' + encodeURIComponent(opts.timeZone || timeZone());

  var res, json;
  try {
    res = await fetch(url, { method: 'GET', headers: authHeaders(V_SLOTS) });
    json = await res.json();
  } catch (err) {
    return { ok: false, status: 502, message: 'Could not reach Cal.com: ' + err.message };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: (json && (json.error && json.error.message || json.message)) || 'Cal.com returned ' + res.status
    };
  }

  return { ok: true, slots: normaliseSlots(json), timeZone: opts.timeZone || timeZone() };
}

/**
 * Create a booking. Cal.com writes it to whichever calendars the
 * event type is connected to, which is what puts it on your calendar.
 */
async function createBooking(opts) {
  var hasRef = opts.eventTypeId || (opts.username && opts.eventTypeSlug);
  if (!hasRef) return { ok: false, status: 400, message: 'eventTypeId, or username + eventTypeSlug, is required' };
  if (!opts.start) return { ok: false, status: 400, message: 'start is required' };
  if (!opts.name || !opts.email) return { ok: false, status: 400, message: 'name and email are required' };

  var body = {
    start: opts.start,
    attendee: {
      name: opts.name,
      email: opts.email,
      timeZone: opts.timeZone || timeZone(),
      language: opts.language === 'en' ? 'en' : 'ar'
    },
    metadata: opts.metadata || {}
  };

  if (opts.eventTypeId) {
    body.eventTypeId = Number(opts.eventTypeId);
  } else {
    body.eventTypeSlug = opts.eventTypeSlug;
    body.username = opts.username;
  }

  /* Only pin a duration when the caller explicitly asks for one. Sending a
     length the event type does not offer is rejected with a 400. */
  if (opts.lengthInMinutes) body.lengthInMinutes = Number(opts.lengthInMinutes);

  /* Free-text context goes into the booking's own fields so it shows up
     on the calendar event rather than being silently dropped. */
  var notes = [];
  if (opts.child) notes.push('Child: ' + opts.child);
  if (opts.service) notes.push('Service: ' + opts.service);
  if (opts.reason) notes.push('Reason: ' + opts.reason);
  if (notes.length) {
    body.bookingFieldsResponses = { notes: notes.join('\n') };
  }

  var res, json;
  try {
    res = await fetch(BASE + '/bookings', {
      method: 'POST',
      headers: authHeaders(V_BOOKINGS),
      body: JSON.stringify(body)
    });
    json = await res.json();
  } catch (err) {
    return { ok: false, status: 502, message: 'Could not reach Cal.com: ' + err.message };
  }

  if (!res.ok) {
    var msg = (json && (json.error && json.error.message || json.message)) || 'Cal.com returned ' + res.status;
    /* 400/409 here almost always means the slot went while they were typing */
    return { ok: false, status: res.status, message: msg, conflict: res.status === 400 || res.status === 409 };
  }

  /* Cal.com has answered with the booking at the top level, under data,
     and under data.booking across versions. Losing the uid here is not a
     cosmetic failure — it is the only handle we have for confirming or
     cancelling later, so look in all three places. */
  var booking = (json && json.data) || json || {};
  if (booking.booking && (booking.booking.uid || booking.booking.id)) booking = booking.booking;

  return {
    ok: true,
    uid: booking.uid || booking.id || null,
    start: booking.start || opts.start,
    meetingUrl: booking.meetingUrl || booking.videoCallUrl || null,
    /* "pending" means the event type requires confirmation and the slot is
       merely held. "accepted" means Cal.com confirmed it immediately and has
       already emailed the attendee — which defeats pay-before-confirm. */
    status: booking.status || null
  };
}

/** Read a booking back, so we can act on its real state rather than guess. */
async function getBooking(uid) {
  if (!uid) return { ok: false, status: 400, message: 'booking uid is required' };

  var res, json;
  try {
    res = await fetch(BASE + '/bookings/' + encodeURIComponent(uid), {
      method: 'GET',
      headers: authHeaders(V_BOOKINGS)
    });
    json = await res.json();
  } catch (err) {
    return { ok: false, status: 502, message: 'Could not reach Cal.com: ' + err.message };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: (json && (json.error && json.error.message || json.message)) || 'Cal.com returned ' + res.status
    };
  }

  var data = (json && json.data) || {};
  return { ok: true, status_: data.status || null, booking: data };
}

/**
 * Confirm a booking that is sitting in PENDING.
 * Requires the event type to have "Requires confirmation" switched on,
 * and — unlike reading slots — always needs the API key.
 */
async function confirmBooking(uid) {
  if (!uid) return { ok: false, status: 400, message: 'booking uid is required' };
  if (!process.env.CAL_API_KEY) {
    return { ok: false, status: 503, code: 'CAL_NOT_CONFIGURED',
             message: 'CAL_API_KEY is not set on the server' };
  }

  var res, json;
  try {
    res = await fetch(BASE + '/bookings/' + encodeURIComponent(uid) + '/confirm', {
      method: 'POST',
      headers: authHeaders(V_BOOKINGS),
      body: '{}'
    });
    json = await res.json();
  } catch (err) {
    return { ok: false, status: 502, message: 'Could not reach Cal.com: ' + err.message };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: (json && (json.error && json.error.message || json.message)) || 'Cal.com returned ' + res.status
    };
  }
  return { ok: true, booking: (json && json.data) || null };
}

/** Cancel a booking — used when a request is marked cancelled, so the slot frees up. */
async function cancelBooking(uid, reason) {
  if (!uid) return { ok: false, status: 400, message: 'booking uid is required' };
  if (!process.env.CAL_API_KEY) {
    return { ok: false, status: 503, code: 'CAL_NOT_CONFIGURED',
             message: 'CAL_API_KEY is not set on the server' };
  }

  var res, json;
  try {
    res = await fetch(BASE + '/bookings/' + encodeURIComponent(uid) + '/cancel', {
      method: 'POST',
      headers: authHeaders(V_BOOKINGS),
      body: JSON.stringify({ cancellationReason: reason || 'Cancelled by the practice' })
    });
    json = await res.json();
  } catch (err) {
    return { ok: false, status: 502, message: 'Could not reach Cal.com: ' + err.message };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: (json && (json.error && json.error.message || json.message)) || 'Cal.com returned ' + res.status
    };
  }
  return { ok: true };
}

/** Shared CORS/// preflight handling for both hosts. */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.SITE_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

/** True once the request names an event type; the API key is optional
    because public event types can be read and booked without one. */
function configured(params) {
  if (!params) return Boolean(process.env.CAL_API_KEY);
  return Boolean(params.eventTypeId || (params.username && params.eventTypeSlug));
}

module.exports = {
  getSlots: getSlots,
  getEventType: getEventType,
  getBooking: getBooking,
  confirmBooking: confirmBooking,
  cancelBooking: cancelBooking,
  eventRef: eventRef,
  createBooking: createBooking,
  normaliseSlots: normaliseSlots,
  corsHeaders: corsHeaders,
  configured: configured,
  timeZone: timeZone
};
