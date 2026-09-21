/* ============================================================
   Request + admin logic, shared by both hosting adapters.
   Each function takes plain data and returns
   { status, body, headers? } — no framework in sight.
   ============================================================ */
'use strict';

var cal = require('./cal.js');
var db = require('./db.js');
var auth = require('./auth.js');

var STATUSES = ['pending', 'contacted', 'paid', 'cancelled'];

function fail(status, message, code, extra) {
  var body = { ok: false, message: message, code: code };
  Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
  return { status: status, body: body };
}

function str(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max || 500);
}

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Saudi-friendly normalisation: 05xxxxxxxx → +9665xxxxxxxx. */
function normalisePhone(raw) {
  var digits = String(raw || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.indexOf('+') === 0) return digits;
  if (digits.indexOf('00') === 0) return '+' + digits.slice(2);
  if (digits.indexOf('05') === 0 && digits.length === 10) return '+966' + digits.slice(1);
  if (digits.indexOf('5') === 0 && digits.length === 9) return '+966' + digits;
  if (digits.indexOf('966') === 0) return '+' + digits;
  return digits;
}

function phoneLooksReal(p) {
  var d = p.replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15;
}

/* ══════════════════════════════════════════════════════════
   PUBLIC — create a booking request
   ══════════════════════════════════════════════════════════ */
async function createRequest(body) {
  var b = body || {};

  var name = str(b.name, 120);
  var email = str(b.email, 200);
  var whatsapp = normalisePhone(b.whatsapp);
  var start = str(b.start, 40);

  if (!name) return fail(400, 'Name is required');
  if (!EMAIL_RE.test(email)) return fail(400, 'A valid email address is required');
  if (!phoneLooksReal(whatsapp)) return fail(400, 'A valid WhatsApp number is required');
  if (!start) return fail(400, 'A time slot is required');

  var ref = {
    eventTypeId: b.eventTypeId,
    eventTypeSlug: b.eventTypeSlug,
    username: b.username
  };
  if (!cal.configured(ref)) return fail(503, 'No Cal.com event type configured', 'NOT_CONFIGURED');
  if (!db.configured()) {
    return fail(503, 'Supabase is not configured on the server', 'NOT_CONFIGURED', { missing: db.missing() });
  }

  /* 1. The site's own hold decides whether this time is free.
        An event type that requires confirmation leaves every booking
        unconfirmed until the admin marks it paid, and an unconfirmed
        booking does not take its time off Cal.com's calendar — so without
        this check two people can hold the same hour. */
  var minutes = Number(b.minutes) || 50;
  var clash = await db.findClash(start, minutes);
  if (!clash.ok) return fail(clash.status || 502, clash.message, 'DB_ERROR');
  if (clash.clash) {
    return fail(409, 'That time has just been taken. Please pick another.',
                'SLOT_TAKEN', { conflict: true });
  }

  /* 2. Put it on Cal.com. */
  var booking = await cal.createBooking({
    eventTypeId: ref.eventTypeId,
    eventTypeSlug: ref.eventTypeSlug,
    username: ref.username,
    start: start,
    name: name,
    email: email,
    timeZone: str(b.timeZone, 60) || cal.timeZone(),
    language: b.language === 'en' ? 'en' : 'ar',
    child: str(b.child, 200),
    service: str(b.service, 200),
    reason: str(b.reason, 1000),
    metadata: { whatsapp: whatsapp, sessionType: str(b.sessionType, 60) }
  });

  if (!booking.ok) {
    return {
      status: booking.status || 502,
      body: { ok: false, message: booking.message, conflict: booking.conflict === true }
    };
  }

  /* 3. Record it for the dashboard, which is also the hold above. */
  var saved = await db.createRequest({
    service: str(b.service, 200) || '—',
    session_type: str(b.sessionType, 60) || 'intro',
    session_label: str(b.sessionLabel, 200) || '—',
    price: Number(b.price) || 0,
    duration_minutes: minutes,
    starts_at: start,
    time_zone: str(b.timeZone, 60) || cal.timeZone(),
    name: name,
    email: email,
    whatsapp: whatsapp,
    child: str(b.child, 200),
    reason: str(b.reason, 1000),
    language: b.language === 'en' ? 'en' : 'ar',
    cal_booking_uid: booking.uid,
    cal_status: booking.status || null
  });

  /* If the record cannot be written the admin would never see this
     request, so release the slot rather than leave it half-done. */
  if (!saved.ok) {
    if (booking.uid) await cal.cancelBooking(booking.uid, 'Could not record the request');
    return fail(saved.status || 500, saved.message || 'Could not save the request');
  }

  return { status: 201, body: { ok: true, id: saved.row.id, status: saved.row.status } };
}

