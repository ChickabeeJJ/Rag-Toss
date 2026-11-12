'use strict';
/* =========================================================================
   World: floating islands (blocky tile pyramids, as in Element Rag) and the
   backdrop for each theme: a sky gradient and five layers of hills, nothing else. Islands are solid boxes for physics; the
   pyramid underneath is only drawn.
   ========================================================================= */

const TILE = 30;

class Plat {
  // x is the centre, y the top surface
  constructor(x, y, w, kind = 'foe') {
    this.x = x; this.y = y; this.baseY = y; this.w = w; this.kind = kind;
    this.h = kind === 'wall' ? 0 : 34;
    this.state = 'idle'; this.t = 0; this.vy = 0; this.falling = false;
    this.bobA = 0; this.bobS = 1; this.bobP = Math.random() * TAU;   // gentle float
    this.moveA = 0; this.moveS = 0.6;                                // later stages: islands that travel up and down
    this.owner = null; this.props = []; this.balloons = null; this.shake = 0;
    this.seed = Math.floor(Math.random() * 1e9);
    this.build();
  }
  get left() { return this.x - this.w / 2; }
  get right() { return this.x + this.w / 2; }
  get top() { return this.y; }
  get bottom() { return this.y + this.h; }

  // rows of dirt tiles tapering to a point, with per-tile shade jitter
  build() {
    if (this.kind === 'wall') return;
    const R = mulberry32(this.seed);
    const cols = Math.max(2, Math.round(this.w / TILE));
    this.tw = this.w / cols;
    this.rows = [];
    let a = 0, b = cols;
    const maxRows = this.kind === 'player' ? 7 : Math.min(4, Math.ceil(cols / 2) + 1);
    for (let r = 0; r < maxRows && b - a >= 1; r++) {
      const row = [];
      for (let c = a; c < b; c++) row.push({ c, v: R() });
      this.rows.push(row);
      const cut = r === 0 ? (cols > 4 ? 1 : 0) : 1;
      a += cut + (R() < 0.3 && b - a > 3 ? 1 : 0); b -= cut + (R() < 0.3 && b - a > 3 ? 1 : 0);
    }
    this.tufts = [];
    for (let i = 0; i < cols; i++) if (R() < 0.6) this.tufts.push({ x: (i + R()) * this.tw, h: 4 + R() * 5 });
  }

  update(dt, time) {
    this.shake = Math.max(0, this.shake - dt * 3);
    if (this.falling) { this.vy += G * 0.8 * dt; this.y += this.vy * dt; return; }
    if (this.state === 'in') {
      this.t += dt;
      const k = clamp(this.t / 0.62, 0, 1);
      this.y = this.baseY + (1 - easeOutBack(k)) * 520;
      if (k >= 1) this.state = 'idle';
      return;
    }
    this.y = this.baseY + Math.sin(time * this.bobS + this.bobP) * this.bobA + Math.sin(time * this.moveS + this.bobP) * this.moveA;
  }
  drop() { if (!this.falling) { this.falling = true; this.vy = 40; } }

  draw(ctx, th, time) {
    if (this.kind === 'wall') return;
    const sx = this.shake > 0 ? Math.sin(time * 90) * this.shake * 4 : 0;
    const L = this.left + sx, T = this.y, tw = this.tw;
    // dirt pyramid
    for (let r = 0; r < this.rows.length; r++) {
      const y = T + 8 + r * TILE * 0.9, hh = TILE * 0.9, row = this.rows[r];
      // a solid backing so the rounded tile corners never show sky through the seams
      ctx.fillStyle = shade(r === 0 ? th.dirt : r < 3 ? th.dirt2 : th.dirt3, -0.12);
      ctx.beginPath(); ctx.roundRect(L + row[0].c * tw, y, (row[row.length - 1].c - row[0].c + 1) * tw, hh, 5); ctx.fill();
      for (const t of row) {
        const base = r === 0 ? th.dirt : r < 3 ? th.dirt2 : th.dirt3;
        ctx.fillStyle = shade(base, (t.v - 0.5) * 0.14);
        ctx.beginPath(); ctx.roundRect(L + t.c * tw, y, tw + 0.6, hh + 0.6, 5); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(L + t.c * tw + 2, y + hh - 4, tw - 4, 4);
      }
    }
    // grass cap, overhanging a little
    ctx.fillStyle = th.grass;
    ctx.beginPath(); ctx.roundRect(L - 4, T - 2, this.w + 8, 16, 7); ctx.fill();
    ctx.fillStyle = th.grassHi;
    ctx.beginPath(); ctx.roundRect(L - 2, T - 2, this.w + 4, 6, 3); ctx.fill();
    ctx.strokeStyle = th.grassHi; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const tf of this.tufts) { ctx.beginPath(); ctx.moveTo(L + tf.x, T); ctx.lineTo(L + tf.x + Math.sin(time * 2 + tf.x) * 1.5, T - tf.h); ctx.stroke(); }
    // things stuck in the ground
    for (const p of this.props) {
      ctx.globalAlpha = clamp(p.life / 0.4, 0, 1);
      ItemArt.draw(ctx, p.id, this.x + p.ox + sx, this.y + p.oy, p.rot, p.r, time);
    }
    ctx.globalAlpha = 1;
  }
}

