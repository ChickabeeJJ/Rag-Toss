'use strict';
/* =========================================================================
   Rag: an active ragdoll, the same idea as Element Rag's Fighter. Eleven
   verlet points joined by bones are pulled toward an animated pose by
   "muscles". Hits shove the points around; a big hit drops muscle strength
   to zero (tumble) and the body flies limp until it settles on an island and
   stands back up, or falls into the sky below.
   Throwers stay rooted to one island, so the pose is built from a fixed foot
   position plus aim, wind-up, release and duck amounts.
   ========================================================================= */

const P = { HEAD: 0, NECK: 1, PELVIS: 2, FELB: 3, FHAND: 4, BELB: 5, BHAND: 6, FKNEE: 7, FFOOT: 8, BKNEE: 9, BFOOT: 10 };
// bones: [a, b, hurt radius]
const SEGS = [
  [1, 0, 0], [1, 2, 11],
  [1, 3, 6], [3, 4, 6], [1, 5, 6], [5, 6, 6],
  [2, 7, 7.5], [7, 8, 6.5], [2, 9, 7.5], [9, 10, 6.5],
];
const SEG_PART = ['head', 'body', 'arm', 'arm', 'arm', 'arm', 'leg', 'leg', 'leg', 'leg'];
const BONE_LEN = [17, 45, 24, 24, 24, 24, 29, 28, 29, 28];
const MUSCLE = [0.11, 0.16, 0.2, 0.12, 0.17, 0.12, 0.17, 0.12, 0.2, 0.12, 0.2];
const MUSCLE_DAMP = 0.2;
// inverse masses: heavy trunk, light extremities, so limbs whip around the body
const INV_MASS = [0.8, 0.35, 0.3, 0.88, 0.92, 0.88, 0.92, 0.75, 1, 0.75, 1];
// soft joint limits [a, b, minLen, maxLen] in unscaled units
const JOINT_LIMITS = [
  [2, 8, 34, 58], [2, 10, 34, 58],
  [1, 4, 16, 49], [1, 6, 16, 49],
  [1, 7, 50, 80], [1, 9, 50, 80],
  [0, 2, 56, 64],
  [0, 3, 20, 60], [0, 5, 20, 60],
];
const HEAD_R = 13;
const STEP = 1 / 120;          // physics step; the game runs whole steps only

class Rag {
  constructor(o) {
    this.s = o.scale || 1;
    this.facing = o.facing || 1;
    this.isPlayer = !!o.isPlayer;
    this.body = o.body || '#f7f2e7';
    this.shade = o.shade || '#d6cab4';
    this.accent = o.accent || '#ff9a3c';
    this.hat = o.hat || null;
    this.root = { x: o.x, y: o.y };
    this.plat = o.plat || null;
    this.platOff = o.plat ? o.x - o.plat.x : 0;
    this.mode = 'active';           // active | tumble | rising | dead
    this.m = 1;                     // muscle strength 0..1
    this.t = Math.random() * 10;
    this.aim = this.facing > 0 ? -0.5 : Math.PI + 0.5;
    this.aimW = 0;                  // how much the arms are in the aiming pose
    this.pull = 0;                  // wind-up 0..1
    this.throwT = -1;               // seconds since the last release, -1 when idle
    this.duck = 0;
    this.hold = null;               // item id shown in the throwing hand
    this.holdR = 12;
    this.shield = 0;                // lid hits left (drawn on the off hand)
    this.helmet = false;
    this.crown = false;
    this.frozen = 0; this.stun = 0; this.gild = 0; this.burn = 0;
    this.flash = 0;
    this.tumbleT = 0; this.restT = 0; this.stuckT = 0; this.deadT = 0;
    this.stuck = [];
    this.pts = []; this.T = []; this.Tp = [];
    for (let i = 0; i < 11; i++) { this.pts.push({ x: o.x, y: o.y, px: o.x, py: o.y }); this.T.push({ x: o.x, y: o.y }); this.Tp.push({ x: o.x, y: o.y }); }
    this.snap();
  }

  get alive() { return this.mode !== 'dead'; }
  get head() { return this.pts[P.HEAD]; }
  get chest() { return { x: (this.pts[P.NECK].x + this.pts[P.PELVIS].x) / 2, y: (this.pts[P.NECK].y + this.pts[P.PELVIS].y) / 2 }; }
  get hand() { return this.pts[P.FHAND]; }
  get offHand() { return this.pts[P.BHAND]; }

