/**
 * Hydrate platform download links from the version + URL template files.
 *
 *   {channel}.version          e.g. public.version -> "3.0.0"
 *   {platform}.{ext}           e.g. win.pub -> "https://…/Printventory-Setup-{public.version}.exe"
 *
 * Links opt in with data-download="win|mac|linux" (or the legacy id="download-win" etc.)
 * and keep a working fallback href in the HTML for no-JS / failed fetches.
 * data-download="auto" links point at whichever platform the visitor appears to be on.
 *
 * Requires site.js (Printventory.fetchText / loadVersion).
 */
(function () {
  const PV = (window.Printventory = window.Printventory || {});
  const PLATFORMS = ['win', 'mac', 'linux'];
  const LABELS = { win: 'Windows', mac: 'macOS', linux: 'Linux' };

  PV.detectPlatform = function () {
    const uaData = navigator.userAgentData;
    const source = ((uaData && uaData.platform) || navigator.platform || '') + ' ' + navigator.userAgent;
    if (/android|iphone|ipad|ipod|cros/i.test(source)) return null;
    if (/win/i.test(source)) return 'win';
    if (/mac/i.test(source)) return 'mac';
    if (/linux|x11/i.test(source)) return 'linux';
    return null;
  };

  function fileName(url) {
    try { return decodeURIComponent(new URL(url).pathname.split('/').pop()); } catch (e) { return ''; }
  }

  function linksFor(platform) {
    const nodes = Array.from(document.querySelectorAll('[data-download="' + platform + '"]'));
    const legacy = document.getElementById('download-' + platform);
    if (legacy && nodes.indexOf(legacy) === -1) nodes.push(legacy);
    return nodes;
  }

  function applyDetectedPlatform(urls) {
    const platform = PV.detectPlatform();
    document.querySelectorAll('.platform[data-platform]').forEach(function (card) {
      card.classList.toggle('is-detected', card.getAttribute('data-platform') === platform);
    });
    if (!platform) return;
    document.querySelectorAll('[data-download="auto"]').forEach(function (a) {
      const fallback = linksFor(platform)[0];
      const href = (urls && urls[platform]) || (fallback && fallback.href);
      if (href) a.href = href;
      const label = a.querySelector('[data-auto-label]');
      if (label) label.textContent = 'Download for ' + LABELS[platform];
      a.setAttribute('data-goatcounter-click', 'download-hero-' + platform);
    });
  }

  /**
   * @param {object} [options]
   * @param {'public'|'beta'} [options.channel='public']
   * @param {string} [options.versionElId] legacy: element id to receive the version text
   * @returns {Promise<string|null>} the resolved version, or null on failure
   */
  async function hydrateDownloadLinks(options) {
    options = options || {};
    const channel = options.channel || (options.urlExt === 'beta' ? 'beta' : 'public');
    const ext = channel === 'beta' ? 'beta' : 'pub';
    const placeholder = '{' + channel + '.version}';
    const urls = {};

    try {
      const version = await PV.loadVersion(channel);
      if (options.versionElId) {
        const el = document.getElementById(options.versionElId);
        if (el) el.textContent = version;
      }

      await Promise.all(PLATFORMS.map(async function (platform) {
        try {
          const template = (await PV.fetchText(platform + '.' + ext)).trim();
          const url = template.split(placeholder).join(version);
          if (!/^https:\/\//.test(url)) throw new Error('Unexpected URL in ' + platform + '.' + ext);
          urls[platform] = url;
          linksFor(platform).forEach(function (a) { a.href = url; });
          document.querySelectorAll('[data-file-for="' + platform + '"]').forEach(function (el) {
            el.textContent = fileName(url);
          });
        } catch (e) {
          console.error('Error updating ' + platform + ' link:', e);
        }
      }));

      applyDetectedPlatform(urls);
      return version;
    } catch (e) {
      console.error('Error fetching version:', e);
      applyDetectedPlatform(null);
      return null;
    }
  }

  window.hydrateDownloadLinks = hydrateDownloadLinks;
})();
