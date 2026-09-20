/* ============================================================
   Site chrome — sticky header, mobile nav, scroll-spy, reveals
   ============================================================ */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  var nav    = document.getElementById('primary-nav');
  var toggle = document.querySelector('.nav-toggle');

  /* ── sticky header shadow ───────────────────────────────── */
  var onScroll = function () {
    header.classList.toggle('is-stuck', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── language switch ────────────────────────────────────── */
  var langBtn = document.getElementById('lang-switch');
  var langLabel = document.getElementById('lang-switch-label');

  function paintLangButton() {
    if (!window.Lang || !langBtn) return;
    var target = window.Lang.next();
    /* show, and announce, the language you would switch TO */
    langLabel.textContent = target === 'ar' ? 'ع' : 'EN';
    langLabel.lang = target;
    langBtn.setAttribute('lang', target);
    langBtn.setAttribute(
      'aria-label',
      target === 'ar' ? 'التبديل إلى العربية' : 'Switch to English'
    );
  }

  if (langBtn && window.Lang) {
    langBtn.addEventListener('click', function () { window.Lang.set(window.Lang.next()); });
    window.Lang.onChange(paintLangButton);
    paintLangButton();
  }

  /* ── mobile nav ─────────────────────────────────────────── */
  function navLabel(open) {
    return window.Lang
      ? window.Lang.t(open ? 'a11y.menuClose' : 'a11y.menuOpen')
      : (open ? 'إغلاق القائمة' : 'فتح القائمة');
  }

  function closeNav() {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', navLabel(false));
  }

  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', navLabel(open));
  });

  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') closeNav();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      closeNav();
      toggle.focus();
    }
  });

  document.addEventListener('click', function (e) {
    if (!nav.classList.contains('is-open')) return;
    if (nav.contains(e.target) || toggle.contains(e.target)) return;
    closeNav();
  });

  /* ── motion ─────────────────────────────────────────────
     CSS owns the animation; JS only decides when it starts and
     hands each child its position in the queue.                */
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* index every staggered child so CSS can offset its delay */
  function indexChildren(container) {
    var kids = container.children, i;
    for (i = 0; i < kids.length; i++) kids[i].style.setProperty('--i', i);
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-stagger], [data-enter]'), indexChildren);

  /* the hero and header come in on load, not on scroll */
  function ready() { document.body.classList.add('is-ready'); }
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready);
  /* belt and braces: never leave the hero invisible if load is slow */
  window.setTimeout(ready, 1200);

  /* ── scroll reveal ──────────────────────────────────────── */
  var items = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(items, function (n) { n.classList.add('is-static'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    Array.prototype.forEach.call(items, function (n) { io.observe(n); });
  }

  /* ── stat counters ──────────────────────────────────────
     "+400" counts up the first time it scrolls into view.    */
  function countUp(el) {
    var raw = el.textContent.trim();
    var m = raw.match(/^(\D*)(\d+)(\D*)$/);
    if (!m) return;

    var prefix = m[1], target = parseInt(m[2], 10), suffix = m[3];
    if (calm || !target) { return; }

    var DURATION = 1100;
    var started = null;

    function frame(now) {
      if (started === null) started = now;
      var t = Math.min((now - started) / DURATION, 1);
      var eased = 1 - Math.pow(1 - t, 3);          /* ease-out cubic */
      el.textContent = prefix + Math.round(target * eased) + suffix;
      if (t < 1) window.requestAnimationFrame(frame);
    }

    el.textContent = prefix + '0' + suffix;
    window.requestAnimationFrame(frame);
  }

  var stats = document.querySelectorAll('.stat dt');
  if (stats.length && 'IntersectionObserver' in window && window.requestAnimationFrame) {
    var statIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        statIO.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(stats, function (n) { statIO.observe(n); });
  }

  /* ── scroll-spy on the nav ──────────────────────────────── */
  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (s) { spy.observe(s); });
  }
})();
