/**
 * 404 easter egg: "Layer Stack".
 * Type G28 (home all axes) or tap the big 404 three times to open it. The hotend sweeps
 * a layer back and forth; drop it onto the stack and whatever overhangs gets trimmed.
 * Miss completely and the print turns to spaghetti.
 */
(function () {
  const dialog = document.getElementById('layer-game');
  const trigger = document.querySelector('.notfound .code');
  if (!dialog || !trigger || !dialog.showModal) return;

  const canvas = dialog.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const closeBtn = dialog.querySelector('.game-close');
  const statLayer = dialog.querySelector('[data-stat="layer"]');
  const statBest = dialog.querySelector('[data-stat="best"]');

  const W = 320, H = 440;          // logical canvas size
  const LH = 14;                   // on-screen layer thickness
  const LAYER_MM = 0.2;            // what each layer "is" for the readout
  const PLATE_Y = H - 34;
  const BASE_W = 180;
  const PERFECT = 4;               // px of slop that still counts as a perfect layer
  const FILAMENTS = ['#29c9e0', '#ec2a8e', '#ffe100', '#f0a22e', '#a6d04b'];
  const FONT = '"Space Grotesk", Inter, system-ui, sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, Consolas, monospace';
  const BEST_KEY = 'pv-layer-stack-best';

  let best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { /* storage blocked */ }

  let state = 'ready';             // 'ready' | 'playing' | 'over'
  let layers, mover, debris, strands, sparks, labels, camY, combo, overAt, newBest;
  let raf = 0, last = 0;

  /* ---------- Setup ---------- */
  function fitCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function filamentFor(index) { return FILAMENTS[Math.floor(index / 10) % FILAMENTS.length]; }
  function top() { return layers[layers.length - 1]; }
  function layerY(index) { return PLATE_Y - (index + 1) * LH; }
  function score() { return layers.length - 1; }   // the first layer is laid for you

  function reset() {
    layers = [{ x: (W - BASE_W) / 2, w: BASE_W, color: filamentFor(0) }];
    debris = []; strands = []; sparks = []; labels = [];
    camY = 0; combo = 0; newBest = false;
    mover = spawn();
    updateStats();
  }

  function spawn() {
    const prev = top();
    const fromLeft = layers.length % 2 === 1;
    return {
      x: fromLeft ? -prev.w * 0.25 : W - prev.w * 0.75,
      w: prev.w,
      dir: fromLeft ? 1 : -1,
      color: filamentFor(layers.length)
    };
  }

  function speed() { return Math.min(115 + score() * 6, 380); }

  function updateStats() {
    statLayer.textContent = score();
    statBest.textContent = best;
  }

  /* ---------- Gameplay ---------- */
  function drop() {
    const prev = top();
    const m = mover;
    const y = layerY(layers.length);
    const left = Math.max(m.x, prev.x);
    const right = Math.min(m.x + m.w, prev.x + prev.w);

    if (right - left <= 0) return fail(m, y);

    let placed;
    if (Math.abs(m.x - prev.x) <= PERFECT) {
      combo++;
      let w = prev.w, x = prev.x;
      if (combo >= 3 && w < BASE_W) {   // a streak of perfect layers wins some width back
        w = Math.min(BASE_W, w + 8);
        x = Math.max(0, Math.min(W - w, x - 4));
      }
      placed = { x: x, w: w, color: m.color };
      burst(x, y, m.color);
      burst(x + w, y, m.color);
      label(combo > 1 ? 'Perfect ×' + combo : 'Perfect!', x + w / 2, y, m.color);
    } else {
      combo = 0;
      const cut = m.x < prev.x
        ? { x: m.x, w: prev.x - m.x, dir: -1 }
        : { x: right, w: m.x + m.w - right, dir: 1 };
      debris.push({
        x: cut.x, y: y, w: cut.w, h: LH, color: m.color,
        vx: cut.dir * (30 + Math.random() * 40), vy: -60, rot: 0, vr: cut.dir * (2 + Math.random() * 3)
      });
      placed = { x: left, w: right - left, color: m.color };
    }

    layers.push(placed);
    if (layers.length % 10 === 0) label('M600 · filament change', W / 2, y - 26, filamentFor(layers.length));
    updateStats();
    mover = spawn();
  }

  function fail(m, y) {
    state = 'over';
    overAt = performance.now();
    // The missed layer comes apart as a tangle of filament
    for (let i = 0; i < 7; i++) {
      const pts = [];
      let px = m.x + Math.random() * m.w, py = 0;
      for (let k = 0; k < 9; k++) {
        pts.push({ x: px, y: py });
        px += (Math.random() - 0.5) * 26;
        py += 3 + Math.random() * 7;
      }
      strands.push({ pts: pts, x: 0, y: y, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 80, color: m.color });
    }
    if (score() > best) {
      best = score();
      newBest = best > 0;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* storage blocked */ }
      updateStats();
    }
  }

  function burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 120;
      sparks.push({ x: x, y: y + LH / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.5, color: color });
    }
  }

  function label(text, x, y, color) { labels.push({ text: text, x: x, y: y, t: 0, color: color }); }

  function action() {
    if (state === 'ready') state = 'playing';
    else if (state === 'playing') drop();
    else if (performance.now() - overAt > 600) { reset(); state = 'playing'; }
  }

  /* ---------- Loop ---------- */
  function update(dt) {
    if (state === 'playing') {
      mover.x += mover.dir * speed() * dt;
      const min = -mover.w * 0.25, max = W - mover.w * 0.75;
      if (mover.x < min) { mover.x = min; mover.dir = 1; }
      if (mover.x > max) { mover.x = max; mover.dir = -1; }
    }

    const target = Math.max(0, (layers.length + 1) * LH - H * 0.5);
    camY += (target - camY) * Math.min(1, dt * 6);

    debris.forEach(function (d) { d.vy += 900 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; });
    debris = debris.filter(function (d) { return d.y + camY < H + 60; });
    strands.forEach(function (s) { s.vy += 700 * dt; s.x += s.vx * dt; s.y += s.vy * dt; });
    strands = strands.filter(function (s) { return s.y + camY < H + 120; });
    sparks.forEach(function (p) { p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
    sparks = sparks.filter(function (p) { return p.life > 0; });
    labels.forEach(function (l) { l.t += dt; });
    labels = labels.filter(function (l) { return l.t < 1.1; });
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawLayer(x, y, w, color) {
    roundRect(x, y + 1, w, LH - 1, 5);
    ctx.fillStyle = color;
    ctx.fill();
    // extrusion lines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.fillRect(x + 3, y + 5, w - 6, 1);
    ctx.fillRect(x + 3, y + 9, w - 6, 1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fillRect(x + 4, y + 2, w - 8, 1);
  }

  function drawHotend(cx, nozzleY) {
    const railY = nozzleY - 40;
    ctx.fillStyle = '#222836';
    ctx.fillRect(0, railY - 3, W, 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(0, railY - 3, W, 1);
    // carriage + fan shroud
    roundRect(cx - 20, railY - 10, 40, 28, 6);
    ctx.fillStyle = '#2b3242';
    ctx.fill();
    ctx.fillStyle = '#29c9e0';
    ctx.fillRect(cx - 14, railY + 12, 28, 2);
    ctx.beginPath();
    ctx.arc(cx, railY + 3, 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#6f7889';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // heater block
    ctx.fillStyle = '#a1a9b8';
    ctx.fillRect(cx - 11, nozzleY - 22, 22, 12);
    // brass nozzle
    ctx.beginPath();
    ctx.moveTo(cx - 6, nozzleY - 10);
    ctx.lineTo(cx + 6, nozzleY - 10);
    ctx.lineTo(cx + 2, nozzleY - 2);
    ctx.lineTo(cx - 2, nozzleY - 2);
    ctx.closePath();
    ctx.fillStyle = '#d4a24a';
    ctx.fill();
  }

  function centerText(text, y, font, color) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, y);
  }

  function drawPanel(lines) {
    ctx.fillStyle = 'rgba(10, 12, 17, 0.78)';
    ctx.fillRect(0, 0, W, H);
    let y = H / 2 - (lines.length - 1) * 15;
    lines.forEach(function (l) {
      if (l) centerText(l[0], y, l[1], l[2]);
      y += 30;
    });
  }

  function draw() {
    ctx.fillStyle = '#0a0c11';
    ctx.fillRect(0, 0, W, H);

    // dot grid that drifts with the camera
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    const off = camY % 20;
    for (let gy = off - 20; gy < H; gy += 20) for (let gx = 10; gx < W; gx += 20) ctx.fillRect(gx, gy, 1.5, 1.5);

    ctx.save();
    ctx.translate(0, camY);

    // textured PEI build plate
    ctx.fillStyle = '#1a1f2a';
    ctx.fillRect(8, PLATE_Y, W - 16, 40);
    ctx.fillStyle = '#b8893a';
    ctx.fillRect(8, PLATE_Y, W - 16, 4);

    const viewTop = -camY - LH, viewBottom = H - camY;
    layers.forEach(function (l, i) {
      const y = layerY(i);
      if (y > viewTop && y < viewBottom) drawLayer(l.x, y, l.w, l.color);
    });

    debris.forEach(function (d) {
      ctx.save();
      ctx.translate(d.x + d.w / 2, d.y + d.h / 2);
      ctx.rotate(d.rot);
      drawLayer(-d.w / 2, -d.h / 2, d.w, d.color);
      ctx.restore();
    });

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strands.forEach(function (s) {
      ctx.beginPath();
      s.pts.forEach(function (p, k) {
        const px = p.x + s.x, py = p.y + s.y;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.quadraticCurveTo(px - 8, py - 4, px, py);
      });
      ctx.strokeStyle = s.color;
      ctx.stroke();
    });

    if (state !== 'over') {
      const y = layerY(layers.length);
      drawLayer(mover.x, y, mover.w, mover.color);
      drawHotend(mover.x + mover.w / 2, y);
    }

    sparks.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    });
    ctx.globalAlpha = 1;

    labels.forEach(function (l) {
      ctx.globalAlpha = Math.max(0, 1 - l.t / 1.1);
      ctx.font = '600 14px ' + MONO;
      ctx.fillStyle = l.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(l.text, Math.max(70, Math.min(W - 70, l.x)), l.y - 46 - l.t * 30);
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    // printer readout
    ctx.font = '500 11px ' + MONO;
    ctx.fillStyle = '#6f7889';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Z ' + (score() * LAYER_MM).toFixed(2) + 'mm', 12, 12);
    ctx.textAlign = 'right';
    ctx.fillText('E0 ' + Math.round(210 + Math.min(score(), 30)) + '°C', W - 12, 12);

    if (state === 'ready') {
      drawPanel([
        ['LAYER STACK', '700 30px ' + FONT, '#eef1f6'],
        ['Drop each layer on the one below.', '400 14px ' + FONT, '#a1a9b8'],
        ['Overhangs get trimmed. Line up', '400 14px ' + FONT, '#a1a9b8'],
        ['3 perfect layers to win width back.', '400 14px ' + FONT, '#a1a9b8'],
        null,
        ['▶ Tap · click · Space to start', '600 14px ' + MONO, '#29c9e0']
      ]);
    } else if (state === 'over' && !strands.length) {
      const s = score();
      drawPanel([
        ['Spaghetti detected!', '700 26px ' + FONT, '#ec2a8e'],
        ['Print failed at layer ' + s + ' (' + (s * LAYER_MM).toFixed(1) + ' mm)', '400 14px ' + FONT, '#a1a9b8'],
        newBest ? ['New personal best!', '600 14px ' + FONT, '#ffe100'] : ['Best: ' + best + ' layers', '400 14px ' + FONT, '#6f7889'],
        null,
        ['↻ Tap · click · Space to reprint', '600 14px ' + MONO, '#29c9e0']
      ]);
    }
  }

  function frame(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0);
    last = t;
    update(dt);
    draw();
    if (dialog.open) raf = requestAnimationFrame(frame);
  }

  /* ---------- Open / close ---------- */
  function open() {
    if (dialog.open) return;
    fitCanvas();
    reset();
    state = 'ready';
    dialog.showModal();
    canvas.focus();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  dialog.addEventListener('close', function () { cancelAnimationFrame(raf); });
  closeBtn.addEventListener('click', function () { dialog.close(); });

  canvas.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    e.preventDefault();
    action();
  });

  let typed = '';
  document.addEventListener('keydown', function (e) {
    if (dialog.open) {
      if (e.target === closeBtn || e.repeat) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); action(); }
      return;
    }
    // G28: home all axes
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (/^(input|textarea|select)$/i.test(e.target.tagName)) return;
    typed = (typed + e.key.toLowerCase()).slice(-3);
    if (typed === 'g28') { typed = ''; open(); }
  });

  // Three quick taps on the 404 does the same thing for touch screens
  let pokes = 0, pokeTimer = 0;
  trigger.addEventListener('click', function () {
    trigger.classList.remove('is-poked');
    void trigger.offsetWidth;            // restart the wobble animation
    trigger.classList.add('is-poked');
    pokes++;
    clearTimeout(pokeTimer);
    pokeTimer = setTimeout(function () { pokes = 0; }, 1200);
    if (pokes >= 3) { pokes = 0; open(); }
  });
})();
