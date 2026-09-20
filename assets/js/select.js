/* ============================================================
   Custom select
   ------------------------------------------------------------
   A native <select> opens an OS-drawn popup that CSS cannot
   touch — no radius, no brand colours, no animation. This
   replaces that popup with a real listbox element.

   The native <select> stays in the DOM as the source of truth:
   it still holds the value, still submits with the form, and
   still fires `change`, so nothing else has to know this exists.
   Options are mirrored live, so rebuilding them (a language
   switch, say) needs no extra call.

   Keyboard: ↑ ↓ Home End to move, Enter/Space to choose,
   Esc to dismiss, plus type-ahead. Follows the ARIA combobox
   pattern with aria-activedescendant.
   ============================================================ */
(function () {
  'use strict';

  var uid = 0;

  function svg(paths, cls) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('viewBox', '0 0 14 14');
    el.setAttribute('fill', 'none');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('class', cls);
    paths.forEach(function (d) {
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '1.5');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      el.appendChild(p);
    });
    return el;
  }

  function enhance(select) {
    var wrap = select.closest('.select-wrap');
    if (!wrap || select.dataset.enhanced) return;
    select.dataset.enhanced = '1';

    var id = 'cselect-' + (++uid);

    /* ── shell ─────────────────────────────────────────── */
    var root = document.createElement('div');
    root.className = 'cselect';

    var button = document.createElement('button');
    button.type = 'button';
    button.id = id + '-button';
    button.className = 'cselect__button';
    button.setAttribute('role', 'combobox');
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', id + '-list');

    var valueEl = document.createElement('span');
    valueEl.className = 'cselect__value';
    button.appendChild(valueEl);
    button.appendChild(svg(['M3 5.25 7 9.25l4-4'], 'cselect__chevron'));

    var panel = document.createElement('div');
    panel.id = id + '-list';
    panel.className = 'cselect__panel';
    panel.setAttribute('role', 'listbox');

    root.appendChild(button);
    root.appendChild(panel);
    wrap.appendChild(root);
    wrap.classList.add('is-enhanced');

    /* the native control keeps the value but leaves the tab order */
    select.setAttribute('tabindex', '-1');
    select.setAttribute('aria-hidden', 'true');

    /* name the button from the field's existing label */
    var label = document.querySelector('label[for="' + select.id + '"]');
    if (label) {
      if (!label.id) label.id = id + '-label';
      button.setAttribute('aria-labelledby', label.id);
      panel.setAttribute('aria-labelledby', label.id);
    }

    var active = -1;
    var typed = '';
    var typedAt = 0;

    function options() { return panel.querySelectorAll('.cselect__option'); }

    function syncValue() {
      var picked = select.options[select.selectedIndex];
      valueEl.textContent = picked ? picked.textContent : '';
    }

    function render() {
      panel.innerHTML = '';
      Array.prototype.forEach.call(select.options, function (opt, i) {
        var row = document.createElement('div');
        row.id = id + '-opt-' + i;
        row.className = 'cselect__option';
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', i === select.selectedIndex ? 'true' : 'false');
        row.dataset.index = i;
        row.style.setProperty('--i', i);

        var text = document.createElement('span');
        text.className = 'cselect__label';
        text.textContent = opt.textContent;
        row.appendChild(text);
        row.appendChild(svg(['M2.5 7.5 5.5 10.5 11.5 4'], 'cselect__check'));

        panel.appendChild(row);
      });
      syncValue();
    }

    function setActive(i) {
      var all = options();
      if (!all.length) return;
      active = Math.max(0, Math.min(i, all.length - 1));
      Array.prototype.forEach.call(all, function (row, n) {
        row.classList.toggle('is-active', n === active);
      });
      button.setAttribute('aria-activedescendant', all[active].id);
      all[active].scrollIntoView({ block: 'nearest' });
    }

    function isOpen() { return root.classList.contains('is-open'); }

    function open() {
      if (isOpen() || !select.options.length) return;

      /* drop upward when there is not enough room below */
      var rect = button.getBoundingClientRect();
      var below = window.innerHeight - rect.bottom;
      root.classList.toggle('is-up', below < 260 && rect.top > below);

      root.classList.add('is-open');
      button.setAttribute('aria-expanded', 'true');
      setActive(select.selectedIndex < 0 ? 0 : select.selectedIndex);
      document.addEventListener('mousedown', onOutside, true);
    }

    function close(refocus) {
      if (!isOpen()) return;
      root.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
      button.removeAttribute('aria-activedescendant');
      document.removeEventListener('mousedown', onOutside, true);
      if (refocus) button.focus();
    }

    function commit(i) {
      if (i < 0 || i >= select.options.length) return;
      if (i !== select.selectedIndex) {
        select.selectedIndex = i;
        /* let everything already listening to the native control react */
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      render();
      close(true);
    }

    function onOutside(e) {
      if (!root.contains(e.target)) close(false);
    }

    /* ── pointer ───────────────────────────────────────── */
    button.addEventListener('click', function () { isOpen() ? close(false) : open(); });

    panel.addEventListener('click', function (e) {
      var row = e.target.closest('.cselect__option');
      if (row) commit(parseInt(row.dataset.index, 10));
    });

    panel.addEventListener('mousemove', function (e) {
      var row = e.target.closest('.cselect__option');
      if (row) setActive(parseInt(row.dataset.index, 10));
    });

    /* ── keyboard ──────────────────────────────────────── */
    button.addEventListener('keydown', function (e) {
      var count = select.options.length;

      if (!isOpen()) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); setActive(active + 1); break;
        case 'ArrowUp':   e.preventDefault(); setActive(active - 1); break;
        case 'Home':      e.preventDefault(); setActive(0); break;
        case 'End':       e.preventDefault(); setActive(count - 1); break;
        case 'Enter':
        case ' ':         e.preventDefault(); commit(active); break;
        case 'Escape':    e.preventDefault(); close(true); break;
        case 'Tab':       close(false); break;
        default:
          /* type-ahead, works the same in Arabic and English */
          if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
          var now = Date.now();
          typed = (now - typedAt < 900) ? typed + e.key : e.key;
          typedAt = now;
          for (var i = 0; i < count; i++) {
            if (select.options[i].textContent.trim().toLowerCase()
                  .indexOf(typed.toLowerCase()) === 0) {
              setActive(i);
              break;
            }
          }
      }
    });

    window.addEventListener('resize', function () { close(false); });

    /* ── stay in step with the native control ──────────── */
    select.addEventListener('change', function () { render(); });

    /* options are rebuilt on a language switch — mirror that automatically */
    if (window.MutationObserver) {
      new MutationObserver(function () { render(); })
        .observe(select, { childList: true, subtree: true, characterData: true });
    }

    render();
  }

  function init() {
    Array.prototype.forEach.call(
      document.querySelectorAll('.select-wrap > select'),
      enhance
    );
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