const World = (() => {
  const cache = new Map();
  function init() { cache.clear(); }

  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // ridge height 0..1 at u (0..1 across the screen); each theme gets its own kind of skyline
  function ridge(kind, u, f) {
    const s1 = Math.sin(u * TAU * f.f1 + f.p1), s2 = Math.sin(u * TAU * f.f2 + f.p2), s3 = Math.sin(u * TAU * f.f3 + f.p3);
    switch (kind) {
      case 'peaks': return 0.62 * (1 - Math.pow(Math.abs(s1), 0.85)) + 0.3 * (1 - Math.abs(s2)) + 0.08 * (s3 * 0.5 + 0.5);
      case 'jag': return 0.5 * (1 - Math.abs(s1)) + 0.34 * (1 - Math.abs(Math.sin(u * TAU * f.f2 * 1.7 + f.p2))) + 0.16 * (1 - Math.abs(s3));
      case 'dunes': { const v = s1 * 0.5 + 0.5; return 0.7 * Math.pow(v, 1.7) + 0.22 * (s2 * 0.5 + 0.5) + 0.08 * (s3 * 0.5 + 0.5); }
      case 'mesa': { const n = 0.5 + 0.5 * (s1 * 0.65 + s2 * 0.35), q = n * 3, fl = Math.floor(q); return (fl + sstep(0.42, 0.58, q - fl)) / 3 * 0.9 + 0.1 * (s3 * 0.5 + 0.5); }
      default: return 0.5 + 0.5 * (s1 * 0.6 + s2 * 0.3 + s3 * 0.1);
    }
  }

  // A theme's backdrop: sky and five layers of ridges, far ones hazy and pale, near ones dark and crisp, painted once per size.
  function backdrop(i, w, h) {
    const key = i + ':' + w + 'x' + h;
    if (cache.has(key)) return cache.get(key);
    if (cache.size > 6) cache.clear();
    const th = THEMES[i];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const R = mulberry32(1234 + i * 77);
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.5, th.sky[1]); sky.addColorStop(0.78, th.sky[2]); sky.addColorStop(1, shade(th.sky[2], th.dark ? -0.3 : -0.08));
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // a soft glow where the sky meets the far ridges
    const glow = g.createLinearGradient(0, h * 0.34, 0, h * 0.7);
    glow.addColorStop(0, rgba(th.sky[2], 0)); glow.addColorStop(0.7, rgba(th.sky[2], th.dark ? 0.16 : 0.4)); glow.addColorStop(1, rgba(th.sky[2], 0));
    g.fillStyle = glow; g.fillRect(0, h * 0.34, w, h * 0.36);

    const LAYERS = 5;
    const bases = [0.47, 0.56, 0.65, 0.75, 0.87];
    const amps = th.ridge === 'mesa' ? [0.15, 0.14, 0.12, 0.1, 0.08] : th.ridge === 'peaks' || th.ridge === 'jag' ? [0.2, 0.17, 0.14, 0.11, 0.08] : [0.13, 0.11, 0.095, 0.08, 0.06];
    const cols = [mixHex(th.hills[0], th.sky[1], 0.6), mixHex(th.hills[0], th.sky[1], 0.34), mixHex(th.hills[0], th.sky[1], 0.08), th.hills[1], th.hills[2]];
    const rim = th.dark ? '#9fb4ff' : '#ffffff';
    for (let L = 0; L < LAYERS; L++) {
      const f = { f1: 0.7 + R() * 0.9 + L * 0.15, f2: 1.9 + R() * 1.6 + L * 0.3, f3: 4.2 + R() * 3, p1: R() * 10, p2: R() * 10, p3: R() * 10 };
      const base = h * bases[L], amp = h * amps[L];
      const pts = [];
      for (let x = 0; x <= w + 6; x += 6) pts.push([x, base - ridge(th.ridge, x / w, f) * amp]);
      // body: a gradient that darkens toward the bottom of the layer
      const body = g.createLinearGradient(0, base - amp, 0, Math.min(h, base + h * 0.2));
      body.addColorStop(0, cols[L]); body.addColorStop(1, shade(cols[L], th.dark ? -0.3 : -0.16));
      g.fillStyle = body;
      const path = () => { g.beginPath(); g.moveTo(0, h); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(w, h); g.closePath(); };
      path(); g.fill();
      g.save(); path(); g.clip();
      // strata on the mesas
      if (th.ridge === 'mesa') { g.strokeStyle = 'rgba(60,20,40,0.12)'; g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); for (let q = 0; q < pts.length; q++) { const [x, y] = pts[q]; if (q) g.lineTo(x, y + k * amp * 0.17); else g.moveTo(x, y + k * amp * 0.17); } g.stroke(); } }
      // haze settling into the lower part of each far layer, only inside its own shape
      if (L < LAYERS - 1) {
        const fog = g.createLinearGradient(0, base - amp, 0, base + h * 0.14);
        fog.addColorStop(0, rgba(th.sky[2], 0)); fog.addColorStop(1, rgba(th.sky[2], th.dark ? 0.16 : 0.3 - L * 0.05));
        g.fillStyle = fog; g.fillRect(0, base - amp, w, amp + h * 0.14);
      }
      // shadow side: a darker wash under the crest gives each ridge some volume
      const vol = g.createLinearGradient(0, base - amp, 0, base - amp * 0.35);
      vol.addColorStop(0, 'rgba(255,255,255,' + (th.dark ? 0.05 : 0.1) + ')'); vol.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = vol; g.fillRect(0, base - amp, w, amp);
      g.restore();
      // rim light along the crest
      g.strokeStyle = rgba(rim, L < 2 ? 0.12 : 0.26); g.lineWidth = L < 2 ? 1.2 : 2.2; g.lineJoin = 'round';
      g.beginPath(); pts.forEach(([x, y], q) => (q ? g.lineTo(x, y - 0.6) : g.moveTo(x, y - 0.6))); g.stroke();
      // grass flecks on the near rolling layers
      if (th.ridge === 'round' && L >= 3) { g.strokeStyle = rgba(rim, 0.07); g.lineWidth = 2; g.beginPath(); for (let x = 0; x < w; x += 22) { const k = Math.floor(x / 6); const y = pts[k][1] + 12 + R() * (h * 0.1); g.moveTo(x, y); g.lineTo(x + 5, y - 6); } g.stroke(); }
    }
    // darken the very bottom a touch so the HUD reads
    const bot = g.createLinearGradient(0, h * 0.82, 0, h);
    bot.addColorStop(0, 'rgba(8,10,18,0)'); bot.addColorStop(1, `rgba(8,10,18,${th.dark ? 0.35 : 0.2})`);
    g.fillStyle = bot; g.fillRect(0, h * 0.82, w, h * 0.18);
    cache.set(key, c);
    return c;
  }

  // from -> to crossfade (blend 0..1) when the stage changes
  function draw(ctx, w, h, from, to, blend) {
    ctx.drawImage(backdrop(from, w, h), 0, 0);
    if (blend > 0 && to !== from) { ctx.globalAlpha = blend; ctx.drawImage(backdrop(to, w, h), 0, 0); ctx.globalAlpha = 1; }
  }

  return { init, draw };
})();
