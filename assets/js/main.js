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

  /* ── mobile nav ─────────────────────────────────────────── */
  function closeNav() {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'فتح القائمة');
  }

  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
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

    Array.prototype.forEach.call(items, function (n, i) {
      n.style.transitionDelay = Math.min(i % 5, 4) * 70 + 'ms';
      io.observe(n);
    });
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
