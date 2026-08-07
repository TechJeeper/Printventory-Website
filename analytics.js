/**
 * Unlisted Printventory usage analytics (GoatCounter /app/open).
 * Title format expected: "Printventory 2.1.21 (win32, 680 models)"
 */
(function () {
  const API_BASE = 'https://printventory.goatcounter.com/api/v0';
  const API_TOKEN = '169ssqdeyc5lg10bsue1i5bqoj1n2m1e60rspaeucztbpi4nmk6';
  const TRACK_PATH = '/app/open';
  const TITLE_RE = /Printventory\s+([\d.]+)\s*\(([^,)]+),\s*([\d,]+)\s*models?\)/i;
  const PATH_VERSION_RE = /^\/app\/open\/([\d.]+)/i;
  const REQUEST_GAP_MS = 350;

  const PLATFORM_LABELS = {
    win32: 'Windows',
    windows: 'Windows',
    darwin: 'macOS',
    macos: 'macOS',
    mac: 'macOS',
    linux: 'Linux',
  };

  const els = {
    periods: document.getElementById('analytics-periods'),
    updated: document.getElementById('analytics-updated'),
    status: document.getElementById('analytics-status'),
    opens: document.getElementById('kpi-opens'),
    versions: document.getElementById('kpi-versions'),
    countries: document.getElementById('kpi-countries'),
    models: document.getElementById('kpi-models'),
    opensHint: document.getElementById('kpi-opens-hint'),
    versionsHint: document.getElementById('kpi-versions-hint'),
    countriesHint: document.getElementById('kpi-countries-hint'),
    modelsHint: document.getElementById('kpi-models-hint'),
    chart: document.getElementById('opens-chart'),
    versionsList: document.getElementById('versions-list'),
    platformsList: document.getElementById('platforms-list'),
    map: document.getElementById('world-map'),
    mapTooltip: document.getElementById('map-tooltip'),
    countriesList: document.getElementById('countries-list'),
  };

  let activeDays = 30;
  let queue = Promise.resolve();
  let highlightCode = null;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function enqueue(fn) {
    const run = queue.then(fn, fn);
    queue = run.then(
      () => sleep(REQUEST_GAP_MS),
      () => sleep(REQUEST_GAP_MS)
    );
    return run;
  }

  async function apiGet(path, params = {}) {
    return enqueue(async () => {
      const url = new URL(API_BASE + path);
      Object.entries(params).forEach(([key, value]) => {
        if (value == null || value === '') return;
        if (Array.isArray(value)) {
          value.forEach((item) => url.searchParams.append(key, item));
        } else {
          url.searchParams.set(key, value);
        }
      });

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: 'Bearer ' + API_TOKEN,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.errors || ('HTTP ' + res.status));
      }
      return data;
    });
  }

  function rangeForDays(days) {
    const end = new Date();
    end.setMinutes(0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    return {
      start: start.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      end: end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };
  }

  function formatNumber(n) {
    return new Intl.NumberFormat('en-US').format(n || 0);
  }

  function platformLabel(raw) {
    const key = String(raw || '').trim().toLowerCase();
    return PLATFORM_LABELS[key] || (raw ? String(raw).trim() : 'Unknown');
  }

  function parseTitle(title, path) {
    const fromTitle = TITLE_RE.exec(title || '');
    if (fromTitle) {
      return {
        version: fromTitle[1],
        platform: platformLabel(fromTitle[2]),
        models: parseInt(fromTitle[3].replace(/,/g, ''), 10) || 0,
      };
    }

    const fromPath = PATH_VERSION_RE.exec(path || '');
    if (fromPath) {
      return { version: fromPath[1], platform: 'Unknown', models: 0 };
    }

    return null;
  }

  function isAppOpenPath(path) {
    if (!path) return false;
    return path === TRACK_PATH || path.startsWith(TRACK_PATH + '/');
  }

  async function fetchAllHits(range) {
    const hits = [];
    const exclude = [];
    let more = true;

    while (more) {
      const page = await apiGet('/stats/hits', {
        start: range.start,
        end: range.end,
        limit: 100,
        exclude_paths: exclude.length ? exclude : undefined,
      });
      const batch = page.hits || [];
      hits.push(...batch);
      more = !!page.more && batch.length;
      batch.forEach((hit) => {
        if (hit.path_id != null) exclude.push(String(hit.path_id));
      });
      if (!batch.length) break;
    }

    return hits;
  }

  function buildSeries(stats) {
    if (!Array.isArray(stats)) return [];
    return stats.map((day) => ({
      day: day.day,
      count: day.daily || 0,
    }));
  }

  function mergeSeries(seriesList) {
    const map = new Map();
    seriesList.forEach((series) => {
      series.forEach(({ day, count }) => {
        map.set(day, (map.get(day) || 0) + count);
      });
    });
    return Array.from(map.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  function aggregateOpenHits(hits) {
    const openHits = hits.filter((hit) => isAppOpenPath(hit.path));
    const versions = new Map();
    const platforms = new Map();
    const modelSamples = [];
    const seriesParts = [];
    let opens = 0;
    const pathIds = [];

    openHits.forEach((hit) => {
      const count = hit.count || 0;
      opens += count;
      if (hit.path_id != null) pathIds.push(String(hit.path_id));
      seriesParts.push(buildSeries(hit.stats));

      const meta = parseTitle(hit.title, hit.path) || {
        version: 'Unknown',
        platform: 'Unknown',
        models: 0,
      };

      versions.set(meta.version, (versions.get(meta.version) || 0) + count);
      platforms.set(meta.platform, (platforms.get(meta.platform) || 0) + count);
      if (meta.models > 0) modelSamples.push(meta.models);
    });

    const toSorted = (map) =>
      Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const avgModels =
      modelSamples.length > 0
        ? Math.round(modelSamples.reduce((a, b) => a + b, 0) / modelSamples.length)
        : 0;

    return {
      opens,
      pathIds,
      series: mergeSeries(seriesParts),
      versions: toSorted(versions),
      platforms: toSorted(platforms),
      avgModels,
      modelSamples,
    };
  }

  function setStatus(message, isError) {
    if (!els.status) return;
    els.status.textContent = message || '';
    els.status.classList.toggle('is-error', !!isError);
    els.status.classList.toggle('analytics-loading', !isError && /Loading/i.test(message || ''));
  }

  function renderKpis(summary, locations) {
    els.opens.textContent = formatNumber(summary.opens);
    els.versions.textContent = formatNumber(summary.versions.length);
    els.countries.textContent = formatNumber(locations.length);
    els.models.textContent = summary.avgModels ? formatNumber(summary.avgModels) : '—';

    els.opensHint.textContent = 'App opens via /app/open';
    els.versionsHint.textContent =
      summary.versions.length === 1
        ? summary.versions[0].name
        : 'Distinct versions reported';
    els.countriesHint.textContent = locations.length === 1 ? locations[0].name : 'With activity';
    els.modelsHint.textContent = summary.avgModels
      ? 'Avg library size from titles'
      : 'No model counts yet';
  }

  function renderBars(container, rows, emptyText) {
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = `<div class="analytics-empty">${emptyText}</div>`;
      return;
    }

    const max = Math.max(...rows.map((row) => row.count), 1);
    container.innerHTML = rows
      .map(
        (row) => `
      <div class="analytics-bar" title="${row.name}">
        <div class="analytics-bar__label">${row.name}</div>
        <div class="analytics-bar__track">
          <div class="analytics-bar__fill" data-width="${(row.count / max) * 100}"></div>
        </div>
        <div class="analytics-bar__value">${formatNumber(row.count)}</div>
      </div>`
      )
      .join('');

    requestAnimationFrame(() => {
      container.querySelectorAll('.analytics-bar__fill').forEach((el) => {
        el.style.width = el.getAttribute('data-width') + '%';
      });
    });
  }

  function renderChart(series) {
    if (!els.chart) return;
    if (!series.length || series.every((d) => d.count === 0)) {
      els.chart.innerHTML = '<div class="analytics-chart__empty">No opens in this period yet.</div>';
      return;
    }

    const width = 640;
    const height = 220;
    const pad = { top: 12, right: 8, bottom: 28, left: 8 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const max = Math.max(...series.map((d) => d.count), 1);
    const step = series.length > 1 ? innerW / (series.length - 1) : innerW;

    const points = series.map((d, i) => {
      const x = pad.left + (series.length === 1 ? innerW / 2 : i * step);
      const y = pad.top + innerH - (d.count / max) * innerH;
      return { x, y, ...d };
    });

    const line = points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ');
    const area =
      `M ${points[0].x} ${pad.top + innerH} ` +
      points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${points[points.length - 1].x} ${pad.top + innerH} Z`;

    const labelIndexes = new Set([0, points.length - 1]);
    if (points.length > 4) labelIndexes.add(Math.floor(points.length / 2));

    const labels = points
      .filter((_, i) => labelIndexes.has(i))
      .map((p) => {
        const label = p.day.slice(5);
        return `<text x="${p.x}" y="${height - 8}" text-anchor="middle" fill="#8a93a3" font-size="11">${label}</text>`;
      })
      .join('');

    const dots = points
      .filter((p) => p.count > 0)
      .map(
        (p) =>
          `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#00bfff"><title>${p.day}: ${p.count}</title></circle>`
      )
      .join('');

    els.chart.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Opens over time">
        <defs>
          <linearGradient id="opens-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#00bfff" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#00bfff" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#opens-fill)" opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.6s" fill="freeze"/>
        </path>
        <path d="${line}" fill="none" stroke="#00bfff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          stroke-dasharray="1200" stroke-dashoffset="1200">
          <animate attributeName="stroke-dashoffset" from="1200" to="0" dur="0.9s" fill="freeze"/>
        </path>
        ${dots}
        ${labels}
      </svg>`;
  }

  function countryCode(row) {
    if (row.id && /^[A-Z]{2}$/i.test(row.id)) return row.id.toUpperCase();
    const names = window.WORLD_MAP_NAMES || {};
    return names[row.name] || null;
  }

  function renderMap(locations, total) {
    const svg = els.map;
    const tooltip = els.mapTooltip;
    if (!svg || !window.WORLD_MAP_PATHS) {
      if (svg) svg.innerHTML = '<text x="20" y="40" fill="#8a93a3">Map unavailable</text>';
      return;
    }

    const byCode = new Map();
    locations.forEach((row) => {
      const code = countryCode(row);
      if (!code || !row.count) return;
      const prev = byCode.get(code);
      byCode.set(code, {
        name: row.name,
        count: (prev ? prev.count : 0) + row.count,
        code,
      });
    });

    let max = 0;
    byCode.forEach((v) => {
      if (v.count > max) max = v.count;
    });

    const viewBox = window.WORLD_MAP_VIEWBOX || '0 0 1000 500';
    svg.setAttribute('viewBox', viewBox);

    const paths = Object.entries(window.WORLD_MAP_PATHS)
      .map(([code, d]) => {
        const entry = byCode.get(code);
        const has = entry ? '1' : '0';
        let fill = 'rgba(255,255,255,0.06)';
        if (entry && max > 0) {
          const t = Math.sqrt(entry.count) / Math.sqrt(max);
          const alpha = 0.28 + t * 0.72;
          fill = `rgba(26, 140, 255, ${alpha.toFixed(3)})`;
        }
        const active = highlightCode === code ? ' is-active' : '';
        return `<path d="${d}" data-code="${code}" data-has="${has}" class="${active.trim()}" style="fill:${fill}"></path>`;
      })
      .join('');

    svg.innerHTML = paths;

    const showTip = (e) => {
      const path = e.target.closest('path');
      if (!path || path.dataset.has !== '1') {
        tooltip.classList.remove('is-visible');
        return;
      }
      const entry = byCode.get(path.dataset.code);
      if (!entry) return;
      const wrap = svg.parentElement.getBoundingClientRect();
      const pct = total > 0 ? ((entry.count / total) * 100).toFixed(1) : '0.0';
      tooltip.innerHTML = `<strong>${entry.name}</strong>${formatNumber(entry.count)} opens · ${pct}%`;
      const x = Math.max(8, Math.min(e.clientX - wrap.left + 12, wrap.width - 170));
      const y = Math.max(8, e.clientY - wrap.top - 48);
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
      tooltip.classList.add('is-visible');
    };

    svg.onmousemove = showTip;
    svg.onmouseleave = () => tooltip.classList.remove('is-visible');
  }

  function renderCountries(locations, total) {
    if (!els.countriesList) return;
    if (!locations.length) {
      els.countriesList.innerHTML = '<div class="analytics-empty">No location data yet.</div>';
      return;
    }

    const max = Math.max(...locations.map((row) => row.count), 1);
    els.countriesList.innerHTML = locations
      .map((row) => {
        const code = countryCode(row) || '';
        const pct = total > 0 ? ((row.count / total) * 100).toFixed(1) : '0.0';
        const active = highlightCode && highlightCode === code ? ' is-active' : '';
        return `
          <div class="analytics-country${active}" data-code="${code}">
            <div class="analytics-country__name">${row.name}</div>
            <div class="analytics-country__meta">${formatNumber(row.count)} · ${pct}%</div>
            <div class="analytics-country__bar"><span data-width="${(row.count / max) * 100}"></span></div>
          </div>`;
      })
      .join('');

    requestAnimationFrame(() => {
      els.countriesList.querySelectorAll('.analytics-country__bar > span').forEach((el) => {
        el.style.width = el.getAttribute('data-width') + '%';
      });
    });

    els.countriesList.querySelectorAll('.analytics-country').forEach((node) => {
      node.addEventListener('mouseenter', () => {
        highlightCode = node.getAttribute('data-code') || null;
        node.classList.add('is-active');
        const path = els.map && els.map.querySelector(`path[data-code="${highlightCode}"]`);
        if (path) path.classList.add('is-active');
      });
      node.addEventListener('mouseleave', () => {
        highlightCode = null;
        node.classList.remove('is-active');
        els.map && els.map.querySelectorAll('path.is-active').forEach((p) => p.classList.remove('is-active'));
      });
    });
  }

  async function load() {
    setStatus('Loading metrics…');
    const range = rangeForDays(activeDays);

    try {
      const hits = await fetchAllHits(range);
      const summary = aggregateOpenHits(hits);

      let locations = [];
      let locTotal = summary.opens;

      if (summary.pathIds.length) {
        const locParams = {
          start: range.start,
          end: range.end,
          limit: 50,
          include_paths: summary.pathIds,
        };
        const [locData, totalData] = await Promise.all([
          apiGet('/stats/locations', locParams),
          apiGet('/stats/total', locParams),
        ]);
        locations = (locData.stats || []).filter((row) => row.count > 0);
        locTotal = totalData.total || summary.opens;
      }

      renderKpis(summary, locations);
      renderChart(summary.series);
      renderBars(els.versionsList, summary.versions, 'No version data in titles yet.');
      renderBars(els.platformsList, summary.platforms, 'No platform data in titles yet.');
      renderMap(locations, locTotal);
      renderCountries(locations, locTotal);

      if (els.updated) {
        const stamp = new Date().toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        els.updated.textContent = `Updated ${stamp}`;
      }

      setStatus(
        summary.opens
          ? `Showing ${formatNumber(summary.opens)} open${summary.opens === 1 ? '' : 's'} over the last ${activeDays} days.`
          : `No /app/open activity in the last ${activeDays} days.`
      );
    } catch (err) {
      console.error(err);
      setStatus('Could not load GoatCounter metrics: ' + (err.message || err), true);
    }
  }

  function bindPeriods() {
    if (!els.periods) return;
    els.periods.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-days]');
      if (!btn) return;
      const days = parseInt(btn.getAttribute('data-days'), 10);
      if (!days || days === activeDays) return;
      activeDays = days;
      els.periods.querySelectorAll('button').forEach((node) => {
        node.classList.toggle('is-active', node === btn);
      });
      load();
    });
  }

  bindPeriods();
  load();
})();
