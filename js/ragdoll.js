'use strict';
/* =========================================================================
   Rag: a physical ragdoll that can also stand. Eleven verlet points with
   their own mass and collision radius are joined by bones, with one-way
   hinges at the knees and elbows and soft limits at the hips, shoulders and
   neck. While standing, "muscles" pull the points toward an animated pose.
   Nothing about a hit is scripted: a throw pushes the bone it lands on, the
   muscles go soft for a moment (daze), the body bends around the blow, the
   feet shuffle to get back under the hips, and if the hips end up past the
   edge of the island or the trunk tips too far, the muscles let go and the
   body falls as a limp ragdoll. A limp body that comes to rest on an island
   gets back up; one that misses falls into the sky.
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
// collision radius of each point, so a limp body lies on the ground instead of sinking into it
const PT_R = [13, 10, 10, 5.5, 5, 5.5, 5, 6.5, 5.5, 6.5, 5.5];
// one-way hinges [root, joint, tip, side]: knees only fold back, elbows only fold forward
const HINGES = [[2, 7, 8, -1], [2, 9, 10, -1], [1, 3, 4, 1], [1, 5, 6, 1]];
const GROUND_FRICTION = 0.3, GROUND_BOUNCE = 0.2;
const THROW_DUR = 0.46;        // a whole throw: whip, follow-through, recovery
const MAX_STEP = 26;           // fastest any point may move in one physics step (px)
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
    this.homeOff = this.platOff;    // where it likes to stand on its island
    this.homeOff0 = this.platOff;   // the spot it was spawned at (the player walks back to it)
    this.weight = o.weight || 1;    // heavier bodies take less from the same blow
    this.steady = !!o.steady;       // never loses its footing (the player, bosses)
    this.daze = 0;                  // 0..1: how soft the muscles are right now
    this.leanT = 0;                 // the lean the pose is asking for
    this.jv = { x: 0, y: 0, vx: 0, vy: 0 };   // a small whole-body shake from a hit, drawn on top of the physics
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

  // a change of velocity at one point, with a share passed on to the rest of the body
  impulse(idx, vx, vy, spread = 0.35) {
    const w = STEP / this.weight;
    for (let i = 0; i < 11; i++) {
      const k = (i === idx ? 1 : spread) * INV_MASS[i] * w;
      this.pts[i].px -= vx * k; this.pts[i].py -= vy * k;
    }
  }
  // the same, applied where a throw actually landed: split between the two ends of
  // the bone by how far along it the hit was, so an off-centre blow turns the body
  impulseAt(hit, vx, vy, spread = 0.2) {
    const a = SEGS[hit.seg][0], b = SEGS[hit.seg][1], u = hit.u == null ? 0.5 : hit.u;
    const w = STEP / this.weight;
    for (let i = 0; i < 11; i++) {
      const k = (i === a ? 1 - u * 0.6 : i === b ? 0.4 + u * 0.6 : spread) * INV_MASS[i] * w;
      this.pts[i].px -= vx * k; this.pts[i].py -= vy * k;
    }
  }
  // a quick shake of the drawn body: how a frozen foe or a heavy lid takes a hit
  jolt(x, y) { this.jv.vx += x * 40; this.jv.vy += y * 40; }
  // muscles go soft for a moment after a blow; heavy bodies shrug more of it off
  stagger(a) { if (this.frozen <= 0) this.daze = Math.min(1, this.daze + a / this.weight); }
  // lose the fight to stay upright: let go and fall with whatever speed the body has
  topple() {
    if (this.mode !== 'active' && this.mode !== 'rising') return;
    this.mode = 'tumble'; this.m = 0; this.tumbleT = 0.45; this.restT = 0; this.stuckT = 0; this.plat = null;
    this.pull = 0; this.throwT = -1; this.aimW = 0; this.daze = 0;
  }
  /* A hit: the muscles switch off, the impulse goes into the bone that was struck (shared
     out along the bone by where on it the blow landed) and the body drops limp for a
     moment, then stands back up. This is the whole reaction: no flash-and-stand. */
  hitLimp(hit, vx, vy, dur) {
    if (this.mode === 'dead') return;
    const was = this.mode;
    if (was !== 'tumble') this.hurtPlat = this.plat;     // a body knocked flat by a plain hit stays on its island
    this.mode = 'tumble'; this.m = 0; this.tumbleT = Math.max(dur, was === 'tumble' ? this.tumbleT : 0); this.restT = 0; this.stuckT = 0; this.plat = null;
    this.pull = 0; this.throwT = -1; this.aimW = 0; this.daze = 0; this.hurtLimp = true;
    const a = SEGS[hit.seg][0], b = SEGS[hit.seg][1], u = hit.u == null ? 0.5 : hit.u, w = STEP / this.weight;
    for (let i = 0; i < 11; i++) {
      const k = (i === a ? 1.5 * (1 - u * 0.5) : i === b ? 1.5 * (0.5 + u * 0.5) : 0.55) * w;
      this.pts[i].px -= vx * k; this.pts[i].py -= vy * k;
    }
  }
  // thrown clear: go limp with a velocity. The struck point gets more of it than
  // the rest, which is what sets the body spinning.
  knock(vx, vy, idx = P.NECK, dur = 0.55) {
    if (this.mode === 'dead') return;
    this.mode = 'tumble'; this.m = 0; this.tumbleT = dur; this.restT = 0; this.stuckT = 0; this.plat = null; this.hurtLimp = false; this.hurtPlat = null;
    this.pull = 0; this.throwT = -1; this.aimW = 0; this.daze = 0;
    for (let i = 0; i < 11; i++) {
      const k = (i === idx ? 2.3 : 0.7) * STEP;
      this.pts[i].px -= (vx + rand(-40, 40)) * k; this.pts[i].py -= (vy + rand(-40, 40)) * k;
    }
  }
  die(vx, vy, idx = P.NECK) {
    if (this.mode === 'dead') return;
    this.mode = 'dead'; this.m = 0; this.deadT = 0; this.plat = null; this.frozen = 0; this.stun = 0; this.daze = 0;
    this.hold = null; this.pull = 0;
    for (let i = 0; i < 11; i++) {
      const k = (i === idx ? 2.4 : 0.65) * STEP;
      this.pts[i].px -= (vx + rand(-50, 50)) * k; this.pts[i].py -= (vy + rand(-50, 50)) * k;
    }
  }
  revive(plat, x) {
    this.mode = 'active'; this.m = 1; this.plat = plat; this.root.x = x; this.root.y = plat.top; this.platOff = this.homeOff = x - plat.x;
    this.stun = 0; this.daze = 0; this.frozen = 0; this.burn = 0; this.stuck.length = 0;
    this.snap();
  }

  update(dt, plats) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 5);
    this.gild = Math.max(0, this.gild - dt);
    if (this.throwT >= 0) { this.throwT += dt; if (this.throwT > THROW_DUR) this.throwT = -1; }
    if (this.mode === 'active' || this.mode === 'rising') {
      if (this.plat) {
        const nx = this.plat.x + this.platOff, ny = this.plat.top;
        const dx = nx - this.root.x, dy = ny - this.root.y;
        if (dx || dy) { this.root.x = nx; this.root.y = ny; this.shift(dx, dy); }
      }
      if (this.mode === 'rising') { this.m = Math.min(1, this.m + dt * 3.2); if (this.m >= 1) this.mode = 'active'; }
      this.daze = Math.max(0, this.daze - dt * 1.5);
      if (this.frozen <= 0) this.computeTargets();
      else for (let i = 0; i < 11; i++) { this.Tp[i].x = this.T[i].x; this.Tp[i].y = this.T[i].y; }
    }
    const j = this.jv;
    j.vx += (-j.x * 900 - j.vx * 24) * dt; j.vy += (-j.y * 900 - j.vy * 24) * dt; j.x += j.vx * dt; j.y += j.vy * dt;
    this.stepBody(dt, plats);
    if (this.mode === 'active' && this.frozen <= 0) this.balance(dt);
    if (this.mode === 'tumble') this.followBody(dt, plats);
    if (this.mode === 'dead') this.deadT += dt;
  }

  /* The pose. A throw is built from four overlapping curves rather than one:
       cock   (0..1)  while the pull is held: weight sinks onto the back foot, the
                      torso leans away, the hand goes behind the head, the off arm
                      points down the throw and the front foot lifts
       whip   (0..1)  the arm: fast out, a small overshoot, then back to the hip
       commit (0..1)  the body: hips drive forward, the front foot plants, the
                      back heel comes up, the torso folds into the throw
       over           the overshoot itself, a little extra reach at the peak
     so the arm leads, the body follows a beat later and recovers more slowly. */
  computeTargets() {
    const s = this.s, f = this.facing, r = this.root, T = this.T, Tp = this.Tp;
    for (let i = 0; i < 11; i++) { Tp[i].x = T[i].x; Tp[i].y = T[i].y; }
    const t = this.t, duck = this.duck, aw = this.aimW;
    const cock = clamp(this.pull * aw, 0, 1);
    const ca = Math.cos(this.aim), sa = Math.sin(this.aim);
    let whip = 0, commit = 0, over = 0;
    if (this.throwT >= 0) {
      const u = this.throwT / THROW_DUR;
      whip = u < 0.2 ? easeOut(u / 0.2) : u < 0.5 ? 1 : 1 - easeInOut((u - 0.5) / 0.5);
      commit = u < 0.22 ? easeOut(u / 0.22) : u < 0.58 ? 1 : 1 - easeInOut((u - 0.58) / 0.42);
      over = u > 0.2 && u < 0.5 ? Math.sin((u - 0.2) / 0.3 * Math.PI) : 0;
    }
    const dizzy = this.stun > 0 ? Math.sin(t * 7) * 0.16 : 0;
    const breathe = Math.sin(t * 2.4) * 1.4 * s * (1 - cock);
    const lean = f * (-0.3 * cock + 0.55 * commit + 1.05 * duck) + Math.sin(t * 1.3) * 0.02 + dizzy;
    this.leanT = lean;
    const fy = r.y - PT_R[P.FFOOT] * s;     // the foot point sits one radius above the ground
    const px = r.x - f * 9 * s * cock + f * 14 * s * commit;
    const py = r.y - (58 - 33 * duck - 8 * cock - 3 * commit) * s + breathe;
    T[P.PELVIS].x = px; T[P.PELVIS].y = py;
    const nx = px + Math.sin(lean) * 45 * s, ny = py - Math.cos(lean) * 45 * s;
    T[P.NECK].x = nx; T[P.NECK].y = ny;
    const hl = lean * 0.85 + f * 0.3 * duck - f * 0.14 * commit + dizzy;   // the head trails the torso
    T[P.HEAD].x = nx + Math.sin(hl) * 17 * s; T[P.HEAD].y = ny - Math.cos(hl) * 17 * s;
    // legs: the front foot lifts as the arm cocks, then plants a long step ahead; the back heel drives up
    const ffx = r.x + f * (13 + 9 * duck + 6 * cock + 14 * commit) * s, bfx = r.x - f * (14 + 5 * duck + 7 * cock - 1 * commit) * s;
    const ffy = fy - 4 * s * cock * (1 - commit), bfy = fy - 7 * s * commit;
    T[P.FFOOT].x = ffx; T[P.FFOOT].y = ffy; T[P.BFOOT].x = bfx; T[P.BFOOT].y = bfy;
    let k = ik2(px, py, ffx, ffy, 29 * s, 28 * s, -f);
    T[P.FKNEE].x = k.x; T[P.FKNEE].y = k.y;
    k = ik2(px, py, bfx, bfy, 29 * s, 28 * s, -f);
    T[P.BKNEE].x = k.x; T[P.BKNEE].y = k.y;
    // throwing arm: rest at the hip, cock behind the head, whip through along the aim and overshoot
    const sx = nx, sy = ny + 3 * s;
    let hx = nx + f * 15 * s, hy = ny + 24 * s + Math.sin(t * 2.4 + 1) * 1.5 * s;
    const bx = nx - ca * (20 + 26 * this.pull) * s, by = ny - sa * (20 + 26 * this.pull) * s - 16 * s * this.pull;
    hx = lerp(hx, bx, aw); hy = lerp(hy, by, aw);
    const reach = (46 + 52 * over) * s;
    hx = lerp(hx, nx + ca * reach, whip); hy = lerp(hy, ny + sa * reach, whip);
    hy -= Math.sin(whip * Math.PI) * 26 * s * (1 - over * 0.5);       // the hand goes over the top, not through the head
    if (duck > 0) { hx = lerp(hx, nx + f * 12 * s, duck); hy = lerp(hy, ny - 4 * s, duck); }
    T[P.FHAND].x = hx; T[P.FHAND].y = hy;
    k = ik2(sx, sy, hx, hy, 24 * s, 24 * s, f);
    T[P.FELB].x = k.x; T[P.FELB].y = k.y;
    // off arm: points down the throw while aiming, then snaps back into the ribs for balance
    let ox = nx - f * 9 * s, oy = ny + 31 * s + Math.sin(t * 2.4) * 1.5 * s;
    ox = lerp(ox, nx + ca * 34 * s, aw * (1 - whip)); oy = lerp(oy, ny + sa * 34 * s + 5 * s, aw * (1 - whip));
    ox = lerp(ox, nx - f * 24 * s, whip); oy = lerp(oy, ny + 16 * s, whip);
    if (this.shield > 0) { ox = nx + f * 27 * s; oy = ny + 16 * s + Math.sin(t * 2.4) * 1.5 * s; }
    if (duck > 0) { ox = lerp(ox, nx + f * 2 * s, duck); oy = lerp(oy, ny - 8 * s, duck); }
    T[P.BHAND].x = ox; T[P.BHAND].y = oy;
    k = ik2(sx, sy, ox, oy, 24 * s, 24 * s, f);
    T[P.BELB].x = k.x; T[P.BELB].y = k.y;
  }

  stepBody(dt, plats) {
    const pts = this.pts, T = this.T, Tp = this.Tp, s = this.s;
    // a dazed body's muscles are soft, so it sags and bends around the blow before pulling itself together
    const m = this.m * (1 - 0.9 * this.daze);
    const g = G * dt * dt * (1 - 0.9 * m);
    const air = m < 0.5 ? 0.9988 : 0.986;
    const firm = this.throwT >= 0 || this.aimW > 0.5;
    for (let i = 0; i < 11; i++) {
      const p = pts[i];
      let vx = (p.x - p.px) * air, vy = (p.y - p.py) * air;
      const vm = Math.hypot(vx, vy);
      if (vm > MAX_STEP) { vx *= MAX_STEP / vm; vy *= MAX_STEP / vm; }      // nothing is flung faster than this
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
    const limp = this.mode === 'tumble' || this.mode === 'dead';
    const f = this.facing;
    for (let it = 0; it < 6; it++) {
      for (let b = 0; b < SEGS.length; b++) {
        const ia = SEGS[b][0], ib = SEGS[b][1], L = BONE_LEN[b] * s;
        solveDist(pts[ia], pts[ib], INV_MASS[ia], INV_MASS[ib], L, L, 1);
      }
      for (const [ia, ib, lo, hi] of JOINT_LIMITS) solveDist(pts[ia], pts[ib], INV_MASS[ia], INV_MASS[ib], lo * s, hi * s, 0.6);
      // hinges: push a knee or elbow that has folded the wrong way back across the limb's line
      if (limp || this.daze > 0) for (const [ia, ij, ib, side] of HINGES) {
        const A = pts[ia], J = pts[ij], B = pts[ib];
        const ax = B.x - A.x, ay = B.y - A.y, L = Math.hypot(ax, ay) || 1e-4;
        const d = (ax * (J.y - A.y) - ay * (J.x - A.x)) / L;     // signed distance of the joint from the line
        if (d * f * side >= 0) continue;
        const nx = -ay / L, ny = ax / L, k = d * 0.5;
        J.x -= nx * k; J.y -= ny * k;
        A.x += nx * k * 0.25; A.y += ny * k * 0.25; B.x += nx * k * 0.25; B.y += ny * k * 0.25;
      }
      if (limp) { for (let i = 0; i < 11; i++) for (const pl of plats) solidCircle(pts[i], PT_R[i] * s, pl); }
      else if (this.plat && !this.plat.falling) for (let i = 0; i < 11; i++) solidCircle(pts[i], PT_R[i] * s, this.plat);
    }
  }

  /* Staying upright. The hips get shoved off the stance by a blow; the feet
     shuffle after them (faster the more dazed the body is) and walk back when
     things calm down. Shuffle past the edge of the island, tip the trunk too far
     or let the hips drop, and the body gives up and falls. */
  balance(dt) {
    const s = this.s, pts = this.pts, pv = pts[P.PELVIS], nk = pts[P.NECK], pl = this.plat;
    const ex = pv.x - this.T[P.PELVIS].x;
    if (Math.abs(ex) > 6 * s) {
      let step = clamp(ex * 9, -200, 200) * dt * (0.4 + 1.4 * this.daze);
      if (this.steady) step = clamp(this.platOff + step, this.homeOff - 22, this.homeOff + 22) - this.platOff;
      this.platOff += step; this.root.x += step;
    } else if (this.daze < 0.05 && this.platOff !== this.homeOff) {
      const to = approach(this.platOff, this.homeOff, 26 * dt);
      this.root.x += to - this.platOff; this.platOff = to;
    }
    if (this.steady || !pl) return;
    if (Math.abs(this.platOff) > pl.w / 2 - 3 * s) { this.topple(); return; }
    const tilt = Math.atan2(nk.x - pv.x, pv.y - nk.y);
    if (this.duck < 0.3 && this.daze > 0.05 && (Math.abs(angDiff(this.leanT, tilt)) > 0.9 || pv.y > this.T[P.PELVIS].y + 24 * s)) this.topple();
  }

  // tumbling: once the body has come to rest on an island, stand back up there
  followBody(dt, plats) {
    this.tumbleT -= dt;
    const pv = this.pts[P.PELVIS];
    const speed = Math.hypot(pv.x - pv.px, pv.y - pv.py) / dt;
    if (this.tumbleT > 0 || speed > (this.hurtLimp ? 260 : 150) || this.frozen > 0) { this.restT = 0; this.stuckT = 0; return; }
    // lying still but not cleanly on top (draped over an edge, wedged underneath):
    // after a moment, accept any island the body is tangled with
    const loose = this.stuckT > 0.8;
    let best = null;
    for (const pl of plats) {
      if (pl.falling || pl.kind === 'wall' || (pl.kind === 'player') !== this.isPlayer || pv.x < pl.left + (loose ? -20 : 6) || pv.x > pl.right - (loose ? -20 : 6)) continue;
      const d = pl.top - pv.y;
      if (d > (loose ? -(pl.h + 40) : -8) && d < (loose ? 95 : 60) * this.s && (!best || pl.top < best.top)) best = pl;
    }
    if (!best) { this.restT = 0; this.stuckT += dt; return; }
    this.restT += dt;
    if (this.restT < (this.hurtLimp ? 0.12 : 0.35)) return;
    this.plat = best; this.stuckT = 0; this.hurtLimp = false;
    this.root.x = clamp(pv.x, best.left + 16, best.right - 16); this.root.y = best.top;
    this.platOff = this.root.x - best.x;
    this.homeOff = this.isPlayer ? this.homeOff0 : clamp(this.platOff, -(best.w / 2 - 24), best.w / 2 - 24);
    this.mode = 'rising'; this.m = 0.05; this.daze = 0;
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
    if (this.jv.x || this.jv.y) ctx.translate(this.jv.x, this.jv.y);
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
    seg(2, 7, 13.5, body); seg(7, 8, 11.5, body);
    // head: a plain rounded block
    const hd = pts[P.HEAD], hr = HEAD_R * s;
    const ha = Math.atan2(hd.y - pts[P.NECK].y, hd.x - pts[P.NECK].x) + Math.PI / 2;
    ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(ha);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.roundRect(-hr, -hr * 1.05, hr * 2, hr * 2.1, hr * 0.8); ctx.fill();
    const f = this.facing;
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
      case 'witch':
        ctx.fillStyle = '#3a2a5a'; ctx.beginPath(); ctx.ellipse(0, -hr * 0.75, hr * 1.75, hr * 0.36, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-hr * 0.9, -hr * 0.8); ctx.quadraticCurveTo(-hr * 0.2, -hr * 2.4, hr * 0.9, -hr * 3.0); ctx.quadraticCurveTo(hr * 0.5, -hr * 1.6, hr * 0.9, -hr * 0.8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffcf3a'; ctx.fillRect(-hr * 0.9, -hr * 1.05, hr * 1.8, hr * 0.28);
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

/* A verlet point with a radius against a solid island box. The contact
   normal comes from the nearest point on the box; the velocity along it is
   reflected with a little bounce and the velocity across it is rubbed away. */
function solidCircle(p, r, pl) {
  const L = pl.left, R = pl.right, T = pl.top, B = pl.bottom;
  if (p.x <= L - r || p.x >= R + r || p.y <= T - r || p.y >= B + r) return;
  let nx = 0, ny = 0, pen = 0;
  const cx = clamp(p.x, L, R), cy = clamp(p.y, T, B);
  const dx = p.x - cx, dy = p.y - cy;
  if (dx === 0 && dy === 0) {
    // centre inside the box: out through the top if it came from above, else the nearest face
    const du = p.y - T, dl = p.x - L, dr = R - p.x, db = B - p.y;
    if (p.py <= T + 8 || du <= Math.min(dl, dr, db)) { ny = -1; pen = du + r; }
    else if (dl < dr && dl < db) { nx = -1; pen = dl + r; }
    else if (dr < db) { nx = 1; pen = dr + r; }
    else { ny = 1; pen = db + r; }
  } else {
    const d = Math.hypot(dx, dy);
    if (d >= r) return;
    nx = dx / d; ny = dy / d; pen = r - d;
  }
  let vx = p.x - p.px, vy = p.y - p.py;
  p.x += nx * pen; p.y += ny * pen;
  const vn = vx * nx + vy * ny;
  if (vn < 0) {
    const tx = vx - vn * nx, ty = vy - vn * ny;
    // only a real impact bounces; a body at rest just rests
    const e = vn < -1.6 ? GROUND_BOUNCE : 0;
    vx = tx * (1 - GROUND_FRICTION) - vn * e * nx; vy = ty * (1 - GROUND_FRICTION) - vn * e * ny;
  }
  p.px = p.x - vx; p.py = p.y - vy;
}