/* ══════════════════════════════════════════════════════════
   ADMIN
   ══════════════════════════════════════════════════════════ */
async function admin(action, body, cookieHeader) {
  var b = body || {};

  if (!auth.configured()) {
    /* Name the variables so this is one glance to diagnose rather than a
       bare 503. Names only — the values never leave the server. */
    return fail(503,
      'Admin access is not configured on the server',
      'NOT_CONFIGURED',
      { missing: auth.missing() });
  }
  if (auth.hashMalformed()) {
    return fail(503,
      'ADMIN_PASSWORD_HASH is set but malformed',
      'BAD_HASH',
      { hint: 'It must be the whole scrypt$<32 hex>$<128 hex> line. A shell will eat the $ signs unless the value is single-quoted.' });
  }

  /* ── login / logout are the only unauthenticated actions ── */
  if (action === 'login') {
    if (auth.tooManyAttempts()) {
      await auth.delay(1000);
      return fail(429, 'Too many attempts. Wait a few minutes and try again.', 'RATE_LIMITED');
    }
    await auth.delay(350);                       /* damps rapid guessing */

    if (!auth.verifyPassword(str(b.password, 200))) {
      auth.recordFailure();
      return fail(401, 'Incorrect password', 'BAD_PASSWORD');  /* deliberately unspecific */
    }
    auth.clearFailures();
    return {
      status: 200,
      body: { ok: true },
      headers: { 'Set-Cookie': auth.cookieFor(auth.issue()) }
    };
  }

  if (action === 'logout') {
    return { status: 200, body: { ok: true }, headers: { 'Set-Cookie': auth.clearCookie() } };
  }

  if (action === 'session') {
    return { status: 200, body: { ok: true, authed: auth.authed(cookieHeader) } };
  }

  /* ── everything below needs a valid session ── */
  if (!auth.authed(cookieHeader)) return fail(401, 'Not signed in', 'UNAUTHENTICATED');
  if (!db.configured()) {
    return fail(503, 'Supabase is not configured on the server', 'NOT_CONFIGURED', { missing: db.missing() });
  }

  if (action === 'list') {
    var out = await db.listRequests({ status: str(b.status, 20) || 'all', limit: 200 });
    if (!out.ok) return fail(out.status || 500, out.message);
    return { status: 200, body: { ok: true, rows: out.rows } };
  }

  if (action === 'update') {
    var id = str(b.id, 40);
    if (!id) return fail(400, 'id is required');

    var current = await db.getRequest(id);
    if (!current.ok) return fail(current.status || 404, current.message);

    var patch = {};
    if (b.note !== undefined) patch.admin_note = str(b.note, 2000);

    if (b.status !== undefined) {
      var next = str(b.status, 20);
      if (STATUSES.indexOf(next) === -1) return fail(400, 'Unknown status');
      patch.status = next;

      /* Marking paid is what actually confirms the appointment. */
      if (next === 'paid' && current.row.status !== 'paid') {
        patch.paid_at = new Date().toISOString();
        if (current.row.cal_booking_uid) {
          /* Ask Cal.com what state the booking is actually in first.
             A booking that is already accepted — which is what happens when
             the event type does not require confirmation — has nothing left
             to confirm, and asking again is an error. That should not block
             the payment from being recorded. */
          var look = await cal.getBooking(current.row.cal_booking_uid);
          var already = look.ok && look.status_ === 'accepted';

          if (look.ok && look.status_ === 'cancelled') {
            return fail(409,
              'This booking was cancelled in Cal.com, so it cannot be confirmed.',
              'BOOKING_CANCELLED');
          }

          if (already) {
            patch.cal_status = 'accepted';        /* nothing to do */
          } else {
            var conf = await cal.confirmBooking(current.row.cal_booking_uid);
            if (!conf.ok) {
              return fail(conf.status || 502,
                'Nothing was changed — Cal.com would not confirm the booking: ' + conf.message,
                conf.code || 'CONFIRM_FAILED',
                conf.code === 'CAL_NOT_CONFIGURED'
                  ? { missing: ['CAL_API_KEY'] }
                  : { detail: conf.message });
            }
            patch.cal_status = 'accepted';
          }
        }
      }

      /* Cancelling releases the slot again. */
      if (next === 'cancelled' && current.row.status !== 'cancelled' && current.row.cal_booking_uid) {
        var cancelled = await cal.cancelBooking(current.row.cal_booking_uid, str(b.note, 200) || 'Request cancelled');
        if (cancelled.ok) patch.cal_status = 'cancelled';
      }
    }

    var updated = await db.updateRequest(id, patch);
    if (!updated.ok) return fail(updated.status || 500, updated.message);
    return { status: 200, body: { ok: true, row: updated.row } };
  }

  if (action === 'receipt') {
    var rid = str(b.id, 40);
    if (!rid) return fail(400, 'id is required');

    var found = await db.getRequest(rid);
    if (!found.ok) return fail(found.status || 404, found.message);

    /* upload */
    if (b.data) {
      var type = str(b.contentType, 60);
      var buf;
      try { buf = Buffer.from(String(b.data), 'base64'); }
      catch (e) { return fail(400, 'Could not read the file'); }

      var up = await db.uploadReceipt(rid, type, buf);
      if (!up.ok) return fail(up.status || 500, up.message);

      if (found.row.receipt_path) await db.removeReceipt(found.row.receipt_path);
      var rec = await db.updateRequest(rid, { receipt_path: up.path });
      if (!rec.ok) return fail(rec.status || 500, rec.message);
      return { status: 200, body: { ok: true, row: rec.row } };
    }

    /* view — private bucket, so hand back a short-lived link */
    if (!found.row.receipt_path) return fail(404, 'No screenshot on this request');
    var signed = await db.signReceipt(found.row.receipt_path, 300);
    if (!signed.ok) return fail(signed.status || 500, signed.message);
    return { status: 200, body: { ok: true, url: signed.url } };
  }

  return fail(404, 'Unknown action');
}

