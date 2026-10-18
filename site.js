/**
 * Shared site behaviour: mobile nav, header state, scroll reveals,
 * version tags (from *.version files) and the supporters line in the footer.
 */
(function () {
  const PV = (window.Printventory = window.Printventory || {});
  document.documentElement.classList.remove('no-js');

  /* ---------- Release data (served from this repo) ---------- */
  const versionCache = {};

  PV.fetchText = function (path) {
    // no-cache: revalidate so a fresh version bump shows up without waiting on CDN max-age
    return fetch(path, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error(path + ' returned ' + res.status);
      return res.text();
    });
  };

  /** @param {'public'|'beta'} channel */
  PV.loadVersion = function (channel) {
    if (!versionCache[channel]) {
      versionCache[channel] = PV.fetchText(channel + '.version').then(function (text) {
        const version = text.trim();
        if (!/^\d+(\.\d+)*([-+.][0-9A-Za-z.]+)?$/.test(version)) {
          throw new Error('Unexpected version string in ' + channel + '.version');
        }
        return version;
      });
    }
    return versionCache[channel];
  };

  function hydrateVersionTags() {
    const els = document.querySelectorAll('[data-version-of]');
    const channels = new Set();
    els.forEach(function (el) { channels.add(el.getAttribute('data-version-of')); });
    channels.forEach(function (channel) {
      PV.loadVersion(channel)
        .then(function (version) {
          document.querySelectorAll('[data-version-of="' + channel + '"]').forEach(function (el) {
            el.textContent = (el.getAttribute('data-prefix') || '') + version;
          });
        })
        .catch(function (err) { console.error('Version lookup failed:', err); });
    });
  }

  /* ---------- Navigation ---------- */
  function initNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('site-nav');
    const header = document.querySelector('.site-header');

    if (toggle && nav) {
      const setOpen = function (open) {
        nav.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        document.body.classList.toggle('nav-open', open);
      };
      toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('is-open')); });
      nav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
      });
      window.matchMedia('(min-width: 901px)').addEventListener('change', function (e) { if (e.matches) setOpen(false); });
    }

    if (header) {
      const onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Supporters (footer) ---------- */
  function initSupporters() {
    const el = document.getElementById('supporters');
    if (!el) return;
    PV.fetchText('supporters.list')
      .then(function (text) {
        const names = text.split(/\r?\n/).map(function (n) { return n.trim(); }).filter(Boolean);
        if (!names.length) return;
        const label = document.createElement('strong');
        label.textContent = 'Thank you, supporters: ';
        const list = document.createElement('span');
        list.className = 'names';
        names.forEach(function (name, i) {
          if (i) list.appendChild(document.createTextNode(' · '));
          const span = document.createElement('span');
          span.textContent = name;
          list.appendChild(span);
        });
        el.replaceChildren(label, list);
        el.hidden = false;
      })
      .catch(function (err) { console.error('Supporters list failed:', err); });
  }

  function init() {
    initNav();
    initReveal();
    hydrateVersionTags();
    initSupporters();
    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
