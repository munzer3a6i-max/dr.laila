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

  /* ── language menu ──────────────────────────────────────
     A globe that opens a list of the languages the site speaks,
     rather than a button that silently toggles between two.   */
  var lang = document.getElementById('lang');
  var langBtn = document.getElementById('lang-button');
  var langMenu = document.getElementById('lang-menu');
  var langCode = document.getElementById('lang-code');

  function tick() {
    return '<svg class="lang__tick" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
           '<path d="M2.5 7.5 5.5 10.5 11.5 4" stroke="currentColor" stroke-width="1.6" ' +
           'stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function buildLangMenu() {
    if (!langMenu || !window.Lang) return;
    var current = window.Lang.current;

    langMenu.innerHTML = window.Lang.codes().map(function (code) {
      return '<button class="lang__option" type="button" role="option" lang="' + code + '"' +
             ' data-lang="' + code + '" aria-selected="' + (code === current) + '">' +
             '<span class="lang__name">' + window.Lang.nameOf(code) + '</span>' + tick() +
             '</button>';
    }).join('');

    langCode.textContent = window.Lang.shortOf(current);
    langCode.lang = current;
  }

  function closeLang(refocus) {
    if (!lang || !lang.classList.contains('is-open')) return;
    lang.classList.remove('is-open');
    langBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', outsideLang, true);
    if (refocus) langBtn.focus();
  }

  function outsideLang(e) { if (!lang.contains(e.target)) closeLang(false); }

  function langOptions() {
    return Array.prototype.slice.call(langMenu.querySelectorAll('[data-lang]'));
  }

  function openLang() {
    if (!lang || lang.classList.contains('is-open')) return;
    lang.classList.add('is-open');
    langBtn.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', outsideLang, true);

    /* The panel starts at visibility:hidden and only becomes visible once
       the browser has drawn a frame with .is-open on it — and a hidden
       element refuses focus. Focusing in this tick silently does nothing,
       which left the keyboard stranded on the trigger, so wait a frame. */
    window.requestAnimationFrame(function () {
      if (!lang.classList.contains('is-open')) return;
      var first = langMenu.querySelector('[aria-selected="true"]') || langOptions()[0];
      if (first) first.focus();
    });
  }

  if (lang && window.Lang) {
    buildLangMenu();

    langBtn.addEventListener('click', function () {
      lang.classList.contains('is-open') ? closeLang(false) : openLang();
    });

    langMenu.addEventListener('click', function (e) {
      var opt = e.target.closest('[data-lang]');
      if (!opt) return;
      closeLang(true);
      window.Lang.set(opt.dataset.lang);
    });

    /* One handler for the whole control. Focus can legitimately sit on the
       trigger or on an option, and Escape has to close either way. */
    lang.addEventListener('keydown', function (e) {
      var open = lang.classList.contains('is-open');
      var options = langOptions();
      var i = options.indexOf(document.activeElement);

      if (e.key === 'Escape') {
        if (!open) return;
        e.preventDefault(); closeLang(true);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!open) return openLang();
        (options[i + 1] || options[0]).focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!open) return openLang();
        (i < 0 ? options[options.length - 1] : options[i - 1] || options[options.length - 1]).focus();
      } else if ((e.key === 'Enter' || e.key === ' ') && !open && document.activeElement === langBtn) {
        e.preventDefault(); openLang();
      } else if (e.key === 'Tab' && open) {
        closeLang(false);
      }
    });

    window.Lang.onChange(buildLangMenu);
  }

  /* ── mobile menu ────────────────────────────────────────── */
  var scrim = document.getElementById('nav-scrim');

  function navLabel(open) {
    return window.Lang
      ? window.Lang.t(open ? 'a11y.menuClose' : 'a11y.menuOpen')
      : (open ? 'إغلاق القائمة' : 'فتح القائمة');
  }

  /* each row knows its place in the queue, so CSS can stagger them */
  Array.prototype.forEach.call(nav.children, function (n, i) { n.style.setProperty('--i', i); });

  function setNav(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', navLabel(open));

    /* stop the page scrolling underneath the sheet */
    document.body.classList.toggle('nav-open', open);

    if (scrim) {
      if (open) {
        scrim.hidden = false;
        /* next frame, so the fade actually runs */
        window.requestAnimationFrame(function () { scrim.classList.add('is-on'); });
      } else {
        scrim.classList.remove('is-on');
        window.setTimeout(function () { if (!nav.classList.contains('is-open')) scrim.hidden = true; }, 420);
      }
    }
  }

  function closeNav() { if (nav.classList.contains('is-open')) setNav(false); }

  toggle.addEventListener('click', function () {
    setNav(!nav.classList.contains('is-open'));
  });

  if (scrim) scrim.addEventListener('click', closeNav);

  /* a resize back to desktop should not leave the page locked */
  window.addEventListener('resize', function () {
    if (window.innerWidth > 900) closeNav();
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

    var DURATION = 2000;
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