/* ══════════════════════════════════════════════════════════
   HEALTH — booleans only, never a value or a key prefix.
   Lets you confirm a deployment picked up its environment
   variables without opening a shell on the host.
   ══════════════════════════════════════════════════════════ */
async function health() {
  var out = {
    cal:      { configured: Boolean(process.env.CAL_API_KEY),
                missing: process.env.CAL_API_KEY ? [] : ['CAL_API_KEY'] },
    admin:    { configured: auth.configured(), missing: auth.missing(),
                malformedHash: auth.hashMalformed(),
                sessionKey: auth.sessionKeySource() },
    supabase: { configured: db.configured(), missing: db.missing(), reachable: false, table: false }
  };

  if (out.supabase.configured) {
    var probe = await db.listRequests({ limit: 1 });
    out.supabase.reachable = Boolean(probe.ok) || probe.status >= 400;
    out.supabase.table = Boolean(probe.ok);
    if (!probe.ok) out.supabase.problem = probe.message;
  }

  var ready = out.cal.configured && out.admin.configured && !out.admin.malformedHash && out.supabase.table;
  return { status: 200, body: { ok: true, ready: ready, checks: out } };
}

module.exports = {
  health: health,
  createRequest: createRequest,
  admin: admin,
  normalisePhone: normalisePhone,
  STATUSES: STATUSES
};
