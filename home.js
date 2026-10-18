/* Homepage: screenshot tour, lightbox, "What's new" from public.change, download links. */
(function () {
  const PV = window.Printventory;

  /* ---------- Screenshot tour (ARIA tabs) ---------- */
  const tabs = Array.from(document.querySelectorAll('.tour-tabs [role="tab"]'));
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      const selected = t === tab;
      t.setAttribute('aria-selected', selected ? 'true' : 'false');
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab); });
    tab.addEventListener('keydown', function (e) {
      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') next = tabs[0];
      if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); selectTab(next, true); }
    });
  });

  /* ---------- Lightbox ---------- */
  const dialog = document.getElementById('lightbox');
  const dialogImg = document.getElementById('lightbox-img');
  if (dialog && typeof dialog.showModal === 'function') {
    document.querySelectorAll('.tour-zoom').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const img = btn.querySelector('img');
        dialogImg.src = btn.getAttribute('data-full');
        dialogImg.alt = img ? img.alt : '';
        dialog.showModal();
      });
    });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  }

  /* ---------- What's new ---------- */
  const grid = document.getElementById('whatsnew');
  const more = document.getElementById('whatsnew-more');
  const MAX_ITEMS = 6;

  PV.loadChangelog('public.change')
    .then(function (releases) {
      const latest = releases[0];
      if (!latest) throw new Error('empty changelog');

      const items = [];
      latest.sections.forEach(function (s) { items.push.apply(items, s.items); });

      grid.replaceChildren();
      items.slice(0, MAX_ITEMS).forEach(function (item) {
        const card = document.createElement('article');
        card.className = 'whatsnew-item';
        const h = document.createElement('h3');
        const p = document.createElement('p');
        if (item.title) { h.textContent = item.title; p.textContent = item.text; card.append(h, p); }
        else { p.textContent = item.text; card.append(p); }
        grid.appendChild(card);
      });

      if (latest.version) {
        document.getElementById('whatsnew-version').textContent = 'v' + latest.version;
      }
      if (items.length > MAX_ITEMS) {
        more.textContent = '+ ' + (items.length - MAX_ITEMS) + ' more in this release';
      }
    })
    .catch(function (err) {
      console.error('What’s new failed:', err);
      const p = document.createElement('p');
      p.className = 'changelog-status';
      p.textContent = 'Couldn’t load the latest changes. See the full changelog on the download page.';
      grid.replaceChildren(p);
    });

  hydrateDownloadLinks({ channel: 'public' });
})();
