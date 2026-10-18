/* FAQ: live search, section highlighting in the sidebar, and deep links to questions. */
(function () {
  const input = document.getElementById('faq-filter');
  const empty = document.getElementById('faq-empty');
  const groups = Array.from(document.querySelectorAll('.faq-group'));
  const items = Array.from(document.querySelectorAll('.faq-item'));
  const tocLinks = Array.from(document.querySelectorAll('.faq-toc a'));

  items.forEach(function (item) { item.dataset.search = item.textContent.toLowerCase(); });

  function filter() {
    const terms = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let shown = 0;
    items.forEach(function (item) {
      const match = terms.every(function (t) { return item.dataset.search.indexOf(t) !== -1; });
      item.hidden = !match;
      if (terms.length) item.open = match;
      if (match) shown++;
    });
    if (!terms.length) items.forEach(function (item) { item.open = false; });
    groups.forEach(function (g) { g.hidden = !g.querySelector('.faq-item:not([hidden])'); });
    empty.hidden = shown > 0;
  }
  if (input) input.addEventListener('input', filter);

  function openFromHash() {
    if (!location.hash) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target && target.classList.contains('faq-item')) {
      target.open = true;
      target.scrollIntoView();
    }
  }
  openFromHash();
  window.addEventListener('hashchange', openFromHash);

  if ('IntersectionObserver' in window && tocLinks.length) {
    const byId = {};
    tocLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        tocLinks.forEach(function (a) { a.classList.remove('is-active'); });
        const link = byId[entry.target.id];
        if (link) link.classList.add('is-active');
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    groups.forEach(function (g) { io.observe(g); });
  }
})();
