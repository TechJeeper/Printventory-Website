(function () {
  function enhanceChangelogMarkdown(text) {
    const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
    const out = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        out.push('');
        continue;
      }

      // Version-only lines (e.g. 2.1.15)
      if (/^\d+\.\d+(?:\.\d+)?$/.test(trimmed)) {
        out.push('', `## ${trimmed}`, '');
        continue;
      }

      // Emoji section titles
      if (/^[✨🚀🐳🛠️🔧⚡🐛🎯📦💡🔒]/.test(trimmed)) {
        out.push('', `### ${trimmed}`, '');
        continue;
      }

      // Top title containing "Changelog"
      if (/changelog/i.test(trimmed) && out.length === 0) {
        out.push(`# ${trimmed}`, '');
        continue;
      }

      // "Title: description" feature lines
      const colonMatch = trimmed.match(/^([A-Za-z][^:\n]{1,60}):\s+(.+)$/);
      if (colonMatch) {
        out.push(`- **${colonMatch[1]}:** ${colonMatch[2]}`);
        continue;
      }

      // Plain changelog item
      out.push(`- ${trimmed}`);
    }

    return out.join('\n');
  }

  function openChangelogModal() {
    const modal = document.getElementById('changelog-modal');
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('changelog-modal-open');
    const closeBtn = modal.querySelector('.changelog-modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeChangelogModal() {
    const modal = document.getElementById('changelog-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('changelog-modal-open');
    const trigger = document.getElementById('changelog-trigger');
    if (trigger) trigger.focus();
  }

  async function loadChangelog(sourceUrl) {
    const content = document.getElementById('changelog-content');
    if (!content) return;

    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error('Failed to fetch changelog');
      const changelog = await response.text();
      const markdown = enhanceChangelogMarkdown(changelog);
      content.innerHTML = marked.parse(markdown);
    } catch (error) {
      content.innerHTML = '<p>Changelog unavailable.</p>';
      console.error('Error fetching changelog:', error);
    }
  }

  function initChangelogModal(sourceUrl) {
    const modal = document.getElementById('changelog-modal');
    const trigger = document.getElementById('changelog-trigger');
    if (!modal || !trigger) return;

    trigger.addEventListener('click', openChangelogModal);
    modal.querySelector('.changelog-modal-backdrop')?.addEventListener('click', closeChangelogModal);
    modal.querySelector('.changelog-modal-close')?.addEventListener('click', closeChangelogModal);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) {
        closeChangelogModal();
      }
    });

    loadChangelog(sourceUrl);
  }

  window.initChangelogModal = initChangelogModal;
})();
