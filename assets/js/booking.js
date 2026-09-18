/* ============================================================
   نظام الحجز — Reservation system
   ------------------------------------------------------------
   Front-end booking flow (session type → day → time → details)
   that posts the completed reservation to a hosted form endpoint.

   ⚙️  EVERYTHING YOU NEED TO CONFIGURE IS IN THE `CONFIG` BLOCK
       DIRECTLY BELOW. See README.md for the walkthrough.
   ============================================================ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     CONFIG
     ══════════════════════════════════════════════════════════ */
  var CONFIG = {

    /* ── 1. Where bookings are delivered ──────────────────────
       Free Web3Forms account → https://web3forms.com
       Paste the access key you receive by email below.
       While this is left as 'YOUR_WEB3FORMS_ACCESS_KEY' the form
       runs in DEMO MODE: it validates and shows the success
       screen but sends nothing.                                */
    accessKey: 'YOUR_WEB3FORMS_ACCESS_KEY',
    endpoint : 'https://api.web3forms.com/submit',

    /* ── 2. Session types ─────────────────────────────────────
       price is in SAR, duration in minutes.                    */
    sessionTypes: [
      { id: 'intro',    label: 'جلسة تعريفية',        minutes: 50, price: 100 },
      { id: 'individual', label: 'جلسة فردية',        minutes: 60, price: 250 },
      { id: 'family',   label: 'جلسة عائلية',          minutes: 90, price: 350 },
      { id: 'followup', label: 'جلسة متابعة',          minutes: 30, price: 150 }
    ],

    /* ── 3. Working hours, by weekday ─────────────────────────
       0 = Sunday … 6 = Saturday. Times are 24-hour "HH:MM".
       `step` is the spacing between bookable slots, in minutes.
       Matches the hours printed in the footer.                 */
    hours: {
      0: { from: '09:00', to: '12:00' },   /* الأحد    */
      1: { from: '09:00', to: '12:00' },   /* الاثنين  */
      2: { from: '09:00', to: '12:00' },   /* الثلاثاء */
      3: { from: '09:00', to: '12:00' },   /* الأربعاء */
      4: { from: '09:00', to: '12:00' },   /* الخميس   */
      5: { from: '19:00', to: '22:00' },   /* الجمعة   */
      6: { from: '19:00', to: '22:00' }    /* السبت    */
    },
    step: 30,

    /* ── 4. Availability ──────────────────────────────────────
       There is no back-end, so the page cannot know what is
       really booked. Add taken slots here by date:
           booked: { '2026-10-05': ['09:30', '11:00'] }         */
    booked: {},

    /* Shows a couple of greyed-out slots per day so the
       "unavailable" state is visible in the demo. SET THIS TO
       FALSE once you wire up real availability.                */
    demoUnavailable: true,

    /* ── 5. Booking window ────────────────────────────────────  */
    minDaysAhead: 0,     /* 0 = today is bookable, 1 = from tomorrow */
    maxDaysAhead: 90,

    /* First column of the calendar. 5 = Friday (matches the
       design), 0 = Sunday, 6 = Saturday.                       */
    weekStart: 5
  };

  /* ══════════════════════════════════════════════════════════
     Localisation helpers
     ══════════════════════════════════════════════════════════ */
  var MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var DOW_SHORT = ['أحد','اثنين','ثلاثاء','اربعاء','خميس','جمعة','سبت'];
  var DOW_LONG  = ['الأحد','الاثنين','الثلاثاء','الاربعاء','الخميس','الجمعة','السبت'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** Local (not UTC) ISO date key — avoids timezone drift. */
  function key(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    var c = startOfDay(d);
    c.setDate(c.getDate() + n);
    return c;
  }

  function toMinutes(hhmm) {
    var p = hhmm.split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  /** "13:30" → "1:30 م" */
  function formatTime(hhmm) {
    var m = toMinutes(hhmm);
    var h = Math.floor(m / 60);
    var suffix = h < 12 ? 'ص' : 'م';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + pad(m % 60) + ' ' + suffix;
  }

  /** Date → "الاربعاء ، 25 يوليو" */
  function formatDay(d) {
    return DOW_LONG[d.getDay()] + ' ، ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  function formatDuration(mins) {
    if (mins === 60) return 'ساعة';
    if (mins === 90) return 'ساعة ونصف';
    if (mins === 30) return 'نصف ساعة';
    return mins + ' دقيقة';
  }

  /* ══════════════════════════════════════════════════════════
     Availability
     ══════════════════════════════════════════════════════════ */

  /** Stable per-date pseudo-random, so the demo does not flicker. */
  function hash(str) {
    var h = 2166136261, i;
    for (i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  /** All slot strings ("HH:MM") the practice offers on a given day. */
  function slotsFor(date) {
    var window_ = CONFIG.hours[date.getDay()];
    if (!window_) return [];

    var out = [];
    var from = toMinutes(window_.from);
    var to   = toMinutes(window_.to);
    for (var m = from; m <= to; m += CONFIG.step) {
      out.push(pad(Math.floor(m / 60)) + ':' + pad(m % 60));
    }
    return out;
  }

  function isTaken(date, slot) {
    var k = key(date);
    var list = CONFIG.booked[k];
    if (list && list.indexOf(slot) !== -1) return true;

    if (CONFIG.demoUnavailable && hash(k + slot) % 5 === 0) return true;

    /* A slot already in the past today is not bookable. */
    var now = new Date();
    if (k === key(now)) {
      if (toMinutes(slot) <= now.getHours() * 60 + now.getMinutes()) return true;
    }
    return false;
  }

  function isDayOpen(date) {
    var min = addDays(new Date(), CONFIG.minDaysAhead);
    var max = addDays(new Date(), CONFIG.maxDaysAhead);
    if (date < min || date > max) return false;

    var slots = slotsFor(date), i;
    for (i = 0; i < slots.length; i++) {
      if (!isTaken(date, slots[i])) return true;
    }
    return false;
  }

  /* ══════════════════════════════════════════════════════════
     State + DOM
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
    sumMain   : document.getElementById('bk-summary-main'),
    sumMeta   : document.getElementById('bk-summary-meta'),
    formError : document.getElementById('bk-form-error'),
    submit    : document.getElementById('bk-submit'),
    done      : document.getElementById('booking-done'),
    doneDetail: document.getElementById('booking-done-detail'),
    again     : document.getElementById('booking-again')
  };

  var state = {
    view     : startOfDay(new Date()),  /* month currently rendered */
    date     : null,                    /* chosen Date */
    time     : null,                    /* chosen "HH:MM" */
    focusDate: null                     /* roving tabindex target */
  };

  /* ── session types ──────────────────────────────────────── */
  function currentType() {
    var i;
    for (i = 0; i < CONFIG.sessionTypes.length; i++) {
      if (CONFIG.sessionTypes[i].id === el.type.value) return CONFIG.sessionTypes[i];
    }
    return CONFIG.sessionTypes[0];
  }

  function buildTypes() {
    var frag = document.createDocumentFragment();
    CONFIG.sessionTypes.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.id;
      o.textContent = t.label + ' — ' + t.minutes + ' دقيقة · ' + t.price + ' ريال';
      frag.appendChild(o);
    });
    el.type.appendChild(frag);
  }

  /* ── calendar ───────────────────────────────────────────── */
  function buildDows() {
    var frag = document.createDocumentFragment(), i, s;
    for (i = 0; i < 7; i++) {
      s = document.createElement('span');
      s.textContent = DOW_SHORT[(CONFIG.weekStart + i) % 7];
      frag.appendChild(s);
    }
    el.calDows.appendChild(frag);
  }

  function renderCalendar() {
    var year  = state.view.getFullYear();
    var month = state.view.getMonth();

    el.calMonth.textContent = MONTHS[month] + ' ' + year;

    var first = new Date(year, month, 1);
    /* how many cells before the 1st, given weekStart */
    var lead = (first.getDay() - CONFIG.weekStart + 7) % 7;
    var gridStart = addDays(first, -lead);

    var today = startOfDay(new Date());
    var frag = document.createDocumentFragment();
    var anyFocusable = false;
    var i, d, btn, open, inMonth;

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
        btn.setAttribute('aria-label', formatDay(d) + ' — غير متاح');
      } else {
        btn.setAttribute('aria-label', formatDay(d));
        btn.setAttribute('aria-pressed', state.date && +state.date === +d ? 'true' : 'false');
        if (state.date && +state.date === +d) btn.classList.add('is-selected');

        var isFocus = state.focusDate && +state.focusDate === +d;
        btn.tabIndex = isFocus ? 0 : -1;
        if (isFocus) anyFocusable = true;
      }

      frag.appendChild(btn);
    }

    el.calGrid.innerHTML = '';
    el.calGrid.appendChild(frag);

    /* make sure exactly one day is reachable by Tab */
    if (!anyFocusable) {
      var firstOpen = el.calGrid.querySelector('.cal-day:not([disabled])');
      if (firstOpen) {
        firstOpen.tabIndex = 0;
        state.focusDate = new Date(firstOpen.dataset.date + 'T00:00:00');
      }
    }

    /* disable prev when it would leave the bookable window */
    var minMonth = startOfDay(new Date());
    el.calPrev.disabled = (year === minMonth.getFullYear() && month === minMonth.getMonth())
                       || new Date(year, month, 1) < new Date(minMonth.getFullYear(), minMonth.getMonth(), 1);

    var maxDate = addDays(new Date(), CONFIG.maxDaysAhead);
    el.calNext.disabled = new Date(year, month + 1, 1) > maxDate;
  }

  function shiftMonth(delta) {
    state.view = new Date(state.view.getFullYear(), state.view.getMonth() + delta, 1);
    renderCalendar();
  }

  /* ── time slots ─────────────────────────────────────────── */
  function renderSlots() {
    el.slots.innerHTML = '';

    if (!state.date) {
      el.timeDate.textContent = '—';
      var hint = document.createElement('p');
      hint.className = 'slots__empty';
      hint.textContent = 'اختر اليوم أولاً لعرض الأوقات المتاحة.';
      el.slots.appendChild(hint);
      return;
    }

    el.timeDate.textContent = formatDay(state.date);

    var all = slotsFor(state.date);
    if (!all.length) {
      var closed = document.createElement('p');
      closed.className = 'slots__empty';
      closed.textContent = 'لا توجد مواعيد في هذا اليوم.';
      el.slots.appendChild(closed);
      return;
    }

    var frag = document.createDocumentFragment();
    all.forEach(function (slot) {
      var taken = isTaken(state.date, slot);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot';
      b.textContent = formatTime(slot);
      b.dataset.slot = slot;

      if (taken) {
        b.disabled = true;
        b.setAttribute('aria-label', formatTime(slot) + ' — محجوز');
      } else {
        b.setAttribute('aria-pressed', state.time === slot ? 'true' : 'false');
        if (state.time === slot) b.classList.add('is-selected');
      }
      frag.appendChild(b);
    });
    el.slots.appendChild(frag);
  }

  /* ── summary ────────────────────────────────────────────── */
  function renderSummary() {
    var t = currentType();
    var parts = [t.label];

    if (state.date) parts.push(formatDay(state.date));
    if (state.time) parts.push(formatTime(state.time));

    el.sumMain.textContent = parts.join(' . ');
    el.sumMeta.textContent = formatDuration(t.minutes) + ' . ' + t.price + ' ريال';
  }

  function refresh() {
    renderCalendar();
    renderSlots();
    renderSummary();
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

  function validate() {
    var problems = [];
    var name   = document.getElementById('bk-name');
    var child  = document.getElementById('bk-child');
    var email  = document.getElementById('bk-email');

    setError(name, ''); setError(child, ''); setError(email, '');

    if (!name.value.trim()) {
      setError(name, 'الرجاء إدخال الاسم.');
      problems.push(name);
    }
    if (!child.value.trim()) {
      setError(child, 'الرجاء إدخال اسم الطفل وعمره.');
      problems.push(child);
    }
    if (!email.value.trim()) {
      setError(email, 'الرجاء إدخال البريد الالكتروني.');
      problems.push(email);
    } else if (!EMAIL.test(email.value.trim())) {
      setError(email, 'صيغة البريد الالكتروني غير صحيحة.');
      problems.push(email);
    }

    var top = '';
    if (!state.date) top = 'الرجاء اختيار اليوم المناسب لك.';
    else if (!state.time) top = 'الرجاء اختيار الوقت المناسب لك.';
    else if (problems.length) top = 'الرجاء تعبئة الحقول المطلوبة.';

    if (top) {
      el.formError.textContent = top;
      el.formError.hidden = false;
    } else {
      el.formError.hidden = true;
      el.formError.textContent = '';
    }

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
  function payload() {
    var t = currentType();
    return {
      access_key : CONFIG.accessKey,
      subject    : 'حجز جديد — ' + t.label + ' — ' + formatDay(state.date),
      from_name  : 'موقع د. دلال العصيمي',
      'الاسم'              : document.getElementById('bk-name').value.trim(),
      'اسم الطفل وعمره'    : document.getElementById('bk-child').value.trim(),
      'البريد الالكتروني'  : document.getElementById('bk-email').value.trim(),
      'سبب الجلسة'         : document.getElementById('bk-reason').value.trim() || '—',
      'الخدمة'             : el.service.value,
      'نوع الجلسة'         : t.label,
      'التاريخ'            : formatDay(state.date) + ' (' + key(state.date) + ')',
      'الوقت'              : formatTime(state.time),
      'المدة'              : formatDuration(t.minutes),
      'السعر'              : t.price + ' ريال'
    };
  }

  function showDone() {
    var t = currentType();
    el.doneDetail.textContent =
      t.label + ' · ' + formatDay(state.date) + ' · ' + formatTime(state.time) +
      ' · ' + t.price + ' ريال';

    form.hidden = true;
    el.done.hidden = false;
    el.done.setAttribute('tabindex', '-1');
    el.done.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;

    var demo = !CONFIG.accessKey || CONFIG.accessKey === 'YOUR_WEB3FORMS_ACCESS_KEY';

    el.submit.classList.add('is-busy');
    el.submit.disabled = true;

    var done = function () {
      el.submit.classList.remove('is-busy');
      el.submit.disabled = false;
    };

    if (demo) {
      /* No endpoint configured — validate + confirm locally. */
      window.setTimeout(function () { done(); showDone(); }, 550);
      return;
    }

    fetch(CONFIG.endpoint, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body   : JSON.stringify(payload())
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        done();
        if (data && data.success) {
          showDone();
        } else {
          el.formError.textContent = 'تعذّر إرسال الحجز. الرجاء المحاولة مرة أخرى أو التواصل معنا مباشرة.';
          el.formError.hidden = false;
        }
      })
      .catch(function () {
        done();
        el.formError.textContent = 'تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.';
        el.formError.hidden = false;
      });
  });

  /* ══════════════════════════════════════════════════════════
     Events
     ══════════════════════════════════════════════════════════ */
  el.calPrev.addEventListener('click', function () { shiftMonth(-1); });
  el.calNext.addEventListener('click', function () { shiftMonth(1); });

  el.calGrid.addEventListener('click', function (e) {
    var btn = e.target.closest('.cal-day');
    if (!btn || btn.disabled) return;

    state.date = new Date(btn.dataset.date + 'T00:00:00');
    state.focusDate = state.date;
    state.time = null;
    el.dateInput.value = btn.dataset.date;
    el.timeInput.value = '';
    el.formError.hidden = true;
    refresh();
  });

  /* Arrow-key navigation across the month grid. */
  el.calGrid.addEventListener('keydown', function (e) {
    var map = { ArrowRight: -1, ArrowLeft: 1, ArrowUp: -7, ArrowDown: 7 };
    var delta = map[e.key];
    if (delta === undefined) return;

    var btn = e.target.closest('.cal-day');
    if (!btn) return;
    e.preventDefault();

    var from = new Date(btn.dataset.date + 'T00:00:00');
    var next = addDays(from, delta);

    if (next.getMonth() !== state.view.getMonth() ||
        next.getFullYear() !== state.view.getFullYear()) {
      state.view = new Date(next.getFullYear(), next.getMonth(), 1);
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

  el.type.addEventListener('change', renderSummary);
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
    refresh();
    document.getElementById('booking').scrollIntoView({ block: 'start' });
  });

  /* clear a field error as soon as the visitor fixes it */
  ['bk-name', 'bk-child', 'bk-email'].forEach(function (id) {
    var input = document.getElementById(id);
    input.addEventListener('input', function () {
      if (input.hasAttribute('aria-invalid')) setError(input, '');
    });
  });

  /* ── boot ───────────────────────────────────────────────── */
  buildTypes();
  buildDows();
  refresh();
})();
