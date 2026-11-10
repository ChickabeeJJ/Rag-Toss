'use strict';
/* =========================================================================
   World: floating islands (blocky tile pyramids, as in Element Rag) and the
   painted backdrop for each theme. Islands are solid boxes for physics; the
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
  let clouds = [], motes = [];

  function init() {
    clouds = [];
    for (let i = 0; i < 7; i++) clouds.push({ x: Math.random(), y: 0.08 + Math.random() * 0.4, s: 0.6 + Math.random() * 0.9, v: 0.004 + Math.random() * 0.006 });
    motes = [];
    for (let i = 0; i < 46; i++) motes.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), p: Math.random() * TAU });
  }

  // the static part of a theme (sky, sun, hills, far islands) is painted once per size
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
    if (th.stars) {
      g.fillStyle = '#ffffff';
      for (let k = 0; k < 140; k++) { g.globalAlpha = 0.25 + R() * 0.7; g.beginPath(); g.arc(R() * w, R() * h * 0.7, 0.6 + R() * 1.4, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    }
    // sun or moon with a soft halo
    const sx = w * 0.74, sy = h * th.sunY, sr = Math.min(w, h) * 0.07;
    const halo = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5);
    halo.addColorStop(0, rgba(th.sun, 0.55)); halo.addColorStop(1, rgba(th.sun, 0));
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    g.fillStyle = th.sun; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
    if (th.stars) { g.fillStyle = th.sky[0]; g.globalAlpha = 0.9; g.beginPath(); g.arc(sx + sr * 0.42, sy - sr * 0.2, sr * 0.86, 0, TAU); g.fill(); g.globalAlpha = 1; }
    // three bands of rolling hills
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
    // far-off islands, hazy
    for (let k = 0; k < 4; k++) {
      const x = w * (0.2 + R() * 0.75), y = h * (0.2 + R() * 0.4), ww = w * (0.03 + R() * 0.04);
      g.globalAlpha = 0.35;
      g.fillStyle = th.hills[1];
      g.beginPath(); g.moveTo(x - ww, y); g.lineTo(x + ww, y); g.lineTo(x + ww * 0.3, y + ww * 0.9); g.lineTo(x - ww * 0.4, y + ww * 0.7); g.closePath(); g.fill();
      g.fillStyle = th.grass; g.beginPath(); g.roundRect(x - ww * 1.05, y - 3, ww * 2.1, 6, 3); g.fill();
      g.globalAlpha = 1;
    }
    // ground haze
    const haze = g.createLinearGradient(0, h * 0.7, 0, h);
    haze.addColorStop(0, rgba(th.hills[2], 0)); haze.addColorStop(1, rgba(th.dark ? '#05070d' : th.hills[2], 0.75));
    g.fillStyle = haze; g.fillRect(0, h * 0.7, w, h * 0.3);
    cache.set(key, c);
    return c;
  }

  // from -> to crossfade (blend 0..1), then the moving bits: clouds and weather
  function draw(ctx, w, h, from, to, blend, time) {
    ctx.drawImage(backdrop(from, w, h), 0, 0);
    if (blend > 0 && to !== from) { ctx.globalAlpha = blend; ctx.drawImage(backdrop(to, w, h), 0, 0); ctx.globalAlpha = 1; }
    const th = THEMES[blend > 0.5 ? to : from];
    ctx.fillStyle = th.dark ? 'rgba(200,210,240,0.10)' : 'rgba(255,255,255,0.5)';
    for (const c of clouds) {
      const x = ((c.x + time * c.v) % 1.3 - 0.15) * w, y = c.y * h, s = c.s * h * 0.05;
      ctx.beginPath();
      ctx.ellipse(x, y, s * 2.6, s * 0.7, 0, 0, TAU); ctx.ellipse(x - s * 1.1, y - s * 0.4, s * 1.2, s * 0.8, 0, 0, TAU); ctx.ellipse(x + s * 0.7, y - s * 0.55, s * 1.4, s * 0.9, 0, 0, TAU);
      ctx.fill();
    }
    if (th.rain) {
      ctx.strokeStyle = 'rgba(200,215,240,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (const m of motes) { const x = ((m.x + time * 0.25 * m.s) % 1) * w, y = ((m.y + time * 1.6 * m.s) % 1) * h; ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 20); }
      ctx.stroke();
    } else {
      ctx.fillStyle = th.mote;
      for (const m of motes) {
        const fall = th.snow ? 0.06 : 0.012;
        const x = ((m.x + Math.sin(time * 0.4 + m.p) * 0.02 + time * 0.006 * m.s) % 1) * w, y = ((m.y + time * fall * m.s) % 1) * h;
        ctx.globalAlpha = (th.snow ? 0.8 : 0.35) * (0.5 + 0.5 * Math.sin(time * 1.5 + m.p));
        ctx.beginPath(); ctx.arc(x, y, (th.snow ? 2.4 : 1.8) * m.s, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  return { init, draw };
})();
