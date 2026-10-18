/**
 * Parse and render the plain-text changelogs (public.change / beta.change).
 *
 * Accepted input (as written by the release tooling):
 *   3.0.0                                 <- a bare version line starts a release
 *   Title — description                   <- an item with a bold title (also " - " or ": ")
 *   Plain sentence                        <- an item without a title
 *   Printventory 2.1 Changelog            <- legacy release header
 *   ✨ New Features & UI Additions        <- legacy emoji section header inside a release
 *
 * Everything is rendered with textContent, so changelog text is never parsed as HTML.
 * Requires site.js (Printventory.fetchText).
 */
(function () {
  const PV = (window.Printventory = window.Printventory || {});

  const VERSION_LINE = /^v?(\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.]+)?)$/;
  const LEGACY_HEADER = /^printventory\s+v?(\d+\.\d+(?:\.\d+)?)\s+changelog$/i;
  const SECTION_LINE = /^[^\p{L}\p{N}"'(\[*•-]/u;
  const SEPARATORS = [' — ', ' – ', ' - ', ': '];

  function splitItem(line) {
    let best = null;
    SEPARATORS.forEach(function (sep) {
      const i = line.indexOf(sep);
      if (i > 1 && i <= 60 && (best === null || i < best.i)) best = { i: i, sep: sep };
    });
    if (!best) return { title: '', text: line };
    const rest = line.slice(best.i + best.sep.length).trim();
    if (!rest) return { title: '', text: line };
    return { title: line.slice(0, best.i).trim(), text: rest };
  }

  PV.parseChangelog = function (text) {
    const releases = [];
    let release = null;
    let section = null;

    function startRelease(version) {
      release = { version: version, sections: [] };
      section = null;
      releases.push(release);
    }

    text.replace(/\r\n?/g, '\n').split('\n').forEach(function (raw) {
      const line = raw.trim();
      if (!line) return;

      const m = line.match(VERSION_LINE) || line.match(LEGACY_HEADER);
      if (m) { startRelease(m[1]); return; }

      if (!release) startRelease(null);

      if (SECTION_LINE.test(line) && line.length < 80) {
        section = { title: line, items: [] };
        release.sections.push(section);
        return;
      }

      if (!section) {
        section = { title: '', items: [] };
        release.sections.push(section);
      }
      section.items.push(splitItem(line.replace(/^[-*•]\s+/, '')));
    });

    return releases
      .map(function (r) {
        r.sections = r.sections.filter(function (s) { return s.items.length; });
        r.count = r.sections.reduce(function (n, s) { return n + s.items.length; }, 0);
        return r;
      })
      .filter(function (r) { return r.count; });
  };

  PV.loadChangelog = function (source) {
    return PV.fetchText(source).then(PV.parseChangelog);
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  PV.renderItem = function (item, tag) {
    const li = el(tag || 'li');
    if (item.title) {
      li.appendChild(el('strong', null, item.title));
      li.appendChild(document.createTextNode(' — ' + item.text));
    } else {
      li.textContent = item.text;
    }
    return li;
  };

  function renderRelease(release, index, channel) {
    const details = el('details', 'release' + (index === 0 ? ' release--latest' : ''));
    if (release.version) details.id = 'v' + release.version.replace(/[^0-9A-Za-z]+/g, '-');
    if (index === 0) details.open = true;

    const summary = el('summary');
    summary.appendChild(el('span', 'release-num', release.version ? 'v' + release.version : 'Latest changes'));
    if (index === 0) {
      summary.appendChild(el('span', 'version-tag' + (channel === 'beta' ? ' version-tag--beta' : ''), channel === 'beta' ? 'Latest beta' : 'Latest'));
    }
    summary.appendChild(el('span', 'release-count', release.count + (release.count === 1 ? ' change' : ' changes')));
    details.appendChild(summary);

    const body = el('div', 'release-body');
    release.sections.forEach(function (section) {
      if (section.title) body.appendChild(el('h4', null, section.title));
      const ul = el('ul');
      section.items.forEach(function (item) { ul.appendChild(PV.renderItem(item)); });
      body.appendChild(ul);
    });
    details.appendChild(body);
    return details;
  }

  /**
   * @param {HTMLElement} container
   * @param {string} source e.g. 'public.change'
   * @param {{channel?: 'public'|'beta', initial?: number}} [options]
   */
  PV.renderChangelog = function (container, source, options) {
    options = options || {};
    const initial = options.initial || 6;
    container.setAttribute('aria-busy', 'true');

    return PV.loadChangelog(source)
      .then(function (releases) {
        container.replaceChildren();
        if (!releases.length) {
          container.appendChild(el('p', 'changelog-status', 'No changelog entries yet.'));
          return releases;
        }

        const hidden = [];
        releases.forEach(function (release, i) {
          const node = renderRelease(release, i, options.channel);
          if (i >= initial) { node.hidden = true; hidden.push(node); }
          container.appendChild(node);
        });

        if (hidden.length) {
          const more = el('button', 'btn btn--ghost changelog-more', 'Show ' + hidden.length + ' older release' + (hidden.length === 1 ? '' : 's'));
          more.type = 'button';
          more.addEventListener('click', function () {
            hidden.forEach(function (node) { node.hidden = false; });
            more.remove();
            hidden[0].querySelector('summary').focus();
          });
          container.appendChild(more);
        }

        // Deep link like beta.html#v2-2-27 opens and scrolls to that release
        if (location.hash) {
          const target = container.querySelector(location.hash.replace(/[^#\w-]/g, ''));
          if (target && target.tagName === 'DETAILS') {
            target.hidden = false;
            target.open = true;
            target.scrollIntoView();
          }
        }
        return releases;
      })
      .catch(function (err) {
        console.error('Changelog failed:', err);
        container.replaceChildren(el('p', 'changelog-status', 'The changelog could not be loaded right now. Please try again in a moment.'));
        return [];
      })
      .finally(function () { container.removeAttribute('aria-busy'); });
  };
})();