  // put every point exactly on the pose (spawns, revives)
  snap() {
    this.computeTargets();
    for (let i = 0; i < 11; i++) { const p = this.pts[i]; p.x = p.px = this.T[i].x; p.y = p.py = this.T[i].y; this.Tp[i].x = this.T[i].x; this.Tp[i].y = this.T[i].y; }
  }
  // move the whole body with its island without adding velocity
  shift(dx, dy) {
    for (const p of this.pts) { p.x += dx; p.px += dx; p.y += dy; p.py += dy; }
    for (let i = 0; i < 11; i++) { this.T[i].x += dx; this.T[i].y += dy; this.Tp[i].x += dx; this.Tp[i].y += dy; }
  }

  impulse(idx, vx, vy, spread = 0.35) {
    for (let i = 0; i < 11; i++) {
      const k = (i === idx ? 1 : spread) * INV_MASS[i] * STEP;
      this.pts[i].px -= vx * k; this.pts[i].py -= vy * k;
    }
  }
  // go limp and fly
  knock(vx, vy, idx = P.NECK, dur = 0.55) {
    if (this.mode === 'dead') return;
    this.mode = 'tumble'; this.m = 0; this.tumbleT = dur; this.restT = 0; this.stuckT = 0; this.plat = null;
    this.pull = 0; this.throwT = -1; this.aimW = 0;
    for (let i = 0; i < 11; i++) {
      const k = (i === idx ? 1.25 : 1) * STEP;
      this.pts[i].px -= (vx + rand(-40, 40)) * k; this.pts[i].py -= (vy + rand(-40, 40)) * k;
    }
  }
  die(vx, vy, idx = P.NECK) {
    if (this.mode === 'dead') return;
    this.mode = 'dead'; this.m = 0; this.deadT = 0; this.plat = null; this.frozen = 0; this.stun = 0;
    this.hold = null; this.pull = 0;
    for (let i = 0; i < 11; i++) {
      const k = (i === idx ? 1.4 : 1) * STEP;
      this.pts[i].px -= (vx + rand(-60, 60)) * k; this.pts[i].py -= (vy + rand(-60, 60)) * k;
    }
  }
  revive(plat, x) {
    this.mode = 'active'; this.m = 1; this.plat = plat; this.root.x = x; this.root.y = plat.top; this.platOff = x - plat.x;
    this.stun = 0; this.frozen = 0; this.burn = 0; this.stuck.length = 0;
    this.snap();
  }

