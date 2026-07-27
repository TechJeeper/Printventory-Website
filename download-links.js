/**
 * Hydrate platform download anchors from version + URL template files.
 * Anchors should already have working fallback hrefs for no-JS / failed fetch.
 *
 * @param {object} options
 * @param {string} options.versionFile - e.g. 'public.version'
 * @param {string} options.urlExt - e.g. 'pub' or 'beta'
 * @param {string} options.placeholder - e.g. 'public.version' or 'beta.version'
 * @param {string} [options.versionElId] - optional element to show version text
 * @returns {Promise<string|null>} resolved version or null on failure
 */
async function hydrateDownloadLinks({ versionFile, urlExt, placeholder, versionElId }) {
  try {
    const versionResponse = await fetch(versionFile);
    const version = (await versionResponse.text()).trim();

    if (versionElId) {
      const versionEl = document.getElementById(versionElId);
      if (versionEl) versionEl.textContent = version;
    }

    const platforms = ['win', 'mac', 'linux'];
    await Promise.all(
      platforms.map(async (platform) => {
        try {
          const urlResponse = await fetch(`${platform}.${urlExt}`);
          let url = (await urlResponse.text()).trim();
          url = url.replace(`{${placeholder}}`, version);
          const element = document.getElementById(`download-${platform}`);
          if (element) element.href = url;
        } catch (e) {
          console.error(`Error updating ${platform} link:`, e);
        }
      })
    );

    return version;
  } catch (e) {
    console.error('Error fetching version:', e);
    if (versionElId) {
      const versionEl = document.getElementById(versionElId);
      if (versionEl) versionEl.textContent = 'Version information unavailable';
    }
    return null;
  }
}
