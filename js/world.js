'use strict';
/* =========================================================================
   World: floating islands (blocky tile pyramids, as in Element Rag) and the
   backdrop for each theme: a sky gradient and rolling hills, nothing else. Islands are solid boxes for physics; the
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

  // A theme's backdrop is just sky and three bands of rolling hills, painted once per size.
  function backdrop(i, w, h) {
    const key = i + ':' + w + 'x' + h;
    if (cache.has(key)) return cache.get(key);
    if (cache.size > 6) cache.clear();
    const th = THEMES[i];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const R = mulberry32(1234 + i * 77);
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.55, th.sky[1]); sky.addColorStop(1, th.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (let L = 0; L < 3; L++) {
      const base = h * (0.56 + L * 0.13), amp = h * (0.07 - L * 0.012);
      const p1 = R() * 10, p2 = R() * 10, f1 = 1.2 + R() * 1.2, f2 = 2.8 + R() * 2;
      g.fillStyle = th.hills[L];
      g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        const u = x / w;
        g.lineTo(x, base + Math.sin(u * TAU * f1 + p1) * amp + Math.sin(u * TAU * f2 + p2) * amp * 0.4);
      }
      g.lineTo(w, h); g.closePath(); g.fill();
    }
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