  update(dt, plats) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 5);
    this.gild = Math.max(0, this.gild - dt);
    if (this.throwT >= 0) { this.throwT += dt; if (this.throwT > 0.34) this.throwT = -1; }
    if (this.mode === 'active' || this.mode === 'rising') {
      if (this.plat) {
        const nx = this.plat.x + this.platOff, ny = this.plat.top;
        const dx = nx - this.root.x, dy = ny - this.root.y;
        if (dx || dy) { this.root.x = nx; this.root.y = ny; this.shift(dx, dy); }
      }
      if (this.mode === 'rising') { this.m = Math.min(1, this.m + dt * 2.4); if (this.m >= 1) this.mode = 'active'; }
      if (this.frozen <= 0) this.computeTargets();
      else for (let i = 0; i < 11; i++) { this.Tp[i].x = this.T[i].x; this.Tp[i].y = this.T[i].y; }
    }
    this.stepBody(dt, plats);
    if (this.mode === 'tumble') this.followBody(dt, plats);
    if (this.mode === 'dead') this.deadT += dt;
  }

  computeTargets() {
    const s = this.s, f = this.facing, r = this.root, T = this.T, Tp = this.Tp;
    for (let i = 0; i < 11; i++) { Tp[i].x = T[i].x; Tp[i].y = T[i].y; }
    const t = this.t, duck = this.duck, pull = this.pull, aw = this.aimW;
    const ca = Math.cos(this.aim), sa = Math.sin(this.aim);
    // release: the arm whips forward fast, then eases back
    let swing = 0;
    if (this.throwT >= 0) { const u = this.throwT / 0.34; swing = u < 0.3 ? easeOut(u / 0.3) : 1 - (u - 0.3) / 0.7; }
    const dizzy = this.stun > 0 ? Math.sin(t * 7) * 0.16 : 0;
    const breathe = Math.sin(t * 2.4) * 1.4 * s;
    const lean = f * (-0.17 * pull * aw + 0.3 * swing + 1.05 * duck) + Math.sin(t * 1.3) * 0.02 + dizzy;
    const px = r.x - f * 5 * s * pull * aw + f * 7 * s * swing, py = r.y - (54 - 33 * duck) * s + breathe;
    T[P.PELVIS].x = px; T[P.PELVIS].y = py;
    const nx = px + Math.sin(lean) * 45 * s, ny = py - Math.cos(lean) * 45 * s;
    T[P.NECK].x = nx; T[P.NECK].y = ny;
    const hl = lean * 1.2 + f * 0.3 * duck + dizzy;
    T[P.HEAD].x = nx + Math.sin(hl) * 17 * s; T[P.HEAD].y = ny - Math.cos(hl) * 17 * s;
    // legs: feet planted, knees forward
    const ffx = r.x + f * (13 + 9 * duck) * s, bfx = r.x - f * (14 + 5 * duck) * s;
    T[P.FFOOT].x = ffx; T[P.FFOOT].y = r.y; T[P.BFOOT].x = bfx; T[P.BFOOT].y = r.y;
    let k = ik2(px, py, ffx, r.y, 29 * s, 28 * s, -f);
    T[P.FKNEE].x = k.x; T[P.FKNEE].y = k.y;
    k = ik2(px, py, bfx, r.y, 29 * s, 28 * s, -f);
    T[P.BKNEE].x = k.x; T[P.BKNEE].y = k.y;
    // throwing arm: carried at the hip, drawn back behind the head, whipped forward
    const sx = nx, sy = ny + 3 * s;
    let hx = nx + f * 15 * s, hy = ny + 24 * s + Math.sin(t * 2.4 + 1) * 1.5 * s;
    const bx = nx - ca * (20 + 22 * pull) * s, by = ny - sa * (20 + 22 * pull) * s - 14 * s * pull;
    hx = lerp(hx, bx, aw); hy = lerp(hy, by, aw);
    hx = lerp(hx, nx + ca * 46 * s, swing); hy = lerp(hy, ny + sa * 46 * s, swing);
    if (duck > 0) { hx = lerp(hx, nx + f * 12 * s, duck); hy = lerp(hy, ny - 4 * s, duck); }
    T[P.FHAND].x = hx; T[P.FHAND].y = hy;
    k = ik2(sx, sy, hx, hy, 24 * s, 24 * s, f);
    T[P.FELB].x = k.x; T[P.FELB].y = k.y;
    // off arm: hangs, points down the throw, holds a lid, or covers the head
    let ox = nx - f * 9 * s, oy = ny + 31 * s + Math.sin(t * 2.4) * 1.5 * s;
    ox = lerp(ox, nx + ca * 34 * s, aw * (1 - swing)); oy = lerp(oy, ny + sa * 34 * s + 5 * s, aw * (1 - swing));
    if (swing > 0) { ox = lerp(ox, nx - f * 22 * s, swing); oy = lerp(oy, ny + 20 * s, swing); }
    if (this.shield > 0) { ox = nx + f * 27 * s; oy = ny + 16 * s + Math.sin(t * 2.4) * 1.5 * s; }
    if (duck > 0) { ox = lerp(ox, nx + f * 2 * s, duck); oy = lerp(oy, ny - 8 * s, duck); }
    T[P.BHAND].x = ox; T[P.BHAND].y = oy;
    k = ik2(sx, sy, ox, oy, 24 * s, 24 * s, f);
    T[P.BELB].x = k.x; T[P.BELB].y = k.y;
  }

  stepBody(dt, plats) {
    const m = this.m, pts = this.pts, T = this.T, Tp = this.Tp;
    const g = G * dt * dt * (1 - 0.92 * m);
    const air = m < 0.5 ? 0.9985 : 0.985;
    const firm = this.throwT >= 0 || this.aimW > 0.5;
    for (let i = 0; i < 11; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * air, vy = (p.y - p.py) * air;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + g;
      if (m > 0.01) {
        let k = MUSCLE[i] * m, damping = MUSCLE_DAMP;
        if (firm && i >= P.FELB && i <= P.BHAND) { k = Math.min(0.5, k * 2.2); damping += 0.1; }
        const tvx = T[i].x - Tp[i].x, tvy = T[i].y - Tp[i].y;
        p.x += (T[i].x - p.x) * k - (vx - tvx) * damping * m;
        p.y += (T[i].y - p.y) * k - (vy - tvy) * damping * m;
      }
    }
    const s = this.s;
    const limp = this.mode === 'tumble' || this.mode === 'dead';
    for (let it = 0; it < 5; it++) {
      for (let b = 0; b < SEGS.length; b++) {
        const ia = SEGS[b][0], ib = SEGS[b][1], L = BONE_LEN[b] * s;
        solveDist(pts[ia], pts[ib], INV_MASS[ia], INV_MASS[ib], L, L, 1);
      }
      for (const [ia, ib, lo, hi] of JOINT_LIMITS) solveDist(pts[ia], pts[ib], INV_MASS[ia], INV_MASS[ib], lo * s, hi * s, 0.6);
      if (limp) for (const p of pts) for (const pl of plats) solidPoint(p, pl);
    }
  }

  // tumbling: once the body has come to rest on an island, stand back up there
  followBody(dt, plats) {
    this.tumbleT -= dt;
    const pv = this.pts[P.PELVIS];
    const speed = Math.hypot(pv.x - pv.px, pv.y - pv.py) / dt;
    if (this.tumbleT > 0 || speed > 150 || this.frozen > 0) { this.restT = 0; this.stuckT = 0; return; }
    // lying still but not cleanly on top (draped over an edge, wedged underneath):
    // after a moment, accept any island the body is tangled with
    const loose = this.stuckT > 0.8;
    let best = null;
    for (const pl of plats) {
      if (pl.falling || pl.kind !== 'foe' || pv.x < pl.left + (loose ? -20 : 6) || pv.x > pl.right - (loose ? -20 : 6)) continue;
      const d = pl.top - pv.y;
      if (d > (loose ? -(pl.h + 40) : -8) && d < (loose ? 95 : 60) * this.s && (!best || pl.top < best.top)) best = pl;
    }
    if (!best) { this.restT = 0; this.stuckT += dt; return; }
    this.restT += dt;
    if (this.restT < 0.35) return;
    this.plat = best; this.stuckT = 0;
    this.root.x = clamp(pv.x, best.left + 16, best.right - 16); this.root.y = best.top;
    this.platOff = this.root.x - best.x;
    this.mode = 'rising'; this.m = 0.05;
    this.computeTargets();
    for (let i = 0; i < 11; i++) { this.Tp[i].x = this.T[i].x; this.Tp[i].y = this.T[i].y; }
  }

  /* closest body part to a circle. Returns { seg, part, x, y } or null. The
     head counts first so a throw that clips both scores the headshot. */
  hitTest(x, y, r) {
    const s = this.s, pts = this.pts;
    const hd = pts[P.HEAD];
    if (Math.hypot(x - hd.x, y - hd.y) < r + HEAD_R * s) return { seg: 0, part: 'head', x: hd.x, y: hd.y, u: 1 };
    let best = null, bd = 1e9;
    for (let b = 1; b < SEGS.length; b++) {
      const A = pts[SEGS[b][0]], B = pts[SEGS[b][1]];
      const q = segPointDist(A.x, A.y, B.x, B.y, x, y);
      const pen = q.d - r - SEGS[b][2] * s;
      if (pen < 0 && pen < bd) { bd = pen; best = { seg: b, part: SEG_PART[b], x: lerp(A.x, B.x, q.t), y: lerp(A.y, B.y, q.t), u: q.t }; }
    }
    return best;
  }
  // nearest point index to a position, for aiming impulses
  nearestPoint(x, y) {
    let bi = 1, bd = 1e9;
    for (let i = 0; i < 11; i++) { const d = Math.hypot(this.pts[i].x - x, this.pts[i].y - y); if (d < bd) { bd = d; bi = i; } }
    return bi;
  }
  // something sticks into the body and rides along with that bone
  addStuck(id, hit, worldAng, r) {
    const A = this.pts[SEGS[hit.seg][0]], B = this.pts[SEGS[hit.seg][1]];
    const segAng = Math.atan2(B.y - A.y, B.x - A.x);
    this.stuck.push({ id, seg: hit.seg, u: hit.u, ang: worldAng - segAng, r });
    if (this.stuck.length > 7) this.stuck.shift();
  }

  draw(ctx, time) {
    const s = this.s, pts = this.pts;
    const fade = this.mode === 'dead' ? clamp(1 - (this.deadT - 2.6) / 0.9, 0, 1) : 1;
    if (fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let body = this.body, shade = this.shade;
    if (this.frozen > 0) { body = mixHex(body, '#bfe6ff', 0.7); shade = mixHex(shade, '#8fc4ea', 0.7); }
    if (this.gild > 0) { const g = Math.min(1, this.gild * 2); body = mixHex(body, '#ffd24a', g); shade = mixHex(shade, '#d9a321', g); }
    if (this.burn > 0) { body = mixHex(body, '#ff8a3a', 0.25 + Math.sin(time * 20) * 0.1); }
    if (this.flash > 0) { body = mixHex(body, '#ffffff', this.flash); shade = mixHex(shade, '#ffffff', this.flash); }
    const seg = (a, b, w, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = w * s;
      ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
    };
    // back limbs in the shade tone
    seg(2, 9, 13, shade); seg(9, 10, 11, shade);
    seg(1, 5, 11, shade); seg(5, 6, 9.5, shade);
    ctx.fillStyle = shade;
    ctx.beginPath(); ctx.arc(pts[P.BHAND].x, pts[P.BHAND].y, 5.3 * s, 0, TAU); ctx.fill();
    seg(1, 2, 22, body);
    // belt in the accent colour ties each thrower to its type
    const bx = lerp(pts[1].x, pts[2].x, 0.86), by = lerp(pts[1].y, pts[2].y, 0.86);
    const tx = pts[2].x - pts[1].x, ty = pts[2].y - pts[1].y, tl = Math.hypot(tx, ty) || 1;
    ctx.strokeStyle = this.accent; ctx.lineWidth = 5 * s; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(bx + ty / tl * 10.5 * s, by - tx / tl * 10.5 * s); ctx.lineTo(bx - ty / tl * 10.5 * s, by + tx / tl * 10.5 * s); ctx.stroke();
    ctx.lineCap = 'round';
    seg(2, 7, 13.5, body); seg(7, 8, 11.5, body);
    // head: rounded block with one eye, so facing reads at a glance
    const hd = pts[P.HEAD], hr = HEAD_R * s;
    const ha = Math.atan2(hd.y - pts[P.NECK].y, hd.x - pts[P.NECK].x) + Math.PI / 2;
    ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(ha);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.roundRect(-hr, -hr * 1.05, hr * 2, hr * 2.1, hr * 0.8); ctx.fill();
    const f = this.facing;
    ctx.strokeStyle = ctx.fillStyle = '#1a1c26';
    if (this.mode === 'dead' || this.stun > 0) {
      ctx.lineWidth = 2 * s; const ex = f * 5 * s, ey = -1 * s, q = 3 * s;
      ctx.beginPath(); ctx.moveTo(ex - q, ey - q); ctx.lineTo(ex + q, ey + q); ctx.moveTo(ex + q, ey - q); ctx.lineTo(ex - q, ey + q); ctx.stroke();
    } else {
      const blink = (time * 0.37 + this.t) % 3.1 < 0.09;
      ctx.beginPath(); ctx.ellipse(f * 5.5 * s, -1.5 * s, 2.2 * s, blink ? 0.6 * s : 3 * s, 0, 0, TAU); ctx.fill();
    }
    this.drawHeadgear(ctx, hr, time);
    ctx.restore();
    // things stuck in the body
    for (const st of this.stuck) {
      const A = pts[SEGS[st.seg][0]], B = pts[SEGS[st.seg][1]];
      const a = Math.atan2(B.y - A.y, B.x - A.x) + st.ang;
      ItemArt.draw(ctx, st.id, lerp(A.x, B.x, st.u) - Math.cos(a) * st.r * 0.5, lerp(A.y, B.y, st.u) - Math.sin(a) * st.r * 0.5, a + (st.id === 'forks' ? -Math.PI / 2 : 0), st.r, time);
    }
    // lid on the off hand
    if (this.shield > 0) ItemArt.draw(ctx, 'lid', pts[P.BHAND].x + f * 4 * s, pts[P.BHAND].y, 0, 25 * s, time);
    // the item being held, then the throwing arm over it
    if (this.hold && this.mode !== 'dead') {
      const h = pts[P.FHAND];
      ItemArt.draw(ctx, this.hold, h.x + f * 2 * s, h.y - this.holdR * 0.55, this.hold === 'forks' ? 0.3 * f : this.hold === 'plunger' || this.hold === 'firework' || this.hold === 'e_dart' ? this.aim : 0, this.holdR, time);
    }
    seg(1, 3, 11, body); seg(3, 4, 9.5, body);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(pts[P.FHAND].x, pts[P.FHAND].y, 5.8 * s, 0, TAU); ctx.fill();
    // frozen: a block of ice around the trunk
    if (this.frozen > 0) {
      const c = this.chest;
      ctx.globalAlpha = fade * 0.45; ctx.fillStyle = '#cfeeff';
      ctx.beginPath(); ctx.roundRect(c.x - 30 * s, c.y - 58 * s, 60 * s, 104 * s, 10 * s); ctx.fill();
      ctx.globalAlpha = fade * 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c.x - 20 * s, c.y - 46 * s); ctx.lineTo(c.x - 8 * s, c.y - 30 * s); ctx.moveTo(c.x + 12 * s, c.y + 10 * s); ctx.lineTo(c.x + 22 * s, c.y + 28 * s); ctx.stroke();
    }
    // dizzy stars
    if (this.stun > 0 && this.mode !== 'dead') {
      ctx.globalAlpha = fade; ctx.fillStyle = '#ffe14d';
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + i * TAU / 3;
        const x = hd.x + Math.cos(a) * 18 * s, y = hd.y - 20 * s + Math.sin(a) * 5 * s;
        ctx.beginPath(); ctx.arc(x, y, 3 * s, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  // drawn in head space: origin at the head centre, up is -y
  drawHeadgear(ctx, hr, time) {
    const f = this.facing, s = this.s;
    if (this.isPlayer) {
      // headband with two tails that trail behind
      ctx.fillStyle = this.accent;
      ctx.fillRect(-hr, -hr * 0.62, hr * 2, hr * 0.42);
      const w = Math.sin(time * 5) * 3 * s;
      ctx.strokeStyle = this.accent; ctx.lineWidth = 3.2 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-f * hr, -hr * 0.4); ctx.quadraticCurveTo(-f * hr * 1.7, -hr * 0.3 + w, -f * hr * 2.2, hr * 0.1 - w); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-f * hr, -hr * 0.4); ctx.quadraticCurveTo(-f * hr * 1.6, hr * 0.1 - w, -f * hr * 1.9, hr * 0.6 + w); ctx.stroke();
      return;
    }
    if (this.helmet) {
      ctx.fillStyle = '#8f98a8'; ctx.beginPath(); ctx.arc(0, -hr * 0.25, hr * 1.12, Math.PI, 0); ctx.lineTo(hr * 1.12, -hr * 0.05); ctx.lineTo(-hr * 1.12, -hr * 0.05); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b6bdca'; ctx.beginPath(); ctx.arc(-f * hr * 0.3, -hr * 0.55, hr * 0.45, Math.PI * 1.1, Math.PI * 1.7); ctx.lineTo(-f * hr * 0.3, -hr * 0.55); ctx.fill();
      ctx.strokeStyle = '#6d7586'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(-f * hr * 1.1, -hr * 0.1); ctx.lineTo(-f * hr * 1.8, -hr * 0.2); ctx.stroke();
    } else switch (this.hat) {
      case 'cap':
        ctx.fillStyle = this.accent; ctx.beginPath(); ctx.arc(0, -hr * 0.45, hr * 1.02, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.fillRect(f > 0 ? 0 : -hr * 1.75, -hr * 0.6, hr * 1.75, hr * 0.22);
        break;
      case 'jester':
        ctx.fillStyle = this.accent;
        ctx.beginPath(); ctx.moveTo(-hr, -hr * 0.6); ctx.lineTo(-hr * 1.5, -hr * 2); ctx.lineTo(0, -hr * 1.0); ctx.lineTo(hr * 1.5, -hr * 2); ctx.lineTo(hr, -hr * 0.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(-hr * 1.5, -hr * 2, 3 * s, 0, TAU); ctx.arc(hr * 1.5, -hr * 2, 3 * s, 0, TAU); ctx.fill();
        break;
      case 'horns':
        ctx.fillStyle = '#efe6d2';
        ctx.beginPath(); ctx.moveTo(-hr * 0.9, -hr * 0.7); ctx.quadraticCurveTo(-hr * 1.7, -hr * 1.2, -hr * 1.3, -hr * 1.9); ctx.quadraticCurveTo(-hr * 0.9, -hr * 1.2, -hr * 0.3, -hr); ctx.fill();
        ctx.beginPath(); ctx.moveTo(hr * 0.9, -hr * 0.7); ctx.quadraticCurveTo(hr * 1.7, -hr * 1.2, hr * 1.3, -hr * 1.9); ctx.quadraticCurveTo(hr * 0.9, -hr * 1.2, hr * 0.3, -hr); ctx.fill();
        break;
      case 'fuse':
        ctx.strokeStyle = '#3a2c20'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(0, -hr); ctx.quadraticCurveTo(hr * 0.5, -hr * 1.7, -hr * 0.2, -hr * 1.9); ctx.stroke();
        ctx.fillStyle = Math.sin(time * 30) > 0 ? '#ffb347' : '#fff0b8'; ctx.beginPath(); ctx.arc(-hr * 0.2, -hr * 1.9, 3.2 * s, 0, TAU); ctx.fill();
        break;
      case 'goggles':
        ctx.fillStyle = '#3a3f52'; ctx.fillRect(-hr, -hr * 0.5, hr * 2, hr * 0.5);
        ctx.fillStyle = '#9fe0ff'; ctx.beginPath(); ctx.arc(f * hr * 0.45, -hr * 0.25, hr * 0.42, 0, TAU); ctx.fill();
        break;
      case 'pot': break;   // the guard's pot is its helmet
      default: break;
    }
    if (this.crown) {
      const y = this.helmet ? -hr * 1.35 : -hr * 1.0;
      ctx.fillStyle = '#ffcf3a';
      ctx.beginPath(); ctx.moveTo(-hr * 0.85, y); ctx.lineTo(-hr * 0.95, y - hr * 0.95); ctx.lineTo(-hr * 0.4, y - hr * 0.45); ctx.lineTo(0, y - hr * 1.05); ctx.lineTo(hr * 0.4, y - hr * 0.45);
      ctx.lineTo(hr * 0.95, y - hr * 0.95); ctx.lineTo(hr * 0.85, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e2434b'; ctx.beginPath(); ctx.arc(0, y - hr * 0.3, 2.4 * s, 0, TAU); ctx.fill();
    }
  }
}

function solveDist(A, B, wa, wb, d0, d1, stiff) {
  const dx = B.x - A.x, dy = B.y - A.y;
  const d = Math.hypot(dx, dy) || 1e-4;
  const target = d < d0 ? d0 : d > d1 ? d1 : d;
  if (target === d) return;
  const k = ((d - target) / d) * stiff / (wa + wb);
  A.x += dx * k * wa; A.y += dy * k * wa;
  B.x -= dx * k * wb; B.y -= dy * k * wb;
}

/* a verlet point against a solid island box. Whatever was above the top last
   step lands on it (with friction); otherwise it is pushed out the near side. */
function solidPoint(p, pl) {
  if (p.x <= pl.left || p.x >= pl.right || p.y <= pl.top || p.y >= pl.bottom) return;
  const du = p.y - pl.top, dl = p.x - pl.left, dr = pl.right - p.x, db = pl.bottom - p.y;
  if (p.py <= pl.top + 10 || du <= Math.min(dl, dr, db)) {
    p.y = pl.top;
    p.px = lerp(p.px, p.x, 0.35);
    p.py = p.y + Math.min(0, p.py - p.y) * 0.2;
  } else if (dl < dr && dl < db) { p.x = pl.left; p.px = p.x + Math.max(0, p.px - p.x) * 0.3; }
  else if (dr < db) { p.x = pl.right; p.px = p.x + Math.min(0, p.px - p.x) * 0.3; }
  else { p.y = pl.bottom; p.py = p.y + Math.max(0, p.py - p.y) * 0.2; }
}
