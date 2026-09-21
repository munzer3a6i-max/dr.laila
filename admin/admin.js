/* ============================================================
   Admin dashboard
   ------------------------------------------------------------
   Every call goes to /api/admin and is authorised by an
   HttpOnly session cookie, so this file holds no secrets and
   nothing here can be read or forged from the page.
   ============================================================ */
(function () {
  'use strict';

  var API = '/api/admin';

  var STATUS = {
    pending:   'بانتظار الدفع',
    contacted: 'تم التواصل',
    paid:      'مدفوع — مؤكد',
    cancelled: 'ملغي'
  };
  var MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var DOW = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

  var el = {
    gate: document.getElementById('gate'),
    app: document.getElementById('app'),
    loginForm: document.getElementById('login-form'),
    loginBtn: document.getElementById('login-btn'),
    loginError: document.getElementById('login-error'),
    pw: document.getElementById('pw'),
    tabs: document.getElementById('tabs'),
    list: document.getElementById('list'),
    empty: document.getElementById('empty'),
    feedback: document.getElementById('feedback'),
    drawer: document.getElementById('drawer'),
    drawerBody: document.getElementById('drawer-body'),
    refresh: document.getElementById('refresh'),
    logout: document.getElementById('logout')
  };

  var rows = [];
  var filter = 'all';
  var openId = null;

  /* ── transport ─────────────────────────────────────────── */
  function call(action, payload) {
    var body = { action: action };
    Object.keys(payload || {}).forEach(function (k) { body[k] = payload[k]; });

    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; })
        .then(function (j) { return { status: r.status, json: j }; });
    });
  }

  /* The API answers in English; the dashboard speaks Arabic. */
  var MSG = {
    BAD_PASSWORD:    'كلمة المرور غير صحيحة',
    RATE_LIMITED:    'محاولات كثيرة. انتظر بضع دقائق ثم أعد المحاولة.',
    UNAUTHENTICATED: 'انتهت الجلسة. سجّل الدخول من جديد.',
    NOT_CONFIGURED:  'الإعدادات غير مكتملة على الخادم.',
    CONFIRM_FAILED:  'تعذّر تثبيت الحجز في التقويم — لم تتغيّر الحالة.',
    CAL_NOT_CONFIGURED: 'CAL_API_KEY غير مضبوط على الخادم — أضيفيه في إعدادات الاستضافة ثم أعيدي النشر.',
    BOOKING_CANCELLED: 'هذا الحجز ملغي في Cal.com ولا يمكن تثبيته.'
  };

  /* A status change touches two things: this row, and Cal.com. Reporting
     only the first is what let "مدفوع" look successful while the meeting
     stayed unconfirmed and its time stayed on offer. */
  function statusResultText(picked, calendar) {
    var base = 'تم تحديث الحالة إلى «' + STATUS[picked] + '»';
    if (calendar === 'confirmed') return base + ' — وثُبّت الحجز في التقويم.';
    if (calendar === 'already')   return base + ' — الحجز مثبّت في التقويم أصلًا.';
    if (calendar === 'cancelled') return base + ' — وأُلغي الحجز في التقويم.';
    if (calendar === 'cancel-failed') {
      return base + ' — لكن لم يُلغَ الحجز في التقويم. تحقّقي منه يدويًا.';
    }
    if (calendar === 'none') {
      return base + '، لكن لا يوجد حجز مرتبط بهذا الطلب في Cal.com — لم يتغيّر التقويم ' +
             'ووقت الجلسة ما زال معروضًا. احجزيه يدويًا من Cal.com.';
    }
    return base;
  }

  /* Paid says the money arrived; only cal_status says the calendar agrees.
     Written once because it is rendered from two places. */
  function paidLine(r) {
    return (r.cal_status === 'accepted'
              ? 'الحجز مثبَّت في التقويم'
              : 'مدفوع، لكن الحجز غير مثبّت في التقويم')
         + (r.paid_at ? ' — ' + fmtAgo(r.paid_at) : '');
  }

  function errorText(json) {
    if (!json) return 'حدث خطأ غير متوقّع';

    /* A server that is missing variables should say which ones, in plain
       sight, rather than leaving you reading network logs. */
    if (json.code === 'NOT_CONFIGURED' && json.missing && json.missing.length) {
      return 'الخادم ينقصه: ' + json.missing.join('، ') +
             ' — أضفها في إعدادات الاستضافة ثم أعد النشر.';
    }
    if (json.code === 'BAD_HASH') {
      return 'قيمة ADMIN_PASSWORD_HASH غير صحيحة الشكل. انسخي السطر كاملًا كما طبعه السكربت.';
    }
    /* Keep Cal.com's own wording — the generic line alone leaves you guessing. */
    if (json.code === 'CONFIRM_FAILED' && json.detail) {
      return MSG.CONFIRM_FAILED + ' (' + json.detail + ')';
    }
    return MSG[json.code] || json.message || 'حدث خطأ غير متوقّع';
  }

  function say(message, isError) {
    el.feedback.textContent = message;
    el.feedback.classList.toggle('is-error', !!isError);
    el.feedback.hidden = false;
    window.clearTimeout(say._t);
    say._t = window.setTimeout(function () { el.feedback.hidden = true; }, 5000);
  }

  /* ── formatting ────────────────────────────────────────── */
  function fmtSlot(iso, tz) {
    var d = new Date(iso);
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz || 'Asia/Riyadh', hour12: false,
      year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).formatToParts(d).reduce(function (a, p) { a[p.type] = p.value; return a; }, {});

    var h = parseInt(parts.hour, 10);
    var suffix = h < 12 ? 'ص' : 'م';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    var dow = DOW[new Date(
      parts.year + '-' + String(parts.month).padStart(2, '0') + '-' + String(parts.day).padStart(2, '0') + 'T00:00:00'
    ).getDay()];

    return dow + ' ، ' + parseInt(parts.day, 10) + ' ' + MONTHS[parseInt(parts.month, 10) - 1]
         + ' · ' + h12 + ':' + parts.minute + ' ' + suffix;
  }

  function fmtAgo(iso) {
    var mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return 'قبل ' + mins + ' دقيقة';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return 'قبل ' + hrs + ' ساعة';
    return 'قبل ' + Math.round(hrs / 24) + ' يوم';
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── list ──────────────────────────────────────────────── */
  function counts() {
    var c = { all: rows.length, pending: 0, contacted: 0, paid: 0, cancelled: 0 };
    rows.forEach(function (r) { if (c[r.status] !== undefined) c[r.status]++; });
    Object.keys(c).forEach(function (k) {
      var n = el.tabs.querySelector('[data-count="' + k + '"]');
      if (n) n.textContent = c[k];
    });
  }

  function renderList() {
    var shown = filter === 'all' ? rows : rows.filter(function (r) { return r.status === filter; });

    el.list.innerHTML = '';
    el.empty.hidden = shown.length > 0;

    shown.forEach(function (r, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'row';
      b.style.setProperty('--i', i);
      b.dataset.id = r.id;
      b.innerHTML =
        '<span class="row__who">' + esc(r.name) + '</span>' +
        '<span class="row__when">' + esc(fmtSlot(r.starts_at, r.time_zone)) + '</span>' +
        '<span class="chip chip--' + esc(r.status) + '">' + esc(STATUS[r.status] || r.status) + '</span>' +
        '<span class="row__meta">' + esc(r.session_label) + ' · ' + esc(r.service) +
          ' · <span class="row__price">' + esc(r.price) + ' ريال</span>' +
          ' · ' + esc(fmtAgo(r.created_at)) + '</span>';
      el.list.appendChild(b);
    });
    counts();
  }

  function load() {
    return call('list', {}).then(function (out) {
      if (out.status === 401) { showGate(); return; }
      if (!out.json.ok) { say(errorText(out.json), true); return; }
      rows = out.json.rows || [];
      renderList();
      if (openId) {
        var still = rows.filter(function (r) { return r.id === openId; })[0];
        if (still) renderDrawer(still);
      }
    });
  }

  /* ── detail ────────────────────────────────────────────── */
  function kv(k, v) {
    return '<div class="kv"><span class="kv__k">' + k + '</span><span class="kv__v">' + v + '</span></div>';
  }

  function renderDrawer(r) {
    openId = r.id;
    var waDigits = String(r.whatsapp || '').replace(/\D/g, '');
    var msg = encodeURIComponent(
      'مرحباً ' + r.name + '، بخصوص طلب حجزك (' + r.session_label + ') يوم ' +
      fmtSlot(r.starts_at, r.time_zone) + '.'
    );

    var autoAccepted = r.cal_status === 'accepted' && r.status !== 'paid';
    var unlinked = !r.cal_booking_uid;

    /* Plain words for the Cal.com side of the request, because until now
       the only way to know whether a row was linked to a real booking was
       to mark it paid and watch nothing happen. */
    var CAL_STATE = {
      pending:   'بانتظار التثبيت',
      accepted:  'مثبّت',
      cancelled: 'ملغي',
      unlinked:  'غير مرتبط'
    };
    var calState = unlinked ? 'لا يوجد حجز مرتبط'
                            : (CAL_STATE[r.cal_status] || r.cal_status || 'غير معروف');

    el.drawerBody.innerHTML =
      (unlinked
        ? '<div class="warn">' +
            '<strong>تنبيه:</strong> هذا الطلب غير مرتبط بحجز في Cal.com، ' +
            'فلن يؤدّي تغيير الحالة إلى «مدفوع» إلى تثبيت أي موعد، ووقت الجلسة ما زال معروضًا في التقويم. ' +
            'احجزي الموعد يدويًا من Cal.com.' +
          '</div>'
        : '') +
      (autoAccepted
        ? '<div class="warn">' +
            '<strong>تنبيه:</strong> ثبّت Cal.com هذا الحجز فورًا وأرسل التأكيد للعميل قبل الدفع. ' +
            'فعّلي <em>Requires confirmation</em> في نوع الموعد داخل Cal.com حتى تُحجز المواعيد مبدئيًا فقط.' +
          '</div>'
        : '') +
      '<div class="block">' +
        '<h3>الموعد المطلوب</h3>' +
        kv('الجلسة', esc(r.session_label)) +
        kv('الخدمة', esc(r.service)) +
        kv('الموعد', esc(fmtSlot(r.starts_at, r.time_zone))) +
        kv('المدة', r.duration_minutes ? esc(r.duration_minutes) + ' دقيقة' : '—') +
        kv('المبلغ', '<strong>' + esc(r.price) + ' ريال</strong>') +
        kv('حالة التقويم', esc(calState) +
           (r.cal_booking_uid ? ' <small dir="ltr">(' + esc(r.cal_booking_uid) + ')</small>' : '')) +
      '</div>' +

      '<div class="block">' +
        '<h3>بيانات مقدّم الطلب</h3>' +
        kv('الاسم', esc(r.name)) +
        kv('واتساب', '<a href="tel:' + esc(r.whatsapp) + '" dir="ltr">' + esc(r.whatsapp) + '</a>') +
        kv('البريد', '<a href="mailto:' + esc(r.email) + '" dir="ltr">' + esc(r.email) + '</a>') +
        kv('الطفل', r.child ? esc(r.child) : '—') +
        kv('السبب', r.reason ? esc(r.reason) : '—') +
        kv('وصل الطلب', esc(fmtAgo(r.created_at))) +
        '<div style="margin-top:12px">' +
          '<a class="wa" href="https://wa.me/' + esc(waDigits) + '?text=' + msg + '" target="_blank" rel="noopener">' +
            '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>' +
            'مراسلة على واتساب</a>' +
        '</div>' +
      '</div>' +

      '<div class="block">' +
        '<h3>الحالة</h3>' +
        '<div class="status-grid">' +
          ['pending', 'contacted', 'paid', 'cancelled'].map(function (st) {
            return '<button class="status-btn' + (r.status === st ? ' is-on' : '') +
                   (st === 'cancelled' ? ' is-cancel' : '') +
                   '" type="button" data-pick-status="' + st + '">' + STATUS[st] + '</button>';
          }).join('') +
        '</div>' +
        '<p class="status-msg" id="status-msg">' +
          (r.status === 'paid'
            ? esc(paidLine(r))
            : 'اختاري الحالة ثم اضغطي «تطبيق التغيير».') +
        '</p>' +
        '<button class="btn btn--primary btn--block" type="button" id="apply-status" disabled>' +
          'تطبيق التغيير' +
        '</button>' +
      '</div>' +

      '<div class="block">' +
        '<h3>إيصال التحويل</h3>' +
        '<div class="drop" id="drop" tabindex="0" role="button">' +
          (r.receipt_path ? 'اسحب صورة جديدة هنا للاستبدال، أو اضغط للاختيار'
                          : 'اسحب صورة الإيصال هنا، أو اضغط للاختيار') +
          '<br><span style="font-size:12px;color:var(--muted)">PNG أو JPG أو WebP أو PDF · حتى 5 ميجابايت</span>' +
        '</div>' +
        '<input type="file" id="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden>' +
        '<div class="receipt" id="receipt">' +
          (r.receipt_path ? '<button class="btn btn--ghost btn--sm" type="button" id="view-receipt">عرض الإيصال</button>' : '') +
        '</div>' +
      '</div>' +

      '<div class="block">' +
        '<h3>ملاحظات داخلية</h3>' +
        '<textarea class="note" id="note" placeholder="لا يراها العميل">' + esc(r.admin_note || '') + '</textarea>' +
        '<button class="btn btn--ghost btn--sm" type="button" id="save-note" style="margin-top:10px">حفظ الملاحظة</button>' +
      '</div>';

    wireDrawer(r);
    el.drawer.hidden = false;
  }

  /* What choosing each status will actually do, said plainly before it happens. */
  var EFFECT = {
    pending:   'سيُعاد الطلب إلى قائمة الانتظار.',
    contacted: 'للتسجيل فقط — لا يتغيّر شيء في التقويم.',
    paid:      'سيُثبَّت الحجز في تقويمك ويصل العميل إشعار التأكيد. لا تختاريها قبل وصول المبلغ.',
    cancelled: 'سيُلغى الحجز في التقويم ويتحرّر الموعد لغيره.'
  };

  function wireDrawer(r) {
    /* ── status: pick one, read what it does, then apply ── */
    var picked = r.status;
    var apply = el.drawerBody.querySelector('#apply-status');
    var msg = el.drawerBody.querySelector('#status-msg');
    var buttons = el.drawerBody.querySelectorAll('[data-pick-status]');

    function refreshStatusUI() {
      Array.prototype.forEach.call(buttons, function (b) {
        b.classList.toggle('is-on', b.dataset.pickStatus === picked);
      });
      var changed = picked !== r.status;
      apply.disabled = !changed;
      msg.textContent = changed
        ? EFFECT[picked]
        : (r.status === 'paid'
            ? paidLine(r)
            : 'اختاري الحالة ثم اضغطي «تطبيق التغيير».');
      msg.classList.toggle('is-warn', changed && (picked === 'paid' || picked === 'cancelled'));
    }

    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        picked = btn.dataset.pickStatus;
        refreshStatusUI();
      });
    });

    apply.addEventListener('click', function () {
      if (picked === r.status) return;
      apply.disabled = true;
      apply.textContent = 'جارٍ الحفظ…';

      call('update', { id: r.id, status: picked }).then(function (out) {
        apply.textContent = 'تطبيق التغيير';
        if (!out.json.ok) {
          say(errorText(out.json), true);
          picked = r.status;              /* nothing changed server-side */
          refreshStatusUI();
          return;
        }
        say(statusResultText(picked, out.json.calendar), out.json.calendar === 'none');
        load();
      });
    });

    refreshStatusUI();

    /* receipt */
    var drop = el.drawerBody.querySelector('#drop');
    var file = el.drawerBody.querySelector('#file');

    function send(f) {
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { say('الملف أكبر من 5 ميجابايت', true); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var b64 = String(reader.result).split(',')[1];
        drop.textContent = 'جارٍ الرفع…';
        call('receipt', { id: r.id, contentType: f.type, data: b64 }).then(function (out) {
          if (!out.json.ok) { say(errorText(out.json), true); renderDrawer(r); return; }
          say('تم رفع الإيصال');
          load();
        });
      };
      reader.readAsDataURL(f);
    }

    drop.addEventListener('click', function () { file.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); }
    });
    file.addEventListener('change', function () { send(file.files[0]); });
    ['dragenter', 'dragover'].forEach(function (t) {
      drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function (e) { send(e.dataTransfer.files[0]); });

    var view = el.drawerBody.querySelector('#view-receipt');
    if (view) {
      view.addEventListener('click', function () {
        view.disabled = true;
        call('receipt', { id: r.id }).then(function (out) {
          view.disabled = false;
          if (!out.json.ok) { say(errorText(out.json), true); return; }
          window.open(out.json.url, '_blank', 'noopener');
        });
      });
    }

    /* note */
    var note = el.drawerBody.querySelector('#note');
    var saveNote = el.drawerBody.querySelector('#save-note');
    saveNote.addEventListener('click', function () {
      saveNote.disabled = true;
      call('update', { id: r.id, note: note.value }).then(function (out) {
        saveNote.disabled = false;
        if (!out.json.ok) { say(errorText(out.json), true); return; }
        say('تم حفظ الملاحظة');
        load();
      });
    });
  }

  function closeDrawer() { el.drawer.hidden = true; openId = null; }

  /* ── screens ───────────────────────────────────────────── */
  function showGate() { el.gate.hidden = false; el.app.hidden = true; closeDrawer(); }
  function showApp() { el.gate.hidden = true; el.app.hidden = false; load(); }

  /* ── events ────────────────────────────────────────────── */
  el.loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    el.loginError.hidden = true;
    el.loginBtn.classList.add('is-busy');
    el.loginBtn.disabled = true;

    call('login', { password: el.pw.value }).then(function (out) {
      el.loginBtn.classList.remove('is-busy');
      el.loginBtn.disabled = false;
      if (out.json.ok) { el.pw.value = ''; showApp(); return; }
      el.loginError.textContent = errorText(out.json);
      el.loginError.hidden = false;
    });
  });

  el.logout.addEventListener('click', function () {
    call('logout', {}).then(showGate);
  });
  el.refresh.addEventListener('click', function () {
    load().then(function () { say('تم التحديث'); });
  });

  el.tabs.addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (!tab) return;
    filter = tab.dataset.status;
    el.tabs.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('is-on', t === tab); });
    renderList();
  });

  el.list.addEventListener('click', function (e) {
    var row = e.target.closest('.row');
    if (!row) return;
    var r = rows.filter(function (x) { return x.id === row.dataset.id; })[0];
    if (r) renderDrawer(r);
  });

  el.drawer.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeDrawer();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !el.drawer.hidden) closeDrawer();
  });

  /* ── boot ──────────────────────────────────────────────── */
  call('session', {}).then(function (out) {
    if (out.json && out.json.authed) { showApp(); return; }

    showGate();
    /* If the server is not configured, say so here — otherwise the only
       clue is a 503 in the browser console. */
    if (out.status === 503) {
      el.loginError.textContent = errorText(out.json);
      el.loginError.hidden = false;
      el.pw.disabled = true;
      el.loginBtn.disabled = true;
    }
  }).catch(function () {
    showGate();
    el.loginError.textContent = 'تعذّر الاتصال بالخادم.';
    el.loginError.hidden = false;
  });
})();
