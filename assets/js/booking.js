/* ============================================================
   نظام الحجز — Reservation system (Cal.com backed)
   ------------------------------------------------------------
   Availability is read from, and bookings are written to, your
   Cal.com account — which is what puts them on your connected
   calendar. The browser never sees the API key: it talks to
   /api/slots and /api/book, which run server-side.

   If those endpoints are unreachable (opened as a plain file, or
   deployed somewhere without serverless functions) the flow falls
   back to LOCAL MODE: times are generated from CONFIG.hours and
   submitting only shows the confirmation screen. The console says
   so explicitly when this happens.

   ⚙️  Configure below. Full walkthrough in README.md.
   ============================================================ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     CONFIG
     ══════════════════════════════════════════════════════════ */
  var CONFIG = {

    /* Where the serverless endpoints live. '' = same origin (/api/…).
       Point it at another deployment if the site is hosted separately,
       e.g. 'https://booking.drdalal.com'.                        */
    apiBase: '',

    /* The practice's timezone. Visitors always see clinic time, so
       nobody books 3 AM by accident. Must match CAL_TIMEZONE. */
    timeZone: 'Asia/Riyadh',

    /* Fixed UTC offset for the timezone above, used ONLY by the local
       fallback. Riyadh has no daylight saving, so this is exact. */
    utcOffset: '+03:00',

    /* ── Session types ────────────────────────────────────────
       `calEventTypeId` is the numeric id of the matching Cal.com
       event type. Find it in the URL when you open the event type
       in Cal.com: /event-types/1234567  →  1234567
       Event type ids are not secret.

       `minutes` and `price` drive the summary shown to the visitor;
       the authoritative duration is whatever the Cal.com event type
       says.                                                     */
    sessionTypes: [
      { id: 'intro',      labelKey: 'type.intro',      minutes: 50, price: 100, calEventTypeId: null },
      { id: 'individual', labelKey: 'type.individual', minutes: 60, price: 250, calEventTypeId: null },
      { id: 'family',     labelKey: 'type.family',     minutes: 90, price: 350, calEventTypeId: null },
      { id: 'followup',   labelKey: 'type.followup',   minutes: 30, price: 150, calEventTypeId: null }
    ],

    /* Services shown in the first dropdown. Recorded on the booking
       as context; they do not change availability. */
    services: ['svc.anxiety', 'svc.mood', 'svc.personality', 'svc.marriage', 'svc.children'],

    /* ── Booking window ─────────────────────────────────────── */
    minDaysAhead: 0,     /* 0 = today is bookable, 1 = from tomorrow */
    maxDaysAhead: 90,
    weekStart: 5,        /* first calendar column: 5 = Friday (per the design) */

    /* ── Local fallback only ─────────────────────────────────
       Ignored entirely once Cal.com is connected. */
    hours: {
      0: { from: '09:00', to: '12:00' },   /* الأحد    */
      1: { from: '09:00', to: '12:00' },   /* الاثنين  */
      2: { from: '09:00', to: '12:00' },   /* الثلاثاء */
      3: { from: '09:00', to: '12:00' },   /* الأربعاء */
      4: { from: '09:00', to: '12:00' },   /* الخميس   */
      5: { from: '19:00', to: '22:00' },   /* الجمعة   */
      6: { from: '19:00', to: '22:00' }    /* السبت    */
    },
    step: 30
  };

  /* ══════════════════════════════════════════════════════════
     Helpers
     ══════════════════════════════════════════════════════════ */
  var T = function (k) { return window.Lang ? window.Lang.t(k) : k; };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { var c = startOfDay(d); c.setDate(c.getDate() + n); return c; }

  /** Local calendar-date key, never UTC — avoids off-by-one near midnight. */
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function toMinutes(hhmm) {
    var p = hhmm.split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  var _hm = null, _dk = null;
  function hmFormatter() {
    if (!_hm) _hm = new Intl.DateTimeFormat('en-GB', {
      timeZone: CONFIG.timeZone, hour12: false, hour: '2-digit', minute: '2-digit'
    });
    return _hm;
  }
  function dateKeyFormatter() {
    if (!_dk) _dk = new Intl.DateTimeFormat('en-CA', {
      timeZone: CONFIG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    });
    return _dk;
  }

  /** ISO instant → "HH:MM" in the practice's timezone. */
  function isoToHM(iso) {
    return hmFormatter().format(new Date(iso));
  }

  /** ISO instant → "YYYY-MM-DD" in the practice's timezone. */
  function isoToDateKey(iso) {
    return dateKeyFormatter().format(new Date(iso));
  }

  /** ISO instant → localised clock time, e.g. "9:00 ص" / "9:00 AM". */
  function formatTime(iso) {
    var m = toMinutes(isoToHM(iso));
    var h = Math.floor(m / 60);
    var suffix = h < 12 ? T('bk.am') : T('bk.pm');
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + pad(m % 60) + ' ' + suffix;
  }

  /** Date → "الاربعاء ، 25 يوليو" / "Wednesday, 25 July". */
  function formatDay(d) {
    var dow = T('bk.dowLong')[d.getDay()];
    var month = T('bk.months')[d.getMonth()];
    return window.Lang && window.Lang.current === 'ar'
      ? dow + ' ، ' + d.getDate() + ' ' + month
      : dow + ', ' + d.getDate() + ' ' + month;
  }

  function formatDuration(mins) {
    if (mins === 60) return T('bk.hour');
    if (mins === 90) return T('bk.hourHalf');
    if (mins === 30) return T('bk.halfHour');
    return mins + ' ' + T('bk.minutes');
  }

  function formatPrice(p) {
    return window.Lang && window.Lang.current === 'ar'
      ? p + ' ' + T('bk.currency')
      : T('bk.currency') + ' ' + p;
  }

  function api(path) { return (CONFIG.apiBase || '') + '/api/' + path; }

  /* ══════════════════════════════════════════════════════════
     State
     ══════════════════════════════════════════════════════════ */
  var form = document.getElementById('booking-form');
  if (!form) return;

  var el = {
    service   : document.getElementById('bk-service'),
    type      : document.getElementById('bk-type'),
    calMonth  : document.getElementById('cal-month'),
    calDows   : document.getElementById('cal-dows'),
    calGrid   : document.getElementById('cal-grid'),
    calPrev   : form.querySelector('[data-cal-prev]'),
    calNext   : form.querySelector('[data-cal-next]'),
    dateInput : document.getElementById('bk-date'),
    timeInput : document.getElementById('bk-time'),
    timeDate  : document.getElementById('bk-time-date'),
    slots     : document.getElementById('bk-slots'),
    tzNote    : document.getElementById('bk-tz'),
    sumMain   : document.getElementById('bk-summary-main'),
    sumMeta   : document.getElementById('bk-summary-meta'),
    formError : document.getElementById('bk-form-error'),
    submit    : document.getElementById('bk-submit'),
    done      : document.getElementById('booking-done'),
    doneDetail: document.getElementById('booking-done-detail'),
    again     : document.getElementById('booking-again')
  };

  var state = {
    view : startOfDay(new Date()),
    date : null,     /* Date */
    time : null,     /* ISO start string */
    focusDate: null
  };

  /** monthKey → { status, byDate } ; status: loading | ready | local | error */
  var months = {};
  var warnedLocal = false;

  function currentType() {
    var i;
    for (i = 0; i < CONFIG.sessionTypes.length; i++) {
      if (CONFIG.sessionTypes[i].id === el.type.value) return CONFIG.sessionTypes[i];
    }
    return CONFIG.sessionTypes[0];
  }

  function monthKey(y, m) {
    return (currentType().calEventTypeId || 'local') + '|' + y + '-' + m;
  }

  /* ══════════════════════════════════════════════════════════
     Availability
     ══════════════════════════════════════════════════════════ */

  /** Fallback slot generation from CONFIG.hours, as ISO instants. */
  function localMonth(year, month) {
    var byDate = {};
    var first = new Date(year, month, 1);
    var min = addDays(new Date(), CONFIG.minDaysAhead);
    var max = addDays(new Date(), CONFIG.maxDaysAhead);
    var now = new Date();
    var d, w, list, m, hhmm, iso;

    for (d = first; d.getMonth() === month; d = addDays(d, 1)) {
      if (d < min || d > max) continue;
      w = CONFIG.hours[d.getDay()];
      if (!w) continue;

      list = [];
      for (m = toMinutes(w.from); m <= toMinutes(w.to); m += CONFIG.step) {
        hhmm = pad(Math.floor(m / 60)) + ':' + pad(m % 60);
        iso = key(d) + 'T' + hhmm + ':00' + CONFIG.utcOffset;
        if (new Date(iso) <= now) continue;      /* no booking the past */
        list.push(iso);
      }
      if (list.length) byDate[key(d)] = list;
    }
    return byDate;
  }

  function groupByDate(isoList) {
    var byDate = {};
    isoList.forEach(function (iso) {
      var k = isoToDateKey(iso);
      (byDate[k] || (byDate[k] = [])).push(iso);
    });
    return byDate;
  }

  function useLocal(entry, year, month, reason) {
    entry.status = 'local';
    entry.byDate = localMonth(year, month);
    if (!warnedLocal) {
      warnedLocal = true;
      console.warn(
        '[booking] Cal.com is not reachable (' + reason + ').\n' +
        '          Running in LOCAL MODE: times come from CONFIG.hours and\n' +
        '          submitting will NOT create a real booking.\n' +
        '          See README.md → "Connecting Cal.com".'
      );
    }
  }

  /** Load one month of availability, once, and re-render when it lands. */
  function ensureMonth(year, month) {
    var k = monthKey(year, month);
    if (months[k] && months[k].status !== 'error') return;

    var entry = months[k] = { status: 'loading', byDate: {} };
    var type = currentType();

    if (!type.calEventTypeId) {
      useLocal(entry, year, month, 'no calEventTypeId configured');
      render();
      return;
    }

    var first = new Date(year, month, 1);
    var last = new Date(year, month + 1, 0);

    fetch(api('slots')
      + '?eventTypeId=' + encodeURIComponent(type.calEventTypeId)
      + '&start=' + key(first)
      + '&end=' + key(last)
      + '&timeZone=' + encodeURIComponent(CONFIG.timeZone))
      .then(function (r) {
        return r.json().then(function (j) { return { status: r.status, json: j }; });
      })
      .then(function (out) {
        if (months[k] !== entry) return;                  /* superseded */

        if (out.status === 503 || out.status === 404) {
          useLocal(entry, year, month, 'endpoint returned ' + out.status);
        } else if (!out.json || out.json.ok !== true) {
          entry.status = 'error';
          entry.message = (out.json && out.json.message) || T('bk.slotsError');
        } else {
          entry.status = 'ready';
          entry.byDate = groupByDate(out.json.slots || []);
        }
        render();
      })
      .catch(function (err) {
        if (months[k] !== entry) return;
        useLocal(entry, year, month, err.message);
        render();
      });
  }

  function monthEntry(year, month) {
    return months[monthKey(year, month)] || { status: 'loading', byDate: {} };
  }

  function slotsForDate(d) {
    var entry = monthEntry(d.getFullYear(), d.getMonth());
    return entry.byDate[key(d)] || [];
  }

  function inWindow(d) {
    return d >= addDays(new Date(), CONFIG.minDaysAhead)
        && d <= addDays(new Date(), CONFIG.maxDaysAhead);
  }

  function isDayOpen(d) {
    if (!inWindow(d)) return false;
    var entry = monthEntry(d.getFullYear(), d.getMonth());
    /* while a month is in flight, keep in-window days clickable */
    if (entry.status === 'loading') return true;
    if (entry.status === 'error') return false;
    return slotsForDate(d).length > 0;
  }

  /* ══════════════════════════════════════════════════════════
     Rendering
     ══════════════════════════════════════════════════════════ */
  function buildSelects() {
    var prevService = el.service.value;
    var prevType = el.type.value;

    el.service.innerHTML = '';
    CONFIG.services.forEach(function (k) {
      var o = document.createElement('option');
      o.value = k;
      o.textContent = T(k);
      el.service.appendChild(o);
    });
    if (prevService) el.service.value = prevService;

    el.type.innerHTML = '';
    CONFIG.sessionTypes.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.id;
      o.textContent = T(t.labelKey) + ' — ' + formatDuration(t.minutes) + ' · ' + formatPrice(t.price);
      el.type.appendChild(o);
    });
    if (prevType) el.type.value = prevType;
  }

  function buildDows() {
    el.calDows.innerHTML = '';
    var short = T('bk.dowShort'), i, s;
    for (i = 0; i < 7; i++) {
      s = document.createElement('span');
      s.textContent = short[(CONFIG.weekStart + i) % 7];
      el.calDows.appendChild(s);
    }
  }

  function renderCalendar() {
    var year = state.view.getFullYear();
    var month = state.view.getMonth();

    el.calMonth.textContent = T('bk.months')[month] + ' ' + year;

    var first = new Date(year, month, 1);
    var lead = (first.getDay() - CONFIG.weekStart + 7) % 7;
    var gridStart = addDays(first, -lead);
    var today = startOfDay(new Date());

    var frag = document.createDocumentFragment();
    var anyFocusable = false;
    var i, d, btn, open, inMonth, isFocus;

    for (i = 0; i < 42; i++) {
      d = addDays(gridStart, i);
      inMonth = d.getMonth() === month;
      open = inMonth && isDayOpen(d);

      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day';
      btn.textContent = d.getDate();
      btn.dataset.date = key(d);

      if (!inMonth) btn.classList.add('is-muted');
      if (+d === +today) btn.classList.add('is-today');

      if (!open) {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        btn.setAttribute('aria-label', formatDay(d) + ' — ' + T('bk.unavailableDay'));
      } else {
        btn.setAttribute('aria-label', formatDay(d));
        btn.setAttribute('aria-pressed', state.date && +state.date === +d ? 'true' : 'false');
        if (state.date && +state.date === +d) btn.classList.add('is-selected');
        isFocus = state.focusDate && +state.focusDate === +d;
        btn.tabIndex = isFocus ? 0 : -1;
        if (isFocus) anyFocusable = true;
      }
      frag.appendChild(btn);
    }

    el.calGrid.innerHTML = '';
    el.calGrid.appendChild(frag);

    if (!anyFocusable) {
      var firstOpen = el.calGrid.querySelector('.cal-day:not([disabled])');
      if (firstOpen) {
        firstOpen.tabIndex = 0;
        state.focusDate = new Date(firstOpen.dataset.date + 'T00:00:00');
      }
    }

    var now = startOfDay(new Date());
    el.calPrev.disabled = new Date(year, month, 1) <= new Date(now.getFullYear(), now.getMonth(), 1);
    el.calNext.disabled = new Date(year, month + 1, 1) > addDays(new Date(), CONFIG.maxDaysAhead);
  }

  function hint(text) {
    var p = document.createElement('p');
    p.className = 'slots__empty';
    p.textContent = text;
    return p;
  }

  function renderSlots() {
    el.slots.innerHTML = '';
    el.tzNote.hidden = true;

    if (!state.date) {
      el.timeDate.textContent = '—';
      el.slots.appendChild(hint(T('bk.pickDayFirst')));
      return;
    }

    el.timeDate.textContent = formatDay(state.date);

    var entry = monthEntry(state.date.getFullYear(), state.date.getMonth());
    if (entry.status === 'loading') {
      el.slots.appendChild(hint(T('bk.loadingSlots')));
      return;
    }
    if (entry.status === 'error') {
      el.slots.appendChild(hint(entry.message || T('bk.slotsError')));
      return;
    }

    var list = slotsForDate(state.date);
    if (!list.length) {
      el.slots.appendChild(hint(T('bk.noSlots')));
      return;
    }

    var frag = document.createDocumentFragment();
    list.forEach(function (iso) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot';
      b.textContent = formatTime(iso);
      b.dataset.slot = iso;
      b.setAttribute('aria-pressed', state.time === iso ? 'true' : 'false');
      if (state.time === iso) b.classList.add('is-selected');
      frag.appendChild(b);
    });
    el.slots.appendChild(frag);

    el.tzNote.textContent = T('bk.tzNote');
    el.tzNote.hidden = false;
  }

  function renderSummary() {
    var t = currentType();
    var parts = [T(t.labelKey)];
    if (state.date) parts.push(formatDay(state.date));
    if (state.time) parts.push(formatTime(state.time));

    el.sumMain.textContent = state.date || state.time
      ? parts.join(' · ')
      : T(t.labelKey);
    el.sumMeta.textContent = formatDuration(t.minutes) + ' · ' + formatPrice(t.price);
  }

  function render() {
    renderCalendar();
    renderSlots();
    renderSummary();
  }

  function refresh() {
    ensureMonth(state.view.getFullYear(), state.view.getMonth());
    render();
  }

  /* ══════════════════════════════════════════════════════════
     Validation
     ══════════════════════════════════════════════════════════ */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setError(input, message) {
    var box = form.querySelector('[data-error-for="' + input.id + '"]');
    if (box) box.textContent = message || '';
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function showFormError(msg) {
    el.formError.textContent = msg;
    el.formError.hidden = false;
  }

  function validate() {
    var problems = [];
    var name = document.getElementById('bk-name');
    var child = document.getElementById('bk-child');
    var email = document.getElementById('bk-email');

    setError(name, ''); setError(child, ''); setError(email, '');

    if (!name.value.trim()) { setError(name, T('bk.errName')); problems.push(name); }
    if (!child.value.trim()) { setError(child, T('bk.errChild')); problems.push(child); }
    if (!email.value.trim()) { setError(email, T('bk.errEmail')); problems.push(email); }
    else if (!EMAIL.test(email.value.trim())) { setError(email, T('bk.errEmailFormat')); problems.push(email); }

    var top = '';
    if (!state.date) top = T('bk.errPickDay');
    else if (!state.time) top = T('bk.errPickTime');
    else if (problems.length) top = T('bk.errFields');

    if (top) showFormError(top);
    else { el.formError.hidden = true; el.formError.textContent = ''; }

    if (problems.length) problems[0].focus();
    else if (!state.date) {
      var firstDay = el.calGrid.querySelector('.cal-day:not([disabled])');
      if (firstDay) firstDay.focus();
    }
    return !top;
  }

  /* ══════════════════════════════════════════════════════════
     Submit
     ══════════════════════════════════════════════════════════ */
  function showDone() {
    var t = currentType();
    el.doneDetail.textContent = [
      T(t.labelKey), formatDay(state.date), formatTime(state.time), formatPrice(t.price)
    ].join(' · ');

    form.hidden = true;
    el.done.hidden = false;
    el.done.setAttribute('tabindex', '-1');
    el.done.focus();
  }

  function busy(on) {
    el.submit.classList.toggle('is-busy', on);
    el.submit.disabled = on;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;

    var t = currentType();
    var entry = monthEntry(state.date.getFullYear(), state.date.getMonth());

    busy(true);

    /* Local mode: nothing to book against — confirm locally. */
    if (entry.status === 'local' || !t.calEventTypeId) {
      window.setTimeout(function () { busy(false); showDone(); }, 500);
      return;
    }

    fetch(api('book'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        eventTypeId: t.calEventTypeId,
        start: state.time,
        lengthInMinutes: t.minutes,
        name: document.getElementById('bk-name').value.trim(),
        email: document.getElementById('bk-email').value.trim(),
        child: document.getElementById('bk-child').value.trim(),
        reason: document.getElementById('bk-reason').value.trim(),
        service: T(el.service.value),
        timeZone: CONFIG.timeZone,
        language: window.Lang ? window.Lang.current : 'ar',
        metadata: { sessionType: t.id, price: String(t.price) }
      })
    })
      .then(function (r) {
        return r.json().then(function (j) { return { status: r.status, json: j }; });
      })
      .then(function (out) {
        busy(false);
        if (out.json && out.json.ok) { showDone(); return; }

        if (out.json && out.json.conflict) {
          /* someone took it mid-form — refetch and make them pick again */
          showFormError(T('bk.errTaken'));
          state.time = null;
          el.timeInput.value = '';
          delete months[monthKey(state.date.getFullYear(), state.date.getMonth())];
          refresh();
          return;
        }
        showFormError((out.json && out.json.message) || T('bk.errSend'));
      })
      .catch(function () {
        busy(false);
        showFormError(T('bk.errNetwork'));
      });
  });

  /* ══════════════════════════════════════════════════════════
     Events
     ══════════════════════════════════════════════════════════ */
  el.calPrev.addEventListener('click', function () {
    state.view = new Date(state.view.getFullYear(), state.view.getMonth() - 1, 1);
    refresh();
  });
  el.calNext.addEventListener('click', function () {
    state.view = new Date(state.view.getFullYear(), state.view.getMonth() + 1, 1);
    refresh();
  });

  el.calGrid.addEventListener('click', function (e) {
    var btn = e.target.closest('.cal-day');
    if (!btn || btn.disabled) return;

    state.date = new Date(btn.dataset.date + 'T00:00:00');
    state.focusDate = state.date;
    state.time = null;
    el.dateInput.value = btn.dataset.date;
    el.timeInput.value = '';
    el.formError.hidden = true;
    render();
  });

  el.calGrid.addEventListener('keydown', function (e) {
    var map = { ArrowRight: -1, ArrowLeft: 1, ArrowUp: -7, ArrowDown: 7 };
    /* arrows follow visual direction, which flips with the language */
    if (window.Lang && window.Lang.dir === 'ltr') {
      map = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: -7, ArrowDown: 7 };
    }
    var delta = map[e.key];
    if (delta === undefined) return;

    var btn = e.target.closest('.cal-day');
    if (!btn) return;
    e.preventDefault();

    var next = addDays(new Date(btn.dataset.date + 'T00:00:00'), delta);
    if (next.getMonth() !== state.view.getMonth() || next.getFullYear() !== state.view.getFullYear()) {
      state.view = new Date(next.getFullYear(), next.getMonth(), 1);
      ensureMonth(state.view.getFullYear(), state.view.getMonth());
    }
    state.focusDate = next;
    renderCalendar();

    var target = el.calGrid.querySelector('[data-date="' + key(next) + '"]');
    if (target) target.focus();
  });

  el.slots.addEventListener('click', function (e) {
    var btn = e.target.closest('.slot');
    if (!btn || btn.disabled) return;
    state.time = btn.dataset.slot;
    el.timeInput.value = state.time;
    el.formError.hidden = true;
    renderSlots();
    renderSummary();
  });

  /* Changing the session type changes the Cal.com event type, and so
     the whole availability picture. */
  el.type.addEventListener('change', function () {
    state.time = null;
    el.timeInput.value = '';
    refresh();
  });
  el.service.addEventListener('change', renderSummary);

  el.again.addEventListener('click', function () {
    form.reset();
    state.date = null;
    state.time = null;
    state.view = startOfDay(new Date());
    el.dateInput.value = '';
    el.timeInput.value = '';
    el.formError.hidden = true;
    ['bk-name', 'bk-child', 'bk-email'].forEach(function (id) {
      setError(document.getElementById(id), '');
    });
    el.done.hidden = true;
    form.hidden = false;
    buildSelects();
    refresh();
    document.getElementById('booking').scrollIntoView({ block: 'start' });
  });

  ['bk-name', 'bk-child', 'bk-email'].forEach(function (id) {
    var input = document.getElementById(id);
    input.addEventListener('input', function () {
      if (input.hasAttribute('aria-invalid')) setError(input, '');
    });
  });

  /* ── boot + language changes ────────────────────────────── */
  function boot() {
    buildSelects();
    buildDows();
    refresh();
  }

  if (window.Lang) {
    window.Lang.onChange(function () {
      buildSelects();
      buildDows();
      render();
    });
  }

  boot();
})();
