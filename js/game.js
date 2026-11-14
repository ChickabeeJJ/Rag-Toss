'use strict';
/* =========================================================================
   Game: the run itself. Drag-and-release throwing, every item's gimmick,
   foes and their throws, knockback and ring-outs, stages, bosses, perks,
   mystery crates, scoring, camera and rendering.
   The simulation only ever advances in whole STEP-sized steps.
   ========================================================================= */

const Game = (() => {
  let canvas, ctx, cw = 0, ch = 0, dpr = 1;
  const view = { s: 1, ox: 0, oy: 0 };
  let menuInset = 0, menuT = 1;
  let state = 'menu';             // menu | play | over
  let paused = false, hold = false;
  let time = 0, acc = 0, slowT = 0, slowK = 0.5, hitStop = 0, shake = 0, hurtFlash = 0, healFlash = 0;
  let player = null, home = null, wall = null;
  let plats = [], foes = [], shots = [], crates = [], zones = [];
  const throwLog = new Map();
  let run = null;
  let themeFrom = 0, themeTo = 0, themeT = 1;
  const aim = { vis: 0, moved: 0, on: false, id: null, sx: 0, sy: 0, cx: 0, cy: 0, power: 0, ang: 0, max: 200, t: 0 };
  const PULL_DEAD = 16;
  let duckHeld = false, duckTired = false, duckOn = false, duckT = 0, pending = null, demoT = 1.5, staFlash = 0;
  const on = { over: null, perk: null, toast: null, banner: null, tut: null };

  const HOME_X = 262, HOME_Y = 620;
  const FEVER_T = 7, FEVER_EVERY = 10, STAND_T = 3.4;
  const coinFx = []; let coinTarget = { x: 0, y: 0 }, coinPing = 0, feverGlow = 0;
  const ARC_T = 0.8;           // the throw rejoins the previewed arc about this far into its flight
  const RELEASE_AT = 0.07;     // seconds into the whip when the item leaves the hand
  // upgrades are read from the levels the run started with: buying one only reaches the next new run
  const ulvl = id => (run && run.ups ? run.ups[id] || 0 : Save.lvl(id));
  const pk = id => (run && run.perks[id]) || 0;
  // a foe still riding its island up from below the screen can't be hit yet
  const live = f => f.rag.alive && !(f.plat && f.plat.state === 'in' && f.rag.mode === 'active');
  const theme = () => THEMES[themeT > 0.5 ? themeTo : themeFrom];

  /* ---------------------------------------------------------------- setup */
  function init(cv) {
    canvas = cv; ctx = canvas.getContext('2d');
    World.init();
    Fx.setSolids(() => plats);
    resize();
    toMenu();
  }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  }
  function setMenuInset(px) { menuInset = px; }

  function freshRun(demo) {
    return {
      demo, kos: 0, stage: 1, stageKills: 0, coins: 0, combo: 0, bestCombo: 0, perks: {}, boss: null, bossT: -1, spawnT: 0.5,
      crateT: rand(10, 14), lastKoAt: -9, seq: 0, t: 0, heads: 0, rings: 0, overT: -1, perkT: -1, crates: 0, bosses: 0,
      fever: 0, fevers: 0, stand: 0, stood: false, bounty: null, bountyN: 0, bountyT: 3, bountyLast: '', goldT: rand(26, 40), beatBest: false, closeCalls: 0, mastered: [],
    };
  }
  // the Rookie's headband: the colour picked from those your rank has unlocked. Prismatic (top rank) slowly drifts through every colour as the match goes on.
  function bandColor(t) {
    let b = Save.data.band;
    let at = BANDS.indexOf(b);
    if (at < 0 || at > Save.rankInfo().i) b = BANDS[0];
    if (b === 'prismatic') return `hsl(${Math.floor(((run && !run.demo ? run.t : t) * 7) % 360)}, 92%, 62%)`;
    return b;
  }
  function buildWorld() {
    plats = []; foes = []; shots = []; crates = []; zones = []; throwLog.clear(); Fx.clear();
    home = new Plat(250, HOME_Y, 300, 'player'); home.h = 300; home.bobA = 0;
    wall = new Plat(142, HOME_Y - 66, 44, 'wall'); wall.h = 66;
    plats.push(home, wall);
    const who = CHAR[Save.data.char] || CHAR.rookie;
    const rag = new Rag({ x: HOME_X, y: HOME_Y, facing: 1, isPlayer: true, body: who.body, shade: who.shade, accent: who.accent || bandColor(0), hat: who.hat, plat: home, weight: 1.3, steady: true });
    player = { rag, hp: 100, maxHp: 100, sta: 100, maxSta: 100, cd: 0, staWait: 0, slot: 0, bonus: null, dead: false, inv: 0 };
    refreshStats(true);
    selectFirstSlot();
  }
  function refreshStats(full) {
    const maxHp = 100 + 15 * ulvl('health') + 35 * pk('skin');
    if (full) player.hp = maxHp; else player.hp = Math.min(maxHp, player.hp + Math.max(0, maxHp - player.maxHp));
    player.maxHp = maxHp;
    player.maxSta = 200 + 20 * ulvl('stamina');
    if (full) player.sta = player.maxSta;
  }
  // a run throws from the bag it started with: changing the loadout in the shop only reaches the next new run
  const bag = () => (run && run.bag) || Save.data.bag;
  function selectFirstSlot() { const b = bag(); if (!b[player.slot]) player.slot = Math.max(0, b.findIndex(Boolean)); }
  const dmgMul = () => (1 + 0.08 * ulvl('power')) * (1 + 0.25 * pk('heavy'));
  const coinMul = () => (1 + 0.1 * ulvl('greed')) * (1 + 0.3 * pk('rich'));
  // Stamina: a big pool, small costs. A throw takes a few points, holding a wind-up
  // sips at it, a duck is a flat fee, and it refills by itself the whole time.
  const DUCK_COST = 5, HOLD_DRAIN = 2.5, DUCK_MAX = 1.5;
  const staRegen = () => 7.7 * (1 + 0.1 * ulvl('regen')) * (1 + 0.4 * pk('lungs'));
  const throwCd = () => 0.42 * (1 - 0.08 * ulvl('quick'));
  const staCost = def => def.sta * (1 - Math.min(0.6, 0.2 * pk('cheap')));
  const armor = () => 1 - 0.05 * ulvl('armor');
  const foeHpMul = () => 1.12 * (1 + 0.19 * (run.stage - 1) + 0.03 * Math.pow(Math.max(0, run.stage - 4), 2));
  // enemies hit a little harder with every one that has been sent at you: +0.3% each, in a straight line
  const foeDmgMul = () => (1 + 0.1 * (run.stage - 1) + 0.01 * Math.pow(Math.max(0, run.stage - 6), 2)) * (1 + 0.003 * (run.spawned || 0));
  const usingBonus = () => !!(player.bonus && player.bonus.on);
  const currentItemId = () => (previewId ? previewId : usingBonus() ? player.bonus.id : bag()[player.slot] || 'rock');

  function toMenu() {
    state = 'menu'; paused = false; hold = false; slowT = 0; hitStop = 0;
    run = freshRun(true);
    themeFrom = themeTo = (Math.max(1, Save.data.best.stage) - 1) % THEMES.length; themeT = 1;
    buildWorld();
    const d = spawnFoe('chucker', null, { x: 900, y: 560 });
    d.dummy = true; d.plat.state = 'idle'; d.plat.y = d.plat.baseY; d.rag.snap();
    demoT = 1.2; aimCancel();
    Sfx.setStage(1);
  }
  function start(opts = {}) {
    state = 'play'; paused = false; hold = false; slowT = 0; hitStop = 0; acc = 0; coinFx.length = 0; Sfx.setHype(false);
    run = freshRun(false);
    themeFrom = themeTo = 0; themeT = 1;
    buildWorld();
    aimCancel(); duckHeld = false; duckTired = false; duckOn = false; pending = null;
    const saved = opts.resume && Save.data.run;
    if (saved) {
      restoreRun(saved);
      return;
    }
    run.bag = Save.data.bag.slice(); run.ups = Object.assign({}, Save.data.upgrades);
    Save.clearRun();
    Sfx.setStage(1);
    if (opts.tutorial) startTut();
    else if (on.banner) on.banner('STAGE 1', THEMES[0].name.toUpperCase());
  }
  /* What a quit has to remember: all of it. The score, the bag, health and stamina, the streak, frenzy,
     last stand, the bounty, every foe (and the boss) with its health and island, crates in the air,
     throws in flight, open pocket holes and a perk offer that was still on screen. */
  const plain = o => JSON.parse(JSON.stringify(o));
  function saveRun() {
    // knocked out but the results have not come up yet: leaving now ends the run for good, with its stats recorded
    if (run && !run.demo && !run.tut && state === 'play' && player && player.dead) { finishRun(true); return 'ended'; }
    if (!run || run.demo || run.tut || state !== 'play' || !player || player.dead || run.overT > 0) return;
    // a run that was started and left alone (no throw, no knockout) is not worth keeping
    if (!run.resumed && !run.throws && !run.kos) return 'empty';
    const keep = {};
    for (const k of ['stage', 'kos', 'coins', 'bestCombo', 'stood', 'bountyN', 'closeCalls', 'fevers', 'heads', 'rings', 'bosses', 'crates', 'stageKills', 'combo', 'fever', 'stand', 'bountyT', 'bountyLast',
      'goldT', 'crateT', 'spawnT', 'bossT', 'perkT', 't', 'lastKoAt', 'beatBest', 'spawned']) keep[k] = run[k];
    keep.bag = run.bag; keep.ups = run.ups; keep.perks = run.perks; keep.mastered = run.mastered;
    keep.bounty = run.bounty; keep.perkPick = run.perkPick || null;
    keep.hp = player.hp; keep.sta = player.sta; keep.slot = player.slot; keep.cd = player.cd; keep.inv = Math.min(player.inv, 3);
    keep.bonus = player.bonus ? { id: player.bonus.id, n: player.bonus.n, on: !!player.bonus.on } : null;
    keep.foes = foes.filter(f => f.rag.alive && !f.dummy && f.plat && !f.plat.falling).map(f => ({
      type: f.type, boss: f.boss ? BOSSES.indexOf(f.boss) : -1, x: f.plat.x, y: f.plat.baseY, w: f.plat.w, moveA: f.plat.moveA, moveS: f.plat.moveS,
      hp: f.hp, maxHp: f.maxHp, burnT: f.burnT, bleed: f.bleed, bleedDps: f.bleedDps, minion: f.minion, gold: !!f.gold, goldT: f.goldT, goldMax: f.goldMax,
      helmet: !!f.rag.helmet, shield: f.rag.shield, enraged: !!f.enraged, t: f.t, minionT: f.minionT,
    }));
    keep.cr = crates.filter(c => !c.popped).map(c => ({ x: c.x, y: c.y, ph: c.ph, t: c.t, kind: c.kind, col: c.col }));
    keep.shots = shots.filter(q => !q.dead && (ITEM[q.def.id] || AMMO[q.def.id])).map(q => ({ id: q.def.id, owner: q.owner, x: q.x, y: q.y, vx: q.vx, vy: q.vy, dmg: q.dmg, age: q.age, bounces: q.bounces, art: q.art }));
    keep.holes = zones.filter(z => z.kind === 'hole').map(z => ({ x: z.x, y: z.y, t: z.t, dur: z.dur, dmg: z.dmg, kb: z.kb, own: !!(z.s && z.s.owner === 'p') }));
    Save.setRun(plain(keep));
  }
  // the other half: put it all back where it was
  function restoreRun(sv) {
    run.resumed = true;
    for (const k of ['stage', 'kos', 'coins', 'bestCombo', 'stood', 'bountyN', 'closeCalls', 'fevers', 'heads', 'rings', 'bosses', 'crates', 'stageKills', 'combo', 'fever', 'stand', 'bountyT', 'bountyLast',
      'goldT', 'crateT', 'spawnT', 'bossT', 'perkT', 't', 'lastKoAt', 'spawned']) if (sv[k] != null) run[k] = sv[k];
    run.beatBest = sv.beatBest != null ? sv.beatBest : run.kos > Save.data.best.kos;
    run.perks = Object.assign({}, sv.perks); run.mastered = sv.mastered || []; run.bounty = sv.bounty || null;
    const sb = Array.isArray(sv.bag) && sv.bag.length === 3 ? sv.bag.map(id => (id && ITEM[id] && Save.owns(id) ? id : null)) : null;
    run.bag = sb && sb.some(Boolean) ? sb : Save.data.bag.slice();
    run.ups = sv.ups && typeof sv.ups === 'object' ? Object.assign({}, sv.ups) : Object.assign({}, Save.data.upgrades);
    themeFrom = themeTo = (run.stage - 1) % THEMES.length; themeT = 1;
    refreshStats(true);
    player.hp = clamp(sv.hp || player.maxHp, 1, player.maxHp);
    if (sv.sta != null) player.sta = clamp(sv.sta, 0, player.maxSta);
    if (sv.slot != null && run.bag[sv.slot]) player.slot = sv.slot; else selectFirstSlot();
    player.cd = sv.cd || 0; player.inv = sv.inv || 0;
    if (sv.bonus && ITEM[sv.bonus.id] && sv.bonus.n > 0) player.bonus = { id: sv.bonus.id, n: sv.bonus.n, on: !!sv.bonus.on };
    if (run.stand > 0) player.inv = Math.max(player.inv, 99);
    if (run.fever > 0) Sfx.setHype(true);
    for (const o of sv.foes || []) {
      const b = o.boss >= 0 ? BOSSES[o.boss] : null;
      if (!FOES[o.type] || (o.boss >= 0 && !b)) continue;
      const f = spawnFoe(o.type, b, { x: o.x, y: o.y, w: o.w });
      f.hp = o.hp; f.maxHp = o.maxHp; f.burnT = o.burnT || 0; f.bleed = o.bleed || 0; f.bleedDps = o.bleedDps || 0; f.minion = !!o.minion; f.enraged = !!o.enraged;
      f.plat.moveA = o.moveA || 0; f.plat.moveS = o.moveS || 0.6;
      f.rag.helmet = !!o.helmet; f.rag.shield = o.shield || 0;
      if (o.t != null) f.t = Math.max(0.6, o.t); if (o.minionT != null) f.minionT = o.minionT;
      if (o.gold) { f.gold = true; f.passive = true; f.goldT = o.goldT; f.goldMax = o.goldMax || 9; f.coins = 0; f.rag.body = '#ffd24a'; f.rag.shade = '#e0a81e'; f.rag.accent = '#b97a1f'; f.rag.helmet = false; f.rag.hold = null; }
      if (b) { f.name = b.name; run.boss = f; run.bossT = -1; }
    }
    for (const c of sv.cr || []) crates.push({ x: c.x, y: c.y, ph: c.ph, popped: false, t: c.t, kind: c.kind || 'mystery', col: c.col });
    for (const q of sv.shots || []) {
      const def = q.owner === 'p' ? ITEM[q.id] : AMMO[q.id];
      if (!def) continue;
      const sh = launch(def, { owner: q.owner, x: q.x, y: q.y, vx: q.vx, vy: q.vy, dmg: q.dmg, life: 6 });
      sh.age = q.age || 0; sh.bounces = q.bounces != null ? q.bounces : sh.bounces; if (q.art) sh.art = q.art;
    }
    for (const h of sv.holes || []) zones.push({ kind: 'hole', x: h.x, y: h.y, t: h.t, dur: h.dur, seq: 0, dmg: h.dmg, kb: h.kb, s: h.own ? { owner: 'p', def: ITEM.hole, mast: 'hole', art: 'hole', vx: 0, vy: 0, x: h.x, y: h.y } : null });
    Sfx.setStage(run.stage);
    if (on.banner) on.banner('STAGE ' + run.stage, 'WELCOME BACK');
    // a perk offer that was still on screen comes straight back
    if (sv.perkPick && sv.perkPick.length) {
      run.perkPick = sv.perkPick; run.perkT = -1; hold = true; aimCancel();
      setTimeout(() => { if (run && run.perkPick && on.perk) on.perk(run.perkPick, run.stage); }, 80);
    }
  }

  /* -------------------------------------------------------------- tutorial
     The first launch only. Four beats on the real field with the real rules:
     land a throw, knock the foe out, duck a throw, knock out one that fights
     back. Then the run carries straight on into stage 1. */
  function startTut() {
    run.tut = { step: 0, hits: 0, ducked: false, wait: 0, foe: null };
    tutFoe(true);
    if (on.tut) on.tut(0);
  }
  function tutFoe(passive) {
    const f = spawnFoe('chucker', null, { x: 1010, y: 540 });
    f.passive = passive; f.tut = true; f.hp = f.maxHp = passive ? 56 : 42; f.t = 1.4;
    run.tut.foe = f;
  }
  function tutStep(n) { run.tut.step = n; if (on.tut) on.tut(n); Sfx.style(); }
  function stepTut(dt) {
    const T = run.tut, f = T.foe;
    if (T.wait > 0) { if ((T.wait -= dt) <= 0) { tutFoe(false); T.ducked = false; } return; }
    const gone = !f || !f.rag.alive;
    if (T.step === 0 && (T.hits > 0 || gone)) tutStep(1);
    if (T.step === 1 && gone) { tutStep(2); T.wait = 0.7; return; }
    if (T.step === 2 && gone) { endTut(); return; }
    if (T.step === 2 && T.ducked) tutStep(3);
    if (T.step === 3 && gone) endTut();
  }
  function endTut() {
    if (!run.tut) return;
    const f = run.tut.foe;
    if (f && f.rag.alive) { f.passive = false; f.tut = false; }   // skipped: whoever is left just becomes the first foe
    run.tut = null;
    Save.data.tutDone = true; Save.save();
    run.kos = 0; run.stageKills = 0; run.combo = 0; run.bestCombo = 0; run.heads = 0; run.rings = 0; run.spawnT = 0.8; run.t = 0;
    player.hp = player.maxHp; player.sta = player.maxSta;
    if (on.tut) on.tut(-1);
    if (on.banner) on.banner('STAGE 1', THEMES[0].name.toUpperCase());
    Sfx.stage();
  }

  /* ------------------------------------------------------------- throw log
     One entry per throw. When everything that throw put in the air is gone
     and none of it hit a foe, the streak breaks. */
  function logNew(n) { const seq = ++run.seq; throwLog.set(seq, { live: n, hit: false }); return seq; }
  function logAdd(seq, n) { const l = throwLog.get(seq); if (l) l.live += n; }
  function logHit(seq) {
    const l = throwLog.get(seq);
    if (!l || l.hit || run.demo) return;
    l.hit = true; run.combo++;
    if (run.combo > run.bestCombo) run.bestCombo = run.combo;
    if (run.combo > 1) Sfx.combo(run.combo);
    if (run.combo === 5) track('combo5');
    bump('streak', run.combo);
    if (run.stand > 0) standWin();
    if (run.combo % FEVER_EVERY === 0 && !run.tut) startFever();
  }
  /* ---- frenzy: every tenth hit in a row lights you up. Throws are free and fast, coins are doubled, and you get 50 stamina back. */
  function startFever() {
    run.fever = FEVER_T; run.fevers++;
    const h = player.rag.head;
    Sfx.fever(); Sfx.setHype(true); shake = Math.max(shake, 0.4);
    Fx.ring(h.x, h.y + 40, 20, 260, 0.5, '#ffb347', 8);
    Fx.text(h.x, h.y - 84, 'FRENZY!', '#ffb347', 34, -46);
    Fx.burst(h.x, h.y + 40, 22, { colors: ['#ffb347', '#ff7a3c', '#ffe08a'], speed: [160, 520], life: [0.4, 0.9], size: [3, 7], grav: 300, glow: true });
    player.sta = Math.min(player.maxSta, player.sta + 50);
  }
  /* ---- last stand: once a run, the blow that would finish you leaves you on your feet for a few
     seconds. Land a throw in that window and you are back in it. */
  function standWin() {
    run.stand = 0; player.inv = 1.4;
    player.hp = Math.max(player.hp, player.maxHp * 0.35); healFlash = 1;
    const h = player.rag.head;
    Sfx.revive(); shake = Math.max(shake, 0.5); slowT = 0;
    Fx.ring(h.x, h.y + 40, 20, 320, 0.6, '#45e08a', 9);
    Fx.text(h.x, h.y - 84, 'STILL STANDING!', '#7dffb0', 30, -46);
    Fx.confetti(h.x, h.y, 26);
  }
  /* ---- bounties: one small job at a time, paid on the spot, each worth a little more than the last */
  const BOUNTIES = [
    { k: 'ko', n: [3, 5], text: 'KNOCK OUT {n}', pay: 14 },
    { k: 'head', n: [2, 4], text: 'LAND {n} HEADSHOTS', pay: 18 },
    { k: 'ring', n: [1, 2], text: '{n} RING-OUT{s}', pay: 22 },
    { k: 'streak', n: [4, 7], text: 'REACH A x{n} STREAK', pay: 20, abs: true },
    { k: 'close', n: [1, 2], text: '{n} CLOSE CALL{s}', pay: 20 },
    { k: 'clean', n: [3, 4], text: '{n} KOs WITHOUT A SCRATCH', pay: 24 },
    { k: 'style', n: [2, 4], text: '{n} STYLE BONUSES', pay: 18 },
    { k: 'item', n: [2, 3], text: '{n} KOs WITH THE {item}', pay: 20 },
  ];
  function newBounty() {
    const pool = BOUNTIES.filter(b => b.k !== run.bountyLast && !(b.k === 'streak' && run.combo >= 3));
    const b = pick(pool), n = randi(b.n[0], b.n[1]);
    const item = b.k === 'item' ? pick(bag().filter(Boolean)) : null;
    const pay = Math.round(b.pay * (0.7 + 0.3 * n) * (1 + 0.15 * Math.min(run.bountyN, 12)) * (1 + 0.08 * (run.stage - 1)));
    run.bounty = { k: b.k, n, prog: 0, pay, item, abs: !!b.abs, done: false, text: b.text.replace('{n}', n).replace('{s}', n > 1 ? 'S' : '').replace('{item}', item ? ITEM[item].name.toUpperCase() : '') };
    run.bountyLast = b.k;
  }
  function bump(k, n = 1, item) {
    const b = run && run.bounty;
    if (!b || b.done || b.k !== k || (k === 'item' && item !== b.item)) return;
    b.prog = b.abs ? Math.max(b.prog, n) : b.prog + n;
    if (b.prog < b.n) return;
    b.prog = b.n; b.done = true; run.bountyN++; run.bountyT = 2.4;
    const pay = Math.round(b.pay * coinMul()), h = player.rag.head;
    gain(pay); flyCoins(h.x, h.y - 30, 8);
    Fx.text(h.x, h.y - 70, 'BOUNTY  +' + pay, '#ffc933', 24, -50);
    Sfx.bounty();
  }
  // coins that pop out of a knockout and fly to the counter
  function flyCoins(wx, wy, n) {
    if (run.demo) return;
    const p = toScreen(wx, wy);
    for (let i = 0; i < Math.min(n, 16); i++) {
      const a = rand(0, TAU), d = rand(40, 110);
      coinFx.push({ x0: p.x, y0: p.y, x1: p.x + Math.cos(a) * d, y1: p.y + Math.sin(a) * d * 0.7 - 50, t: -i * 0.035, dur: rand(0.55, 0.8) });
    }
  }
  function closeCall(s) {
    const h = player.rag.head;
    run.closeCalls++;
    player.sta = Math.min(player.maxSta, player.sta + 12);
    Fx.text(h.x, h.y - 60, 'CLOSE CALL', '#9fe8ff', 19, -80);
    Fx.ring(h.x, h.y, 10, 60, 0.25, '#9fe8ff', 3);
    Sfx.style(); gain(Math.round(3 * coinMul()));
    bump('close');
  }
  function logDone(seq) {
    const l = throwLog.get(seq);
    if (!l || --l.live > 0) return;
    throwLog.delete(seq);
    if (!l.hit && !run.demo) {
      if (run.combo >= 3) Fx.text(player.rag.head.x, player.rag.head.y - 50, 'STREAK LOST', '#ff8a94', 18);
      run.combo = 0;
    }
  }
  function track(stat, n = 1) {
    if (run.demo) return;
    const done = Save.track(stat, n);
    if (done && on.toast) on.toast('MISSION DONE: ' + done.text.toUpperCase(), 'scroll');
  }
  function gain(n) {
    if (run.demo || n <= 0) return;
    run.coins += n; Save.data.coins += n; track('earned', n);
  }

  /* ---------------------------------------------------------------- input */
  function aimStart(x, y, id) {
    if (state !== 'play' || paused || hold || player.dead || aim.on) return;
    aim.vis = 0; aim.moved = time;
    aim.on = true; aim.id = id; aim.sx = aim.cx = x; aim.sy = aim.cy = y; aim.power = 0; aim.t = 0; aim.maxed = false; aim.snap = null; aim.ux = null;
    aim.max = clamp(Math.min(cw, ch) * 0.3, 110, 230);
    aim.afford = player.sta >= throwCost();      // only a throw you could pay for when you started holding will fire itself
  }
  const throwCost = () => (usingBonus() || run.fever > 0 ? 0 : staCost(ITEM[currentItemId()] || ITEM.rock));
  function aimMove(x, y, id) {
    if (!aim.on || aim.id !== id) return;
    aim.cx = x; aim.cy = y;
    const dx = aim.sx - x, dy = aim.sy - y, len = Math.hypot(dx, dy);
    const p = clamp((len - PULL_DEAD) / (aim.max - PULL_DEAD), 0, 1);
    if (Math.abs(p - aim.power) > 0.04 && p > 0) Sfx.stretch(p);
    const na = len > 4 ? Math.atan2(dy, dx) : aim.ang;
    // the guide only means something once the pull has stopped changing: note every time it is still moving
    if (Math.abs(p - aim.power) > 0.012 || Math.abs(angDiff(na, aim.ang)) > 0.02) aim.moved = time;
    aim.power = p;
    aim.ang = na;
  }
  function aimEnd(id) {
    if (!aim.on || aim.id !== id) return;
    aim.on = false;
    if (aim.power > 0 && !player.dead && state === 'play' && aim.ux != null) aim.snap = { sx: aim.sx, sy: aim.sy, kx: aim.kx, ky: aim.ky, ux: aim.ux, uy: aim.uy, p: aim.power, col: aim.col || '#ffffff', t: 0 };
    if (aim.power <= 0 || player.dead || state !== 'play') return;
    pending = { ang: aim.ang, power: aim.power, t: 0.22 };
  }
  function aimCancel() { aim.on = false; aim.power = 0; pending = null; }
  function setDuck(v) { duckHeld = v; }
  function selectSlot(i) {
    if (state !== 'play') return;
    if (i === 3) { if (player.bonus && !player.bonus.on) { player.bonus.on = true; Sfx.equip(); } return; }
    if (!bag()[i]) return;
    if (player.slot !== i || usingBonus()) { player.slot = i; if (player.bonus) player.bonus.on = false; Sfx.equip(); }
  }
  function cycleSlot(d) {
    const b = bag();
    for (let k = 1; k <= 3; k++) { const i = (player.slot + d * k + 9) % 3; if (b[i]) { selectSlot(i); return; } }
  }

  // where a throw leaves the hand, and how fast
  function release(rag, ang) {
    const n = rag.T[P.NECK];
    return { x: n.x + Math.cos(ang) * 44 * rag.s, y: n.y + Math.sin(ang) * 44 * rag.s };
  }
  const throwSpeed = (def, power) => lerp(THROW_MIN, THROW_MAX, power) * def.spd;

  function tryThrow(ang, power, auto) {
    const id = currentItemId(), def = ITEM[id];
    if (player.rag.mode !== 'active') return false;       // knocked flat: no throwing until you are back on your feet
    const free = usingBonus(), hot = run.fever > 0;
    let cost = free || hot ? 0 : staCost(def);
    if (auto) cost = Math.min(cost, player.sta);       // an automatic release spends whatever is left
    if (player.sta < cost) { Sfx.empty(); staFlash = 0.5; return false; }
    player.sta -= cost; player.staWait = 0.25; player.cd = throwCd() * (hot ? 0.6 : 1);
    if (free && --player.bonus.n <= 0) player.bonus = null;
    const rag = player.rag;
    rag.aim = ang; rag.throwT = 0;
    let real = def, mul = dmgMul();
    if (id === 'sack') { real = pick(ITEMS.filter(i => i.id !== 'sack')); mul *= 1.3; Fx.text(rag.head.x, rag.head.y - 46, real.name.toUpperCase() + '!', '#ffd9a0', 18); }
    const twin = Math.random() < 0.25 * pk('twin');
    const n = real.multi || 1;
    const seq = logNew(n * (twin ? 2 : 1));
    player.rel = RELEASE_AT;
    const volley = (a, delay) => {
      for (let i = 0; i < n; i++) {
        const aa = a + (i - (n - 1) / 2) * 0.11;
        const v = throwSpeed(real, power), planned = release(rag, aa);
        zones.push({ kind: 'delay', t: delay, fn: () => {
          if (player.dead) { logDone(seq); return; }
          // the body leans into the throw, so the hand is not where the preview started: leave from the
          // hand, but bend the velocity so the arc still passes through the previewed path
          const q = release(rag, aa);
          launch(real, { owner: 'p', x: q.x, y: q.y, vx: Math.cos(aa) * v + (planned.x - q.x) / ARC_T, vy: Math.sin(aa) * v + (planned.y - q.y) / ARC_T, dmg: real.dmg * mul * (1 + 0.05 * Save.masteryLvl(id)), seq, power, mast: id });
          if (i === 0) releaseFx(rag, aa, power, real);
        } });
      }
    };
    volley(ang, RELEASE_AT);
    if (twin) volley(ang - 0.06, RELEASE_AT + 0.11);
    Sfx.throw(!!real.heavy);
    track('throws'); run.throws = (run.throws || 0) + 1;
    return true;
  }

  // what a release looks like: speed lines off the hand, a snap ring, dust under the planted foot, a small kick
  function releaseFx(rag, ang, power, def) {
    const h = rag.hand, f = rag.pts[P.FFOOT];
    Fx.burst(h.x, h.y, 4 + Math.round(power * 8), { color: '#ffffff', speed: [380 + 500 * power, 900 + 700 * power], life: [0.1, 0.22], size: [1.6, 2.6], grav: 0, drag: 5, shape: 'spark', ang, spread: 0.2 });
    Fx.ring(h.x, h.y, 5, 24 + 26 * power, 0.2, '#ffffff', 4);
    Fx.dust(f.x, f.y + 4, 3 + Math.round(power * 4), '#f3ecd8');
    if (def.heavy) Fx.dust(rag.pts[P.BFOOT].x, rag.pts[P.BFOOT].y + 4, 4);
    shake = Math.max(shake, 0.06 + 0.12 * power + (def.heavy ? 0.1 : 0));
    try { if (navigator.vibrate) navigator.vibrate(6 + Math.round(10 * power)); } catch (e) { /* not everywhere */ }
  }

  /* ---------------------------------------------------------------- shots */
  function launch(def, o) {
    const big = o.owner === 'p' ? 1 + 0.3 * pk('big') : 1;
    const s = {
      def, art: o.art || def.id, owner: o.owner, x: o.x, y: o.y, vx: o.vx, vy: o.vy,
      rot: rand(0, TAU), vr: (def.spin || 0) * (o.vx < 0 ? -1 : 1), r: def.r * big * (o.scale || 1),
      dmg: o.dmg != null ? o.dmg : def.dmg, kb: def.kb != null ? def.kb : 0.5, grav: def.grav != null ? def.grav : 1,
      mast: o.mast || def.id, age: 0, life: o.life || def.life || 7, bounces: (def.bounce || 0) + (o.owner === 'p' ? pk('spring') : 0), hits: new Set(), rehit: 0,
      seq: o.seq || 0, from: o.from || null, tricks: 0, st: 0, hp: def.hp || 1, target: o.target || null, dead: false,
      turnAt: 0.5 + 0.4 * (o.power || 0.5), trail: 0, sx: o.x,
    };
    if (def.id === 'firework') { s.grav = 0; s.rot = Math.atan2(s.vy, s.vx); }
    shots.push(s);
    return s;
  }
  function kill(s) { if (s.dead) return; s.dead = true; if (s.owner === 'p') logDone(s.seq); }
  function breakShot(s, quiet) {
    if (!quiet) { Fx.dust(s.x, s.y, 4, '#ffffff'); Fx.chunk(s.art, s.x, s.y, -s.vx * 0.18 + rand(-60, 60), -rand(160, 300), s.r * 0.9, 0.7); }
    kill(s);
  }

  /* Steering a throw towards the nearest foe: how far it can see, how fast it can turn, and how long after the throw (or
     after a bounce) it keeps doing it. The magnet and the Auto Aimer perk share it, the perk with a weaker pull. */
  function homeShot(s, dt, range, turn, window, gcomp) {
    const since = s.age - (s.homeAt || 0);
    if (since < 0.12 || since > window) return;
    let best = null, bd = range;
    const others = foes.some(f => live(f) && f !== s.lastFoe);
    for (const f of foes) {
      if (!live(f) || (others && f === s.lastFoe)) continue;
      const c = f.rag.chest, d = dist(s.x, s.y, c.x, c.y);
      if (d < bd && (s.homeAt || c.x > s.x - 60)) { bd = d; best = c; }
    }
    if (!best) return;
    const sp = Math.hypot(s.vx, s.vy), cur = Math.atan2(s.vy, s.vx), want = Math.atan2(best.y - 20 - s.y, best.x - s.x);
    const a = turnTo(cur, want, turn * dt);
    s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp - G * s.grav * dt * gcomp;
  }
  const NO_AUTOAIM = new Set(['magnet', 'boomerang', 'firework', 'anvil', 'bee']);
  /* per-item behaviour while in the air */
  const TICK = {
    boomerang(s, dt) {
      if (s.st === 0 && s.age > s.turnAt) { s.st = 1; s.hits.clear(); s.grav = 0; }
      if (s.st === 1) {
        const c = player.rag.chest, dx = c.x - s.x, dy = c.y - 30 - s.y, d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, 5 * dt);
        s.vx = lerp(s.vx, dx / d * 950, k); s.vy = lerp(s.vy, dy / d * 950, k);
        if (d < 46 && !player.dead) {
          player.sta = Math.min(player.maxSta, player.sta + staCost(ITEM.boomerang));
          Fx.text(c.x, c.y - 80, 'CATCH', '#9fe0ff', 18); Sfx.catch(); kill(s);
        }
      }
      Sfx.whirl();
    },
    firework(s, dt) {
      const a = Math.atan2(s.vy, s.vx);
      s.vx += Math.cos(a) * 1700 * dt; s.vy += Math.sin(a) * 1700 * dt; s.rot = a;
      Fx.burst(s.x - Math.cos(a) * s.r, s.y - Math.sin(a) * s.r, 1, { colors: ['#fff3c0', '#ffb347', '#ff5d73'], speed: [20, 90], life: [0.2, 0.45], size: [2, 4], grav: 120, drag: 2, glow: true });
      Sfx.fizz();
      if (s.age > 1.3) detonate(s);
    },
    dynamite(s) {
      if (Math.random() < 0.3) Fx.burst(s.x, s.y - s.r, 1, { color: '#ffd27a', speed: [20, 80], life: [0.15, 0.3], size: [1.5, 3], grav: 300 });
      if (s.age > 2.6) detonate(s);
    },
    // with the Auto Aimer card the magnet pulls harder: longer reach, a sharper turn and a longer hold
    magnet(s, dt) { if (run.perks.aim) homeShot(s, dt, 560, 3.6, 2.0, 0.65); else homeShot(s, dt, 430, 2.5, 1.5, 0.6); },
    anvil(s) {
      if (s.st === 0 && s.age > 0.18) {
        for (const f of foes) {
          if (!live(f)) continue;
          const h = f.rag.head;
          if (Math.abs(s.x - h.x) < 15 * f.rag.s + 6 && s.y < h.y - 46) {
            s.st = 1; s.vx = 0; s.vy = Math.max(s.vy, 260); s.grav = 3.2; s.vr = 0; s.rot = 0; s.x = h.x;
            Fx.ring(s.x, s.y, 6, 34, 0.25, '#ffffff', 3); Sfx.warn();
            break;
          }
        }
      } else if (s.st === 0) s.rot = 0;
    },
    pinata(s) { if (s.age > 0.22 && s.vy >= 0) burstPinata(s); },
    hole(s) { if (s.age > 0.9 && s.vy > 0) openHole(s); },
    bee(s, dt) {
      if (!s.target || !s.target.rag.alive) {
        s.target = null; let bd = 1e9;
        for (const f of foes) { if (!f.rag.alive) continue; const c = f.rag.chest, d = dist(s.x, s.y, c.x, c.y); if (d < bd) { bd = d; s.target = f; } }
      }
      if (s.target) {
        const c = s.target.rag.chest, dx = c.x - s.x, dy = c.y - 20 - s.y, d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, 5 * dt), wob = Math.sin(s.age * 17 + s.sx) * 130;
        s.vx = lerp(s.vx, dx / d * 430 - dy / d * wob, k); s.vy = lerp(s.vy, dy / d * 430 + dx / d * wob, k);
      } else { s.vy -= 200 * dt; }
      s.rot = Math.atan2(s.vy, s.vx); s.vr = 0;
      Sfx.buzz();
    },
    e_bomb(s) { if (Math.random() < 0.25) Fx.burst(s.x, s.y - s.r, 1, { color: '#ffb070', speed: [20, 70], life: [0.15, 0.3], size: [1.5, 3], grav: 300 }); },
  };

  function detonate(s) {
    if (s.dead) return;
    if (s.owner === 'p') {
      const r = s.def.blast * (s.r / s.def.r);
      blast(s.x, s.y, r, s.dmg, s.kb, s, s.def.id === 'firework');
      selfBlast(s.x, s.y, r, s.dmg);      // your own explosives hurt you too, if you are close enough
    }
    else blastPlayer(s.x, s.y, s.def.blast, s.dmg);
    kill(s);
  }
  /* ---- things that go off where they land: a bell, a melon, a bucket of paint, a cushion, a disco ball ---- */
  const nearFoes = (x, y, r) => foes.filter(f => live(f) && dist(x, y, f.rag.chest.x, f.rag.chest.y) < r + 30 * f.rag.s);
  const AREA = {
    bell(s) {
      Sfx.dong(); shake = Math.max(shake, 0.4);
      for (const r of [40, 90, 150]) Fx.ring(s.x, s.y, r * 0.25, r + 70, 0.5, '#ffe27a', 5);
      for (const f of nearFoes(s.x, s.y, 190)) {
        f.rag.stun = Math.max(f.rag.stun, f.boss ? 0.8 : 1.8); f.state = 'idle'; f.t = Math.max(f.t, f.boss ? 1.1 : 2);
        Fx.text(f.rag.head.x, f.rag.head.y - 44, 'DONG', '#ffe27a', 18);
        const c = f.rag.chest, d = dist(s.x, s.y, c.x, c.y) || 1;
        if (!f.dummy) hurtFoe(f, s.dmg * 0.7, { x: c.x, y: c.y - 10, dirx: (c.x - s.x) / d, diry: -0.2, s, kb: 0.4 });
      }
      kill(s);
    },
    melon(s) {
      Sfx.pop(); Fx.burst(s.x, s.y, 20, { colors: ['#ff3f5e', '#ff7889', '#3fb55a', '#f4f7e6'], speed: [100, 420], life: [0.4, 0.9], size: [3, 7], grav: 800 });
      const n = 5; logAdd(s.seq, n);
      for (let i = 0; i < n; i++) launch(AMMO.seed, { owner: 'p', x: s.x, y: s.y - 4, vx: -150 + i * 75 + rand(-40, 40), vy: -rand(240, 440), dmg: s.dmg * 0.4, seq: s.seq, life: 3 });
      kill(s);
    },
    paint(s) {
      Sfx.splat && Sfx.splat(); Sfx.pop();
      Fx.burst(s.x, s.y, 26, { colors: ['#ff4fa8', '#ff86c6', '#ffb3dc'], speed: [120, 460], life: [0.4, 0.9], size: [3, 8], grav: 700 });
      Fx.ring(s.x, s.y, 20, 230, 0.4, '#ff4fa8', 6);
      for (const f of nearFoes(s.x, s.y, 240)) { f.marked = 6; Fx.text(f.rag.head.x, f.rag.head.y - 44, 'MARKED', '#ff86c6', 17); }
      kill(s);
    },
    cushion(s) {
      Sfx.parp();
      Fx.dust(s.x, s.y, 14, '#d9e8b0'); Fx.ring(s.x, s.y, 20, 210, 0.4, '#e8f3c4', 6); shake = Math.max(shake, 0.3);
      for (const f of nearFoes(s.x, s.y, 190)) {
        const c = f.rag.chest, d = dist(s.x, s.y, c.x, c.y) || 1, fall = 1 - 0.5 * clamp(d / 220, 0, 1);
        hurtFoe(f, s.dmg, { x: c.x, y: c.y - 10, dirx: (c.x - s.x) / d, diry: -0.4, s, kb: s.kb * fall });
      }
      kill(s);
    },
    disco(s) {
      Sfx.tick(); Sfx.gold();
      Fx.ring(s.x, s.y, 20, 360, 0.6, '#ffffff', 6); Fx.confetti(s.x, s.y, 20);
      for (const f of foes) { if (!live(f) || f.dummy) continue; f.blind = 5; Fx.text(f.rag.head.x, f.rag.head.y - 44, 'DAZZLED', '#cfe0ff', 17); Fx.ring(f.rag.head.x, f.rag.head.y, 6, 46, 0.4, '#ffffff', 3); }
      kill(s);
    },
  };
  // an alarm clock stuck on something goes off two seconds later
  function armClock(x, y, rag) {
    Sfx.stick();
    zones.push({ kind: 'delay', t: 1.0, fn: () => Sfx.warn() }); zones.push({ kind: 'delay', t: 1.5, fn: () => Sfx.warn() });
    zones.push({ kind: 'delay', t: 2.0, fn: () => {
      const c = rag && rag.alive ? rag.chest : { x, y };
      Sfx.alarm(); shake = Math.max(shake, 0.5);
      for (const r of [50, 110, 180]) Fx.ring(c.x, c.y, r * 0.2, r + 60, 0.5, '#ff6a63', 6);
      for (const f of nearFoes(c.x, c.y, 215)) {
        f.rag.stun = Math.max(f.rag.stun, f.boss ? 0.9 : 2); f.state = 'idle'; f.t = Math.max(f.t, f.boss ? 1.2 : 2.2);
        Fx.text(f.rag.head.x, f.rag.head.y - 44, 'RING!', '#ff9aa0', 18);
        const fc = f.rag.chest, d = dist(c.x, c.y, fc.x, fc.y) || 1;
        hurtFoe(f, 22 * dmgMul(), { x: fc.x, y: fc.y - 10, dirx: (fc.x - c.x) / d, diry: -0.3, kb: 0.6 });
      }
    } });
  }
  function burstPinata(s) {
    if (s.dead) return;
    Fx.confetti(s.x, s.y, 28); Sfx.pop();
    const n = 8; logAdd(s.seq, n);      // eight sweets at 65% each: a good haul, not a one-item win
    for (let i = 0; i < n; i++) launch(AMMO.candy, { owner: 'p', x: s.x, y: s.y, vx: s.vx * 0.55 + rand(-300, 300), vy: rand(-260, 180), dmg: s.dmg * 0.65, seq: s.seq, life: 4 });
    kill(s);
  }
  function burstHive(s) {
    if (s.dead) return;
    Fx.burst(s.x, s.y, 12, { colors: ['#f5c53a', '#e3a520', '#7a5a2a'], speed: [80, 300], life: [0.3, 0.7], size: [3, 6] }); Sfx.pop();
    const alive = foes.filter(f => f.rag.alive);
    const n = 6; logAdd(s.seq, n);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      launch(AMMO.bee, { owner: 'p', x: s.x, y: s.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260 - 120, dmg: AMMO.bee.dmg * dmgMul(), seq: s.seq, life: 5, target: alive.length ? alive[i % alive.length] : null });
    }
    kill(s);
  }
  function zap(s) {
    if (s.dead) return;
    Sfx.glass(); Sfx.zap();
    Fx.burst(s.x, s.y, 10, { color: '#dff1ff', speed: [100, 340], life: [0.2, 0.5], size: [2, 4], shape: 'rect' });
    Fx.ring(s.x, s.y, 10, 90, 0.3, '#fff9a8', 5);
    const list = foes.filter(f => live(f) && dist(s.x, s.y, f.rag.chest.x, f.rag.chest.y) < 440).sort((a, b) => dist(s.x, s.y, a.rag.chest.x, a.rag.chest.y) - dist(s.x, s.y, b.rag.chest.x, b.rag.chest.y));
    let px = s.x, py = s.y;
    for (const f of list) {
      const c = f.rag.chest;
      Fx.bolt(px, py, c.x, c.y); Fx.bolt(px, py, c.x, c.y, '#9fd0ff', 0.3);
      f.rag.stun = f.boss ? 0.7 : 1.4;
      hurtFoe(f, s.dmg, { x: c.x, y: c.y - 20, dirx: 0, diry: -1, s, kb: 0.3 });
      px = c.x; py = c.y;
    }
    kill(s);
  }
  function openHole(s) {
    if (s.dead) return;
    logAdd(s.seq, 1);
    zones.push({ kind: 'hole', x: s.x, y: s.y, t: 0, dur: 2.3, seq: s.seq, dmg: s.dmg, kb: s.kb, s });
    Sfx.vortex(); Fx.ring(s.x, s.y, 120, 10, 0.4, '#b98cff', 5);
    kill(s);
  }

  // circle against a solid island box: returns the push-out normal or null
  function platHit(s, pl) {
    if (pl.falling && pl.kind !== 'wall') return null;
    const nx = clamp(s.x, pl.left, pl.right), ny = clamp(s.y, pl.top, pl.bottom);
    let dx = s.x - nx, dy = s.y - ny, d = Math.hypot(dx, dy);
    if (d >= s.r) return null;
    if (d < 0.001) { dx = 0; dy = -1; d = 1; s.y = pl.top - s.r; return { nx: 0, ny: -1, pen: 0 }; }
    return { nx: dx / d, ny: dy / d, pen: s.r - d };
  }
  function bounceOff(s, n, rest) {
    s.x += n.nx * n.pen; s.y += n.ny * n.pen;
    const vn = s.vx * n.nx + s.vy * n.ny;
    if (vn < 0) { s.vx -= (1 + rest) * vn * n.nx; s.vy -= (1 + rest) * vn * n.ny; }
  }

  function stepShot(s, dt) {
    s.age += dt;
    if (s.rehit > 0) { s.rehit -= dt; if (s.rehit <= 0) s.hits.clear(); }
    const id = s.def.id;
    if (TICK[id]) TICK[id](s, dt);
    if (s.owner === 'p' && !NO_AUTOAIM.has(id) && ITEM[id] && run.perks.aim) homeShot(s, dt, 400, 2.1, 1.4, 0.55);      // the Auto Aimer perk
    if (s.dead) return;
    // constant gravity integrated exactly: the path is the true parabola, whatever the step size
    const gy = G * s.grav;
    s.x += s.vx * dt; s.y += s.vy * dt + 0.5 * gy * dt * dt; s.vy += gy * dt;
    if (s.vr) s.rot += s.vr * dt; else if (id !== 'anvil' && id !== 'bee') s.rot = Math.atan2(s.vy, s.vx);
    if (s.owner === 'p' && run.fever > 0 && Math.random() < 0.5) Fx.burst(s.x, s.y, 1, { colors: ['#ffb347', '#ff7a3c', '#ffe08a'], speed: [10, 70], life: [0.2, 0.45], size: [3, 6], grav: -80, glow: true });
    // a faint trail on your own throws so fast ones stay readable
    if (s.owner === 'p' && (s.trail -= dt) <= 0 && id !== 'bee' && id !== 'candy' && id !== 'seed' && shots.length < 12) { s.trail = 0.02; Fx.burst(s.x, s.y, 1, { color: '#ffffff', speed: [0, 8], life: [0.16, 0.26], size: [s.r * 0.22, s.r * 0.34], grav: 0, drag: 0 }); }
    if (s.age > s.life || s.y > WORLD_H + 260 || s.x < -400 || s.x > WORLD_W + 600 || s.y < -2600) { kill(s); return; }

    if (s.owner === 'p') {
      // mystery crates
      for (const c of crates) {
        if (c.popped) continue;
        if (dist(s.x, s.y, c.x, c.y) < s.r + 24 || dist(s.x, s.y, c.x, c.y - 64) < s.r + 22) {
          popCrate(c, s);
          if (s.def.blast) { detonate(s); return; }
          if (!s.def.pierce) { hitResolve(s, null, null); if (s.dead) return; }
        }
      }
      // enemy throws: knock them out of the air
      for (const e of shots) {
        if (e.owner !== 'e' || e.dead || s.hits.has(e)) continue;
        if (dist(s.x, s.y, e.x, e.y) < s.r + e.r + 7) {
          s.hits.add(e);
          deflect(e, s);
          if (s.def.blast) { detonate(s); return; }
          if (!s.def.pierce && !s.def.heavy && s.bounces <= 0) { breakShot(s); return; }
        }
      }
      for (const f of foes) {
        const rag = f.rag;
        if (!live(f) || s.hits.has(f)) continue;
        // balloons first: they hang well above the body
        if (f.plat && f.plat.balloons) for (const b of f.plat.balloons) {
          if (!b.alive) continue;
          const bx = f.plat.x + b.ox, by = f.plat.y + b.oy;
          if (dist(s.x, s.y, bx, by) < s.r + b.r) popBalloon(f, b, s);
        }
        const c = rag.chest;
        if (Math.abs(s.x - c.x) > 130 * rag.s + s.r || Math.abs(s.y - c.y) > 150 * rag.s + s.r) continue;
        // a lid held out in front
        if (rag.shield > 0 && rag.mode === 'active' && id !== 'bee') {
          const lx = rag.offHand.x - 4 * rag.s, ly = rag.offHand.y;
          if (dist(s.x, s.y, lx, ly) < s.r + 24 * rag.s && s.x < lx + 14) {
            logHit(s.seq);
            if (s.def.blast) { detonate(s); return; }
            if (s.def.heavy || id === 'magnet') { breakLid(f, true); }
            else {
              rag.shield--; rag.impulse(P.BHAND, s.vx * 0.9, s.vy * 0.5, 0.35); rag.stagger(0.2); rag.jolt(Math.sign(s.vx) * 4, 0);
              Sfx.clang(); Fx.hit(s.x, s.y, Math.atan2(s.vy, s.vx), '#dfe5ee', 7);
              if (rag.shield <= 0) breakLid(f, false); else Fx.text(lx, ly - 34, 'BLOCKED', '#c9d0dc', 17);
              if (id === 'hole') { openHole(s); return; }
              if (id === 'jar') { zap(s); return; }
              if (id === 'beehive') { burstHive(s); return; }
              if (AREA[id]) { AREA[id](s); return; }
              Fx.chunk(s.art, s.x, s.y, -Math.abs(s.vx) * 0.35, -rand(200, 380), s.r, 0.9);
              kill(s); return;
            }
          }
        }
        const hit = rag.hitTest(s.x, s.y, s.r);
        if (!hit) continue;
        if (s.def.blast) { detonate(s); return; }
        onFoeHit(s, f, hit);
        if (s.dead) return;
      }
    } else if (!player.dead && state === 'play') {
      const pc = player.rag.chest, ph = player.rag.head;
      s.near = Math.min(s.near == null ? 1e9 : s.near, Math.hypot(s.x - pc.x, s.y - pc.y), Math.hypot(s.x - ph.x, s.y - ph.y));
      if (!s.cc && !s.def.blast && s.vx < 0 && s.x < pc.x - 60 && s.near < s.r + 58) { s.cc = true; closeCall(s); }
      const hit = player.rag.hitTest(s.x, s.y, s.r);
      if (hit) {
        if (s.def.blast) { detonate(s); return; }
        const d = Math.hypot(s.vx, s.vy) || 1;
        hurtPlayer(s.dmg * (hit.part === 'head' ? 1.25 : 1), { x: hit.x, y: hit.y, dirx: s.vx / d, diry: s.vy / d, head: hit.part === 'head', hit, sf: speedF(s) });
        Fx.chunk(s.art, s.x, s.y, -s.vx * 0.2, -rand(180, 320), s.r, 0.8);
        kill(s); return;
      }
    }

    // islands
    if (id === 'boomerang' || id === 'bee') return;
    for (const pl of plats) {
      if (s.owner === 'p' && s.age < 0.3 && (pl === home || pl === wall)) continue;
      const n = platHit(s, pl);
      if (!n) continue;
      if (s.def.blast) { detonate(s); return; }
      if (id === 'beehive') { burstHive(s); return; }
      if (id === 'jar') { zap(s); return; }
      if (id === 'hole') { s.y -= 30; openHole(s); return; }
      if (id === 'pinata') { burstPinata(s); return; }
      if (AREA[id]) { AREA[id](s); return; }
      if (id === 'clock') {
        if (pl.kind !== 'wall' && n.ny < -0.5 && pl.props.length < 8) pl.props.push({ id: 'clock', ox: s.x - pl.x, oy: s.y - pl.y + s.r * 0.4, rot: s.rot, r: s.r, life: 2.1 });
        armClock(s.x, s.y, null); kill(s); return;
      }
      if (id === 'anvil' && s.st === 1) { quake(pl, s); kill(s); return; }
      if (id === 'bowling') {
        bounceOff(s, n, 0.3); s.vx *= 0.992;
        if (Math.abs(s.vy) > 120) { Sfx.thud(true); pl.shake = Math.max(pl.shake, 0.4); Fx.dust(s.x, s.y + s.r, 3, '#e9e2d0'); }
        if (Math.hypot(s.vx, s.vy) < 50) { breakShot(s, true); return; }
        continue;
      }
      if (s.bounces > 0 && s.owner === 'p') {
        s.bounces--; s.tricks++; bounceOff(s, n, 0.74); s.hits.clear();
        if (id === 'duck') Sfx.quack(); else if (id === 'chicken') Sfx.squeak(); else Sfx.boing();
        Fx.ring(s.x - n.nx * s.r, s.y - n.ny * s.r, 4, 22, 0.2, '#ffffff', 3);
        continue;
      }
      if (id === 'glue') {
        if (pl.kind !== 'wall' && n.ny < -0.5 && pl.props.length < 8) pl.props.push({ id: 'glue', ox: s.x - pl.x, oy: s.y - pl.y + s.r * 0.4, rot: 0, r: s.r, life: 1.6 });
        const gx = s.x, gy = s.y; Sfx.stick();
        zones.push({ kind: 'delay', t: 0.9, fn: () => Sfx.warn() }); zones.push({ kind: 'delay', t: 1.2, fn: () => Sfx.warn() });
        zones.push({ kind: 'delay', t: 1.5, fn: () => blast(gx, gy - 6, 115, 30 * dmgMul(), 1.7, null, false) });
        kill(s); return;
      }
      if (s.def.stick && s.owner === 'p' && pl.kind !== 'wall' && n.ny < -0.5 && pl.props.length < 8) {
        pl.props.push({ id: s.art, ox: s.x - pl.x, oy: s.y - pl.y + s.r * 0.4, rot: s.rot + (s.art === 'forks' ? Math.PI / 2 : 0), r: s.r, life: 3 });
        Sfx.stick(); kill(s); return;
      }
      Sfx.land(); breakShot(s); return;
    }
  }

  function deflect(e, s) {
    if (--e.hp > 0 && !s.def.heavy && !s.def.blast) { Sfx.thud(true); Fx.hit(e.x, e.y, 0, '#e9d7b8', 6); e.vx *= 0.6; return; }
    Fx.hit(e.x, e.y, Math.atan2(s.vy, s.vx), '#ffffff', 10);
    Fx.chunk(e.art, e.x, e.y, s.vx * 0.3, -rand(150, 300), e.r, 0.8);
    if (e.def.blast) Fx.explosion(e.x, e.y, 50);
    Sfx.clang(); style('deflect', e.x, e.y - 20);
    track('deflects'); logHit(s.seq);
    kill(e);
  }
  function quake(pl, s) {
    pl.shake = 1; Sfx.anvil(); shake = Math.max(shake, 0.5);
    Fx.dust(s.x, pl.top, 10); Fx.ring(s.x, pl.top, 10, 90, 0.3, '#ffffff', 4);
    for (const f of foes) if (f.rag.alive && f.rag.plat === pl) { f.rag.stun = 1.3; hurtFoe(f, s.dmg * 0.3, { x: f.rag.chest.x, y: f.rag.chest.y, dirx: 0, diry: -1, s, kb: 0.5 }); }
  }
  function breakLid(f, smashed) {
    const rag = f.rag;
    rag.shield = 0;
    Fx.chunk('lid', rag.offHand.x, rag.offHand.y, rand(120, 320), -rand(260, 460), 24 * rag.s, 1.6);
    Fx.text(rag.offHand.x, rag.offHand.y - 40, smashed ? 'LID SMASHED' : 'LID BROKEN', '#ffd9a0', 18);
    Sfx.clang(); Sfx.thud(true);
  }
  function popBalloon(f, b, s) {
    b.alive = false;
    const pl = f.plat, bx = pl.x + b.ox, by = pl.y + b.oy;
    Fx.burst(bx, by, 10, { color: b.col, speed: [120, 380], life: [0.25, 0.5], size: [3, 6], shape: 'rect' });
    Fx.ring(bx, by, 6, 34, 0.2, '#ffffff', 3); Sfx.pop();
    if (s) logHit(s.seq);
    const left = pl.balloons.filter(q => q.alive).length;
    if (left === 0) { style('pop', bx, by); pl.drop(); if (f.rag.alive) f.lastHit = { s, air: false, head: false }; }
    else pl.baseY += 26;
  }

  /* --------------------------------------------------------- hits on foes */
  /* A throw hits harder the faster it is going when it lands, and softer when it has lost its speed
     (a lob at the top of its arc, a weak pull). Pegged to the speed of an ordinary half-strength throw
     of that item, so a typical hit is unchanged and the swing is only a few percent either way. */
  function impactMul(s) {
    if (s.owner !== 'p') return 1;
    const v = Math.hypot(s.vx, s.vy), ref = (s.def.spd ? throwSpeed(s.def, 0.55) : 900) * (s.def.grav === 0 ? 1 : 0.9);
    const m = clamp(1 + 0.4 * (v / ref - 1), 0.72, 1.4);
    return Number.isFinite(m) ? m : 1;
  }
  // how hard a hit rocks the body follows how fast the thing was going: a slow lob only nudges, a hard throw floors them
  function speedF(s) {
    if (!s || s.def.blast) return 1;
    const v = Math.hypot(s.vx, s.vy), ref = s.owner === 'p' && s.def.spd ? throwSpeed(s.def, 0.55) * 0.9 : 900;
    const f = clamp(v / ref, 0.3, 1.25);
    return Number.isFinite(f) ? f : 1;
  }
  // the little freeze on a solid hit: shorter as the stages climb, never back to back, and never from candies, seeds or bees
  let lastStop = -9;
  const SUBS = new Set(['candy', 'seed', 'bee']);
  function stopFor(base, s) {
    if (s && s.def && SUBS.has(s.def.id)) return;
    if (time - lastStop < 0.2) return;
    lastStop = time;
    hitStop = Math.max(hitStop, base * Math.max(0.25, 1 - 0.06 * (run.stage - 1)));
  }
  function onFoeHit(s, f, hit) {
    s.hits.add(f); s.lastFoe = f;
    const rag = f.rag, def = s.def, id = def.id;
    let head = hit.part === 'head' || (id === 'anvil' && s.st === 1);
    let mult = head ? 2 * (1 + 0.5 * pk('eye')) : hit.part === 'body' ? 1 : 0.75;
    if (!head && !f.dummy && !run.tut && Math.random() < (id === 'horseshoe' ? 0.42 : 0.09) + 0.03 * ulvl('crit')) { mult *= 1.8; stopFor(0.05, s); Fx.text(hit.x, hit.y - 56, 'CRIT!', Theme.acc, 21, -90); Fx.ring(hit.x, hit.y, 6, 54, 0.22, Theme.acc, 4); }
    if (head && rag.helmet) {
      rag.helmet = false;
      Fx.chunk('pot', rag.head.x, rag.head.y - 10, rand(80, 260), -rand(300, 460), 16 * rag.s, 1.5); Sfx.clang();
      if (id !== 'magnet' && !def.heavy) { mult = 0.3; head = false; Fx.text(rag.head.x, rag.head.y - 44, 'HELMET', '#c9d0dc', 17); }
    }
    let dmg = s.dmg * mult * impactMul(s);
    if (id === 'chicken') dmg *= 1 + 0.5 * s.tricks;
    if (id === 'knife' && head) dmg *= 2;
    if (rag.frozen > 0) {
      dmg *= 2; rag.frozen = 0; Sfx.shatter(); style('shatter', hit.x, hit.y - 30);
      Fx.burst(hit.x, hit.y, 16, { colors: ['#ffffff', '#cfeeff', '#9fd0ff'], speed: [120, 420], life: [0.3, 0.7], size: [3, 7], shape: 'rect' });
    }
    const sp = Math.hypot(s.vx, s.vy) || 1;
    let dirx = s.vx / sp, diry = s.vy / sp, kb = s.kb, glued = false;
    // the gimmicks
    if (id === 'cactus') { f.bleed = 5; f.bleedDps = Math.min(18, f.bleedDps + 4 * dmgMul()); }
    else if (id === 'snowball') {
      rag.frozen = f.boss ? 1.1 : 2.7; Sfx.freeze(); f.state = 'idle'; f.t = Math.max(f.t, 0.6);
      Fx.burst(hit.x, hit.y, 12, { colors: ['#ffffff', '#cfeeff'], speed: [60, 260], life: [0.3, 0.6], size: [2, 5] });
    } else if (id === 'duck') { rag.gild = 1.4; Sfx.quack(); }
    else if (id === 'magnet') {
      if (rag.shield > 0) breakLid(f, true);
      if (!f.boss) {       // a boss never loses its grip
        rag.stun = Math.max(rag.stun, 1); f.state = 'idle'; f.t = Math.max(f.t, 1.6);
        Fx.text(rag.head.x, rag.head.y - 44, 'FUMBLE', '#ff9aa0', 17);
      }
    } else if (id === 'plunger') {
      kb = 0; Sfx.yank();
      zones.push({ kind: 'rope', t: 1.0, max: 1.0, rag, nodes: null });
    } else if (id === 'anvil' && s.st === 1) { rag.stun = Math.max(rag.stun, 1.6); Sfx.anvil(); dirx = 0; diry = 1; shake = Math.max(shake, 0.5); }
    else if (id === 'pie') { f.blind = 5; Fx.burst(hit.x, hit.y, 12, { colors: ['#fffaf0', '#f3e6cd'], speed: [80, 300], life: [0.3, 0.6], size: [3, 6], grav: 500 }); Fx.text(rag.head.x, rag.head.y - 44, 'BLINDED', '#fff3d6', 17); Sfx.pop(); }
    else if (id === 'sauce') { f.burnT = 5; Fx.burst(hit.x, hit.y, 14, { colors: ['#ff4a2a', '#ff9a3c', '#ffd24a'], speed: [80, 320], life: [0.3, 0.7], size: [3, 6], grav: -80, glow: true }); Sfx.fizz(); }
    else if (id === 'slime') { f.slow = 6; Fx.burst(hit.x, hit.y, 10, { colors: ['#7dff4a', '#4fd02a'], speed: [60, 240], life: [0.3, 0.6], size: [3, 6], grav: 700 }); Fx.text(rag.head.x, rag.head.y - 44, 'SLOWED', '#b8ff7a', 17); Sfx.stick(); }
    else if (id === 'pan') {
      if (rag.shield > 0) breakLid(f, true);
      rag.stun = Math.max(rag.stun, f.boss ? 0.6 : 1.5); f.state = 'idle'; f.t = Math.max(f.t, f.boss ? 1 : 1.8);
      Sfx.clang(); Fx.ring(hit.x, hit.y, 6, 44, 0.25, '#ffffff', 5); Fx.text(rag.head.x, rag.head.y - 44, 'CLANG', '#ffe9a0', 18);
    } else if (id === 'beachball') { dirx *= 0.25; diry = -1.25; if (!f.boss) kb = Math.max(kb, f.anchor + 0.2); Sfx.boing(); }
    else if (id === 'glue') {
      glued = true; rag.addStuck('glue', hit, Math.atan2(s.vy, s.vx), s.r); Sfx.stick(); Fx.text(hit.x, hit.y - 34, 'ARMED', '#ffb3a0', 16);
      const at = { x: hit.x, y: hit.y };
      zones.push({ kind: 'delay', t: 0.9, fn: () => Sfx.warn() }); zones.push({ kind: 'delay', t: 1.2, fn: () => Sfx.warn() });
      zones.push({ kind: 'delay', t: 1.5, fn: () => { const c = rag.alive ? rag.chest : at; blast(c.x, c.y, 115, 30 * dmgMul(), 1.7, null, false); } });
    }
    else if (id === 'banana') {
      Fx.text(rag.head.x, rag.head.y - 44, 'SLIP!', '#ffe970', 19); Sfx.boing();
      if (f.boss) { rag.stun = Math.max(rag.stun, 0.9); f.state = 'idle'; f.t = Math.max(f.t, 1); } else { kb = Math.max(kb, f.anchor + 0.5); diry = -0.9; dirx *= 0.5; }
    } else if (id === 'dice') {
      const roll = randi(1, 6); dmg *= [0.45, 0.7, 0.95, 1.25, 1.7, 2.4][roll - 1]; Sfx.rattle();
      Fx.text(hit.x, hit.y - 48, 'ROLLED ' + roll, roll === 6 ? '#ffe14d' : roll === 1 ? '#a4abbf' : '#ffffff', roll === 6 ? 26 : 19, -80);
      if (roll === 6) { stopFor(0.06, s); Fx.confetti(hit.x, hit.y, 14); }
    } else if (id === 'teddy') {
      if (!run.demo && player.hp < player.maxHp) { heal(4); Fx.text(player.rag.head.x, player.rag.head.y - 56, '+4', '#9ff0c0', 20, -70); Sfx.heal(); }
      Fx.burst(hit.x, hit.y, 8, { colors: ['#e9c79a', '#ffffff'], speed: [40, 200], life: [0.3, 0.6], size: [2, 4], grav: 100 });
    } else if (id === 'egg') {
      f.bleed = 8; f.bleedDps = Math.min(18, f.bleedDps + 5 * dmgMul()); Sfx.pop();
      Fx.burst(hit.x, hit.y, 14, { colors: ['#e6d99a', '#9bbf3a', '#f6f0da'], speed: [60, 260], life: [0.3, 0.7], size: [3, 6], grav: 500 });
      Fx.text(rag.head.x, rag.head.y - 44, 'STINKY', '#b6d84a', 17);
    } else if (id === 'trap') {
      rag.stun = Math.max(rag.stun, f.boss ? 0.6 : 1.6); f.state = 'idle'; f.t = Math.max(f.t, f.boss ? 1 : 1.9);
      Sfx.snap(); Fx.ring(hit.x, hit.y, 4, 38, 0.2, '#ffffff', 4); Fx.text(rag.head.x, rag.head.y - 44, 'SNAP', '#ffe9a0', 18);
    } else if (id === 'clock') {
      glued = true; rag.addStuck('clock', hit, Math.atan2(s.vy, s.vx), s.r); Fx.text(hit.x, hit.y - 34, 'TICKING', '#ffb3a0', 16);
      armClock(hit.x, hit.y, rag);
    }
    if (pk('hot')) f.burnT = 3;
    if (id === 'beehive') { burstHive(s); }
    else if (id === 'jar') { zap(s); return; }
    else if (id === 'hole') { openHole(s); return; }
    else if (id === 'pinata') { burstPinata(s); }

    if (SUBS.has(id)) { if (Math.random() < 0.5) Fx.hit(hit.x, hit.y, Math.atan2(s.vy, s.vx), '#ffffff', 3); }
    else Fx.hit(hit.x, hit.y, Math.atan2(s.vy, s.vx), head ? '#ffe14d' : '#ffffff', head ? 12 : 7);
    hurtFoe(f, dmg, { x: hit.x, y: hit.y, dirx, diry, s, kb, head, hit });
    if (id === 'plunger' && rag.alive) yank(f, hit);
    if (AREA[id] && !s.dead) { AREA[id](s); return; }
    if (glued) { kill(s); return; }
    hitResolve(s, f, hit);
  }
  // what the projectile itself does after connecting
  function hitResolve(s, f, hit) {
    if (s.dead) return;
    const def = s.def;
    if (def.pierce) { if (def.id === 'bowling') { s.vx *= 0.86; s.vy *= 0.86; } return; }
    if (s.bounces > 0) {
      s.bounces--; s.tricks++; s.rehit = 0.3; s.homeAt = s.age;
      if (hit) { const dx = s.x - hit.x, dy = s.y - hit.y, d = Math.hypot(dx, dy) || 1; bounceOff(s, { nx: dx / d, ny: dy / d, pen: 2 }, 0.8); s.vy -= 160; } else s.vy = -Math.abs(s.vy) * 0.7;
      if (def.id === 'chicken') Sfx.squeak(); else Sfx.boing();
      return;
    }
    if (def.stick && f && hit) { f.rag.addStuck(s.art, hit, Math.atan2(s.vy, s.vx), s.r); Sfx.stick(); kill(s); return; }
    if (def.id === 'bee' || def.id === 'candy' || def.id === 'seed') { kill(s); return; }
    breakShot(s);
  }
  function yank(f, hit) {
    if (f.boss) { f.rag.impulse(P.NECK, -700, -200, 0.6); return; }
    f.rag.knock(-rand(520, 640), -rand(360, 440), f.rag.nearestPoint(hit.x, hit.y), 0.6);
    f.state = 'idle'; f.t = Math.max(f.t, 0.9);
  }

  function hurtFoe(f, dmg, o) {
    const rag = f.rag;
    if (!rag.alive) return;
    if (!Number.isFinite(dmg)) dmg = 1;      // never let a stray NaN into a health bar
    if (f.marked > 0 && !o.dot) dmg *= 1.3;
    if (f.boss && f.boss.resist && !o.dot && !(o.s && (o.s.def.heavy || o.s.def.blast))) { dmg *= f.boss.resist; if (o.s) Fx.text(o.x, o.y - 50, 'RESISTED', '#c9d0dc', 14); }
    if (!f.dummy) f.hp -= dmg;
    if (f.tut && run.tut && !o.dot) run.tut.hits++;
    rag.flash = 1;
    const big = dmg >= 24;
    if ((!o.dot || dmg >= 1) && !(o.s && o.s.def && SUBS.has(o.s.def.id) && (f.lastText || 0) > time - 0.18)) { if (o.s && o.s.def && SUBS.has(o.s.def.id)) f.lastText = time; Fx.text(o.x + rand(-8, 8), o.y - 24, String(Math.max(1, Math.round(dmg))), o.head ? '#ffe14d' : o.dot ? '#ffb070' : '#ffffff', o.dot ? 15 : clamp(17 + dmg * 0.3, 17, 34)) }
    if (!o.dot) {
      if (o.head) Sfx.head(); else Sfx.thud(big);
      if (o.head || big) stopFor(0.045, o.s);
      if (o.s) logHit(o.s.seq);
      if (o.head) { track('headshots'); run.heads++; bump('head'); }
      f.lastHit = { s: o.s, air: rag.mode === 'tumble', head: !!o.head, far: Math.abs(o.x - HOME_X) > 1000 };
      Fx.burst(o.x, o.y, o.head ? 7 : 4, { color: f.def.body, speed: [80, 260], life: [0.25, 0.5], size: [2, 4], grav: 800 });
    }
    if (f.hp <= 0) { killFoe(f, o); return; }
    if (o.dot) return;
    if (f.state === 'wind' && !f.boss && dmg >= 4 && Math.random() < 0.35) { f.state = 'idle'; f.t = rand(0.9, 1.5); rag.pull = 0; style('stop', rag.head.x, rag.head.y - 60); }
    shove(f, o.dirx, o.diry, o.kb, o);
  }
  /* What a blow does to a body. The throw pushes the bone it landed on and
     leaves the muscles soft for a moment; whether the foe keeps its feet after
     that is up to the ragdoll (see Rag.balance). Only the really heavy stuff
     skips that and throws the body clear. Hurt foes take more from every blow. */
  function shove(f, dx, dy, kb, o) {
    const rag = f.rag;
    if (!rag.alive) return;
    const hit = o.hit || { seg: 1, u: 0.5 };
    // Nothing is free: even a weightless hit (bees, a plunger's stick, a rock off a lid) rocks the body.
    const hurt = 1 + 0.9 * (1 - clamp(f.hp / f.maxHp, 0, 1));
    const sf = o.hit ? speedF(o.s) : 1;
    const pw = Math.max(0.9, (kb || 0) * hurt * (1 + 0.4 * pk('shove'))) * sf;
    if (rag.mode === 'tumble') { rag.impulseAt(hit, dx * pw * 340, dy * pw * 290 - 100, 0.7); rag.tumbleT = Math.max(rag.tumbleT, 0.2); return; }
    if (rag.frozen > 0) { rag.jolt(dx * 15 * Math.min(pw, 2.5), dy * 8 * Math.min(pw, 2.5)); return; }   // ice rings instead of bending
    if (pw >= f.anchor && !f.dummy && !f.boss) {
      // carried along by the blow, not popped into the air: the lift only comes with real weight
      const v = 250 + 125 * Math.min(pw, 4.5);
      rag.knock(dx * v, dy * v * 0.6 - 90 - 70 * Math.min(pw, 4), rag.nearestPoint(o.x, o.y), 0.55);
      f.state = 'idle'; f.t = Math.max(f.t, 0.9);
      return;
    }
    if (f.boss || f.dummy) {
      // too big to fall over: the body bends hard around the blow instead
      rag.stagger(0.7 * pw);
      rag.impulseAt(hit, dx * pw * 3300, dy * pw * 2000, 0.3);
      rag.jolt(dx * 3 * Math.min(pw, 3), dy * 2 * Math.min(pw, 3));
      return;
    }
    // a very slow hit does not floor anyone: the body just rocks
    if (sf < 0.5) { rag.stagger(0.3 + 0.5 * sf); rag.impulseAt(hit, dx * 1100 * sf, dy * 700 * sf, 0.25); rag.jolt(dx * 4 * sf, dy * 2 * sf); f.t = Math.max(f.t, 0.25); return; }
    // everything else goes limp: the struck bone takes the blow, the body drops and slides, then gets up
    const mag = (185 + 105 * Math.min(pw, 3.5)) * Math.min(1, 0.45 + 0.55 * sf);
    rag.hitLimp(hit, dx * mag, dy * mag * 0.6 - 70, (0.28 + 0.1 * Math.min(pw, 3)) * Math.min(1, 0.5 + 0.5 * sf));
    f.state = 'idle'; f.t = Math.max(f.t, 0.35 + 0.08 * Math.min(pw, 3));
  }
  function style(k, x, y) {
    const [label, coins] = STYLE[k];
    Fx.text(x, y, label, '#ffd9a0', 19, -95);
    Sfx.style(); bump('style');
    return coins;
  }

  function killFoe(f, o) {
    const rag = f.rag, c = rag.chest;
    const lh = f.lastHit || {};
    const dx = o.dirx || 0, dy = o.diry || 0;
    // the last blow carries the body: a pebble drops it where it stands, a bowling ball takes it along
    const push = Math.min(4, (o.kb == null ? 1 : o.kb) * 1.8 + 0.4);
    rag.die(dx * (150 + 120 * push), dy * (90 + 70 * push) - 120 - 45 * push, rag.nearestPoint(o.x, o.y));
    f.state = 'dead';
    if (f.dummy) return;
    let coins = f.coins * (1 + 0.05 * (run.stage - 1)), y = c.y - 70;
    const add = k => { coins += style(k, c.x, y); y -= 24; };
    if (o.ring) { add('ring'); track('ringouts'); run.rings++; }
    if (o.head) add('head');
    if (lh.air && !o.ring) add('air');
    if (lh.far) add('long');
    if (lh.s && lh.s.tricks > 0) { add('trick'); track('tricks'); }
    if (run.t - run.lastKoAt < 1.1 && !o.sweep) add('double');
    run.lastKoAt = run.t;
    if (lh.s && lh.s.def.id === 'duck') { coins *= 3; Fx.burst(c.x, c.y, 16, { colors: ['#ffd24a', '#fff0a8'], speed: [160, 460], life: [0.5, 1], size: [3, 6], grav: 900, glow: true }); }
    if (o.sweep) coins *= 0.5;
    if (f.gold) {
      coins += 30 + 12 * run.stage;
      Fx.text(c.x, y - 34, 'JACKPOT!', '#ffe14d', 32, -40); Fx.confetti(c.x, c.y, 40); Fx.ring(c.x, c.y, 20, 300, 0.5, '#ffe14d', 8);
      Fx.burst(c.x, c.y, 26, { colors: ['#ffd24a', '#fff0a8'], speed: [160, 520], life: [0.5, 1.1], size: [3, 7], grav: 900, glow: true });
      Sfx.jackpot(); slowT = Math.max(slowT, 0.5);
    }
    if (run.fever > 0) coins *= 2;
    const total = Math.max(1, Math.round(coins * coinMul() * (1 + Math.min(run.combo, 10) * 0.1)));
    gain(total); flyCoins(c.x, c.y - 20, f.gold ? 16 : f.boss ? 12 : clamp(Math.round(total / 4), 2, 7));
    Fx.text(c.x, y - 6, '+' + total + (run.fever > 0 ? '  x2' : ''), '#ffc933', 22, -60);
    Fx.burst(c.x, c.y, 6, { color: '#ffc933', speed: [140, 380], life: [0.4, 0.8], size: [3, 5], grav: 1000, ang: -Math.PI / 2, spread: 1 });
    Sfx.ko(); Sfx.coin(run.combo);
    run.kos++; track('kills');
    bump('ko'); bump('clean'); if (o.ring) bump('ring');
    if (lh.s && lh.s.owner === 'p' && ITEM[lh.s.mast || lh.s.def.id]) {
      const mid = lh.s.mast || lh.s.def.id;
      bump('item', 1, mid);
      const up = Save.masterKill(mid);
      if (up) { run.mastered.push(mid); Sfx.perk(); if (on.toast) on.toast(ITEM[mid].name.toUpperCase() + ' MASTERY ' + '\u2605'.repeat(up) + '  +5% DAMAGE', 'star'); }
    }
    const best = Save.data.best.kos;
    if (!run.beatBest && best >= 5 && run.kos > best) {
      run.beatBest = true; Sfx.record(); Fx.confetti(player.rag.head.x, player.rag.head.y - 30, 40);
      Fx.text(player.rag.head.x, player.rag.head.y - 96, 'NEW BEST!', '#ffe14d', 32, -40);
    }
    if (!f.boss && !f.minion) run.stageKills++;
    if (pk('leech')) heal(6 * pk('leech'));
    if (pk('pop') && !o.sweep) zones.push({ kind: 'delay', t: 0.1, fn: () => blast(c.x, c.y, 115 + 12 * (pk('pop') - 1), 18 * pk('pop') * dmgMul(), 1.6, lh.s || null, false) });
    shake = Math.max(shake, f.boss ? 1 : 0.3);
    slowT = Math.max(slowT, f.boss ? 1.3 : 0.2); slowK = f.boss ? 0.34 : 0.5;
    if (f.boss) bossDown(f);
  }

  function blast(x, y, r, dmg, kb, s, burn) {
    Fx.explosion(x, y, r); Sfx.boom(r > 130); shake = Math.max(shake, 0.6);
    if (burn) Fx.burst(x, y, 22, { colors: ['#ff5d73', '#ffc933', '#45e08a', '#4fa8ff', '#ffffff'], speed: [200, 620], life: [0.5, 1], size: [2.5, 4.5], grav: 420, drag: 2.4, glow: true });
    for (const f of foes) {
      if (!live(f)) continue;
      const c = f.rag.chest, d = dist(x, y, c.x, c.y), reach = r + 34 * f.rag.s;
      if (f.plat && f.plat.balloons) for (const b of f.plat.balloons) if (b.alive && dist(x, y, f.plat.x + b.ox, f.plat.y + b.oy) < r + b.r) popBalloon(f, b, s);
      if (d > reach) continue;
      const fall = 1 - 0.55 * d / reach;
      let dx = (c.x - x) / (d || 1), dy = (c.y - y) / (d || 1) - 0.5;
      const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      if (burn) f.burnT = 3.5;
      if (f.rag.frozen > 0) { f.rag.frozen = 0; Sfx.shatter(); }
      hurtFoe(f, dmg * fall, { x: c.x, y: c.y - 10, dirx: dx, diry: dy, s, kb: kb * (0.6 + 0.4 * fall) });
    }
    for (const e of shots) if (e.owner === 'e' && !e.dead && dist(x, y, e.x, e.y) < r + e.r) { Fx.chunk(e.art, e.x, e.y, (e.x - x) * 3, -300, e.r, 0.8); kill(e); }
    for (const c of crates) if (!c.popped && dist(x, y, c.x, c.y - 30) < r + 30) popCrate(c, s);
  }
  function selfBlast(x, y, r, dmg) {
    if (!player || player.dead || state !== 'play' || run.tut || run.demo) return;
    const c = player.rag.chest, d = dist(x, y, c.x, c.y), reach = r + 30;
    if (d > reach) return;
    const fall = 1 - 0.6 * d / reach, n = d || 1;
    hurtPlayer(dmg * 0.7 * fall * (player.rag.duck > 0.6 ? 0.5 : 1), { x: c.x, y: c.y, dirx: (c.x - x) / n, diry: (c.y - y) / n - 0.3 });
  }
  function blastPlayer(x, y, r, dmg) {
    Fx.explosion(x, y, r * 0.9); Sfx.boom(false); shake = Math.max(shake, 0.5);
    if (player.dead || state !== 'play') return;
    const c = player.rag.chest, d = dist(x, y, c.x, c.y), reach = r + 30;
    if (d > reach) return;
    const fall = 1 - 0.6 * d / reach;
    const n = d || 1;
    hurtPlayer(dmg * fall * (player.rag.duck > 0.6 ? 0.5 : 1), { x: c.x, y: c.y, dirx: (c.x - x) / n, diry: (c.y - y) / n - 0.3 });
  }

  /* --------------------------------------------------------------- player */
  function hurtPlayer(dmg, o) {
    if (player.dead || player.inv > 0 || state !== 'play') return;
    dmg *= armor();
    player.hp -= dmg;
    if (run.tut) player.hp = Math.max(player.hp, player.maxHp * 0.5);   // nobody loses the tutorial
    if (run.bounty && run.bounty.k === 'clean' && !run.bounty.done) run.bounty.prog = 0;
    const stand = player.hp <= 0 && !run.stood && ulvl('stand') > 0 && !run.tut && !run.demo && dmg < 1e8;
    if (stand) {
      run.stood = true; run.stand = STAND_T; player.hp = 1; player.inv = 99; player.cd = 0;
      player.sta = Math.max(player.sta, player.maxSta * 0.6);
      Sfx.stand(); if (on.banner) on.banner('LAST STAND', 'LAND A HIT TO STAY IN IT', true);
    }
    const rag = player.rag;
    rag.flash = 1; hurtFlash = 1; shake = Math.max(shake, 0.45); Sfx.hurt();
    {
      // only a real blow floors you, and not twice in a row: lighter hits just rock the body
      const sf = o.sf || 1;
      const hit = o.hit || { seg: 1, u: 0.5 }, mag = (190 + Math.min(dmg, 30) * 6) * Math.min(1, 0.45 + 0.55 * sf);
      if (rag.mode === 'tumble') rag.impulseAt(hit, o.dirx * mag * 1.2, o.diry * mag * 0.6, 0.7);
      else if (dmg >= 14 && sf >= 0.55 && (player.noLimp || 0) <= 0 && !stand) { rag.hitLimp(hit, o.dirx * mag * 0.8, o.diry * mag * 0.5 - 40, 0.3); player.noLimp = 3.5; aimCancel(); }
      else { rag.stagger(0.45 * Math.min(1, 0.4 + 0.6 * sf)); rag.impulseAt(hit, o.dirx * 1500 * sf, o.diry * 900 * sf, 0.25); rag.jolt(o.dirx * 5 * sf, o.diry * 3 * sf); }
    }
    if (dmg < 1e8) Fx.text(o.x, o.y - 30, '-' + Math.max(1, Math.round(dmg)), '#ff6b78', o.head ? 26 : 21);
    Fx.hit(o.x, o.y, Math.atan2(o.diry, o.dirx), '#ff9aa0', 8);
    if (player.hp > 0) return;
    player.hp = 0; player.dead = true;
    if (!run.demo) Save.clearRun();        // a knocked-out run can never be continued, however the page is left
    rag.die(o.dirx * 380 - 160, -460, P.NECK);
    aimCancel(); Sfx.death();
    slowT = 1.3; slowK = 0.34; run.overT = 1.9; shake = 1;
  }
  function heal(n) {
    if (player.dead || player.hp >= player.maxHp) return;
    player.hp = Math.min(player.maxHp, player.hp + n); healFlash = 1;
  }
  function finishRun(quiet) {
    if (state === 'over') return;
    run.overT = -1;
    state = 'over'; Save.clearRun();
    track('runs');
    const res = Save.recordRun(run.kos, run.stage, run.bestCombo);
    const ranks = Save.claimRanks();
    Save.save();
    if (on.over && !quiet) on.over({ kos: run.kos, stage: run.stage, coins: run.coins, combo: run.bestCombo, heads: run.heads, rings: run.rings, bosses: run.bosses, newBest: res.newBest && run.kos > 0, ranks,
      prevBest: res.prevBest, bounties: run.bountyN, fevers: run.fevers, mastered: run.mastered, toBoss: run.boss ? 0 : stageKills(run.stage) - run.stageKills, bossHp: run.boss && run.boss.rag.alive ? run.boss.hp / run.boss.maxHp : 0, bossName: run.boss ? run.boss.name : '' });
  }

  /* ----------------------------------------------------------------- foes */
  /* Where a new island goes. Each try is scored by how clear it is of the islands already there (1 = a full island's width
     and a comfortable height away); the first clear spot wins, and if the sky is crowded the clearest of the tries does. */
  function pickSpot(w, boss, floater) {
    let best = null, bestScore = -1;
    for (let i = 0; i < 70; i++) {
      const x = boss ? rand(1160, 1380) : rand(760 + w / 2, 1500 - w / 2);
      const y = boss ? rand(430, 600) : floater ? rand(300, 540) : rand(300, 730);
      let score = 9;
      for (const pl of plats) {
        if (pl.kind !== 'foe' || pl.falling) continue;
        const sx = Math.abs(pl.x - x) / ((pl.w + w) / 2 + 46), sy = Math.abs(pl.baseY - y) / 170;
        score = Math.min(score, Math.max(sx, sy));
      }
      if (score > bestScore) { bestScore = score; best = { x, y }; }
      if (score >= 1) break;
    }
    return best;
  }
  // every return is tougher than the last, but the climb flattens out towards a ceiling so a boss can always be brought down
  const BOSS_HP_SOFT = 1200, BOSS_HP_CAP = 3000;
  const bossHp = raw => raw <= BOSS_HP_SOFT ? raw : BOSS_HP_SOFT + (BOSS_HP_CAP - BOSS_HP_SOFT) * (1 - Math.exp(-(raw - BOSS_HP_SOFT) / (BOSS_HP_CAP - BOSS_HP_SOFT)));
  function spawnFoe(type, boss, at) {
    if (!run.demo && !run.tut) run.spawned = (run.spawned || 0) + 1;
    const def = FOES[type];
    const sc = boss ? boss.scale : def.scale;
    const floater = !!def.balloons;
    const w = (at && at.w) || (boss ? 260 : type === 'brute' ? 200 : floater ? 130 : rand(144, 182));
    const pos = at || pickSpot(w, !!boss, floater);
    const pl = new Plat(pos.x, pos.y, w, 'foe');
    pl.state = 'in'; pl.bobA = floater ? (boss ? 36 : 13) : 5; pl.bobS = rand(0.8, 1.4);
    if (!boss && !floater && run.stage >= 4 && Math.random() < Math.min(0.5, (run.stage - 3) * 0.1)) { pl.moveA = rand(36, 80); pl.moveS = rand(0.5, 0.9); }
    pl.y = pl.baseY + 520;
    plats.push(pl);
    const rag = new Rag({ x: pos.x, y: pl.y, scale: sc, facing: -1, body: (boss && boss.body) || def.body, shade: (boss && boss.shade) || def.shade, accent: shade((boss && boss.body) || def.body, -0.45), hat: boss ? boss.hat : def.hat, plat: pl, weight: boss ? 4.5 : def.anchor / 1.7, steady: !!boss });
    const cycle = boss ? Math.floor((run.stage - 1) / BOSSES.length) : 0;      // how many times this boss has come round before
    // each return adds 50% health, and no boss that has already been round once is softer than four fifths of the Wall
    const hp = boss ? bossHp(Math.max(boss.hp * 1.2 * (1 + 0.09 * (run.stage - 1)) * (1 + 0.5 * cycle), cycle > 0 ? 300 * 1.2 * (1 + 0.09 * (run.stage - 1)) * 0.8 : 0)) : def.hp * foeHpMul();
    const f = {
      type, def, rag, plat: pl, hp, maxHp: hp, state: 'enter', t: rand(0.9, 1.8), burst: boss ? boss.burst : def.burst || 1, left: 0, sol: null,
      boss: boss || null, cycle, minion: false, dummy: false, bleed: 0, bleedDps: 0, burnT: 0, dotT: 0.5, coins: boss ? 40 + run.stage * 6 : def.coins,
      anchor: boss ? 99 : def.anchor, lastHit: null, tele: 0, minionT: boss ? rand(9, 13) : 5, gone: false, laser: boss ? !!boss.laser : !!def.laser, slow: 0, blind: 0,
    };
    rag.shield = boss && boss.shield ? boss.shield : def.shield || 0;
    rag.helmet = !boss && type === 'guard' || (!boss && run.stage >= 3 && Math.random() < Math.min(0.45, (run.stage - 2) * 0.08));
    rag.crown = !!boss;
    rag.hold = def.ammo; rag.holdR = AMMO[def.ammo].r * sc * 0.9;
    const nb = boss && boss.balloons ? boss.balloons : def.balloons || 0;
    if (nb) {
      pl.balloons = [];
      const cols = ['#ff5d73', '#ffc933', '#4fa8ff', '#45e08a', '#b05be0', '#ff9a3c'];
      for (let i = 0; i < nb; i++) pl.balloons.push({ ox: (i - (nb - 1) / 2) * (boss ? 40 : 36), oy: -(170 + (i % 2) * 34) * sc - 30, r: 21 * (boss ? 1.15 : 1), alive: true, col: cols[i % cols.length], ph: rand(0, TAU) });
    }
    pl.owner = f; foes.push(f);
    return f;
  }
  function foePool() { return FOE_UNLOCK.filter(([, s]) => run.stage >= s).map(([t]) => t); }
  function spawnWave() {
    const pool = foePool();
    // the newest arrival shows up more often, so each stage has its own feel
    const newest = pool[pool.length - 1];
    let type = Math.random() < 0.34 ? newest : pick(pool);
    if (type === 'brute' && foes.some(f => f.type === 'brute' && f.rag.alive)) type = 'chucker';
    return spawnFoe(type, null);
  }
  // now and then a golden one drifts in. It never fights back and it does not stay long.
  function spawnGold() {
    const f = spawnFoe('chucker', null);
    if (!f) return;
    f.gold = true; f.passive = true; f.minion = true; f.goldT = f.goldMax = 9;
    f.hp = f.maxHp = 26 * foeHpMul(); f.coins = 0;
    f.rag.body = '#ffd24a'; f.rag.shade = '#e0a81e'; f.rag.accent = '#b97a1f'; f.rag.helmet = false; f.rag.hold = null;
    Sfx.gold();
    Fx.text(f.rag.head.x, f.rag.head.y - 70, 'GOLDEN!', '#ffe14d', 24, -30);
  }
  function spawnBoss() {
    const b = BOSSES[(run.stage - 1) % BOSSES.length];
    const f = spawnFoe(b.base, b);
    f.name = b.name;
    run.boss = f; run.bossT = -1;
    Sfx.boss(); shake = 0.6; Sfx.setHype(true);
    if (on.banner) on.banner(b.name, f.cycle > 0 ? 'BACK, AND STRONGER THAN BEFORE' : '', true);
  }
  function bossDown(f) {
    run.boss = null; run.bosses++; Sfx.setHype(run.fever > 0);
    track('bosses');
    const c = f.rag.chest;
    Fx.confetti(c.x, c.y, 60); Fx.ring(c.x, c.y, 20, 420, 0.7, '#ffffff', 10);
    Sfx.bossDown(); Platform.happytime();
    // reinforcements fall with their boss
    let d = 0.15;
    for (const o of foes) {
      if (o === f || !o.rag.alive) continue;
      zones.push({ kind: 'delay', t: d, fn: () => { if (o.rag.alive) { o.hp = 0; killFoe(o, { x: o.rag.chest.x, y: o.rag.chest.y, dirx: rand(-0.5, 0.5), diry: -1, sweep: true }); } } });
      d += 0.12;
    }
    const bonus = Math.round((30 + run.stage * 10) * coinMul());
    gain(bonus);
    Fx.text(c.x, c.y - 150, 'BOSS DOWN  +' + bonus, '#ffc933', 30, -40);
    run.stage++; run.stageKills = 0; run.spawnT = 2.4;
    heal(player.maxHp * 0.25);
    themeFrom = themeTo; themeTo = (run.stage - 1) % THEMES.length; themeT = 0;
    Sfx.setStage(run.stage);
    run.perkT = 1.8;
    Save.save();
  }
  function rollRarity() {
    const st = Math.min(run.stage - 1, 10);
    let r = Math.random();
    for (let i = RARITIES.length - 1; i > 0; i--) { const q = RARITIES[i], p = q.w + q.up * st; if (r < p) return q; r -= p; }
    return RARITIES[0];
  }
  // three different perks, each with its own rarity: a rarer card is worth more stacks of the same perk
  function offerPerks() {
    const room = p => (p.max || 99) - pk(p.id);
    const pool = PERKS.filter(p => room(p) > 0 && !p.legendOnly);
    const picks = [];
    // the Auto Aimer only ever shows up as a legendary: a small chance each time, a bit better the further you get
    const rare = PERKS.find(p => p.legendOnly && room(p) > 0 && !pk(p.id));
    const rareFirst = rare && Math.random() < 0.07 + 0.01 * Math.min(run.stage, 10);
    if (rareFirst) picks.push({ id: rare.id, kind: rare.kind, name: rare.name, n: 1, rarity: RARITIES[3], text: rare.text(1), have: 0 });
    while (picks.length < 3 && pool.length) {
      const p = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      let rar = rollRarity();
      while (rar.n > room(p)) rar = RARITIES[RARITIES.indexOf(rar) - 1];     // never more stacks than the perk can still take
      picks.push({ id: p.id, kind: p.kind, name: p.name, n: rar.n, rarity: rar, text: p.text(rar.n), have: pk(p.id) });
    }
    hold = true; aimCancel(); run.perkPick = picks;
    saveRun();
    if (on.perk) on.perk(picks, run.stage); else pickPerk(picks[0].id, picks[0].n);
  }
  function pickPerk(id, n = 1) {
    run.perkPick = null;
    n = Math.max(1, Math.min(n | 0, (PERK[id].max || 99) - pk(id)));
    run.perks[id] = pk(id) + n;
    if (id === 'skin') { refreshStats(false); heal(35 * n); }
    hold = false; Sfx.perk(); saveRun();
    if (on.banner) on.banner('STAGE ' + run.stage, THEMES[themeTo].name.toUpperCase());
    Sfx.stage();
  }

  function aimAt(f) {
    const rag = f.rag, n = rag.T[P.NECK];
    const pr = player.rag;
    const tx = pr.root.x + rand(-10, 10), ty = pr.root.y - 82;
    const dx = tx - n.x, dy = ty - n.y;
    const far = clamp(Math.abs(dx) / 950, 0.75, 1.25);
    const src = f.boss && f.boss.flight ? f.boss : f.def;
    const T = rand(src.flight[0], src.flight[1]) * far * 1;
    // bosses throw wide and don't sharpen up as the stages go on
    const err = (f.boss ? f.def.err * 2.05 * Math.max(0.55, 1 - 0.015 * (run.stage - 1) - 0.08 * (f.cycle || 0)) : f.def.err * Math.max(0.3, 1 - 0.07 * (run.stage - 1))) * (f.blind > 0 ? 3.5 : 1) * ((f.boss && f.boss.errMul) || 1);
    const vx = dx / T * (1 + gauss() * 0.27 * err), vy = (dy / T - 0.5 * G * T) * (1 + gauss() * 0.19 * err) + gauss() * 70 * err;
    return { vx, vy, ang: Math.atan2(vy, vx), T, ex: n.x + vx * T, ey: n.y + vy * T + 0.5 * G * T * T };
  }
  function foeThrow(f) {
    const rag = f.rag, def = f.def, ammo = AMMO[def.ammo], sol = f.sol, last = f.left <= 1, B = f.boss;
    rag.throwT = 0; rag.pull = 0;
    zones.push({ kind: 'delay', t: RELEASE_AT + 0.01, fn: () => {
      if (!rag.alive || rag.mode !== 'active' || rag.frozen > 0 || rag.stun > 0) return;      // knocked off its throw
      const p0 = release(rag, sol.ang);
      const vx = (sol.ex - p0.x) / sol.T, vy = (sol.ey - p0.y) / sol.T - 0.5 * G * sol.T;     // still arrives where it was aimed
      const n = B && B.fan ? B.fan : 1, dmg = f.tut ? 3 : ammo.dmg * foeDmgMul() * (B ? (B.dmg || 1) * 1.12 * Math.min(2.4, 1 + 0.18 * (f.cycle || 0)) : 1);
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * (B && B.spread || 0), c = Math.cos(a), sn = Math.sin(a);
        launch(ammo, { owner: 'e', x: p0.x, y: p0.y, vx: vx * c - vy * sn, vy: vx * sn + vy * c, dmg, from: f, scale: B ? 1.25 : 1, life: 6 });
      }
      Sfx.foeThrow();
      Fx.ring(rag.hand.x, rag.hand.y, 4, 20, 0.16, '#ffb3ba', 3);
      if (last) { rag.hold = null; f.reload = 0.5; if (B && B.tired) { rag.stun = B.tired; Fx.text(rag.head.x, rag.head.y - 56, 'WINDED', '#ffe9a0', 18); } }
    } });
  }
  function stepFoe(f, dt) {
    const rag = f.rag, def = f.def;
    if (!rag.alive) return;
    if (f.gold) {
      const c = rag.chest;
      if (Math.random() < dt * 9) Fx.burst(c.x + rand(-26, 26), c.y + rand(-60, 40), 1, { colors: ['#fff3b0', '#ffd24a'], speed: [10, 50], life: [0.3, 0.7], size: [2, 4], grav: -60, glow: true });
      if (!Number.isFinite(f.goldT)) f.goldT = 9;
      if (!Number.isFinite(f.goldMax) || f.goldMax <= 0) f.goldMax = 9;
      f.goldAge = (f.goldAge || 0) + dt;
      if (!(f.plat && f.plat.state === 'in')) f.goldT -= dt;
      if (f.goldT <= 0 || f.goldAge > f.goldMax + 8) {      // out of time (or somehow still here long after): the island lets go and takes the prize with it
        f.gold = false; f.dummy = true;
        Fx.text(rag.head.x, rag.head.y - 60, 'GOT AWAY', '#c9d0dc', 18);
        if (f.plat && !f.plat.falling) f.plat.drop();
        if (f.rag.mode === 'active') f.rag.knock(rand(-40, 40), 120, P.PELVIS, 0.5);
        f.rag.body = '#c9ced9'; f.rag.shade = '#9aa1b3';
      }
    }
    // statuses
    if (f.marked > 0) f.marked -= dt;
    if (rag.frozen > 0) rag.frozen -= dt;
    if (rag.stun > 0) rag.stun -= dt;
    rag.burn = f.burnT;
    if (f.bleed > 0 || f.burnT > 0) {
      f.bleed -= dt; f.burnT -= dt;
      if (f.bleed <= 0) f.bleedDps = 0;
      if (f.burnT > 0 && Math.random() < 0.3) { const c = rag.chest; Fx.burst(c.x + rand(-12, 12), c.y + rand(-30, 20), 1, { colors: ['#ffb347', '#ff7a3a', '#fff0b8'], speed: [20, 70], life: [0.25, 0.5], size: [3, 6], grav: -260, drag: 1, glow: true }); Sfx.burn(); }
      if ((f.dotT -= dt) <= 0) {
        f.dotT = 0.5;
        const d = (f.bleed > 0 ? f.bleedDps : 0) * 0.5 + (f.burnT > 0 ? 5 * dmgMul() * 0.5 * Math.max(1, pk('hot')) : 0);
        if (d > 0) hurtFoe(f, d, { x: rag.chest.x, y: rag.chest.y - 30, dot: true, dirx: 0, diry: -1 });
        if (!rag.alive) return;
      }
    }
    // ring-out
    const pv = rag.pts[P.PELVIS];
    const rising = f.plat && f.plat.state === 'in' && rag.mode === 'active';      // still riding its island up from below the screen
    if (!rising && (pv.y > WORLD_H + 150 || (rag.mode === 'tumble' && (pv.x > WORLD_W + 320 || pv.x < -320)))) {
      f.hp = 0;
      killFoe(f, { ring: true, x: clamp(rag.chest.x, 60, WORLD_W - 60), y: Math.min(rag.chest.y, WORLD_H - 40), dirx: 0, diry: 1, head: false });
      return;
    }
    if (rag.mode === 'tumble' && pv.x > home.left - 10 && pv.x < home.right + 30 && pv.y > home.top - 90 && pv.y < home.top + 10) {
      if ((f.homeT = (f.homeT || 0) + dt) > 0.55) {
        f.homeT = 0; rag.knock(rand(480, 620), -rand(560, 680), P.PELVIS, 0.5);
        Fx.text(pv.x, pv.y - 60, 'GET OFF!', '#ffd9a0', 20); Fx.dust(pv.x, home.top, 6); Sfx.thud(true);
      }
    } else f.homeT = 0;
    // last resort for a body snagged on nothing it can stand on: shake it loose
    if (rag.mode === 'tumble' && rag.stuckT > 2.6) { rag.knock(rand(-160, 160), -380, P.PELVIS, 0.4); Fx.dust(pv.x, pv.y, 4); }
    if (rag.mode === 'rising' && rag.plat && f.plat !== rag.plat) f.plat = rag.plat;
    if (rag.mode !== 'active') { rag.aimW = approach(rag.aimW, 0, dt * 6); if (f.state === 'wind') { f.state = 'idle'; f.t = rand(0.7, 1.1); } return; }
    if (f.dummy || f.passive || rag.frozen > 0 || rag.stun > 0 || (f.plat && f.plat.state === 'in')) { rag.aimW = approach(rag.aimW, 0, dt * 5); rag.pull = 0; if (f.state === 'wind') { f.state = 'idle'; f.t = 0.8; } return; }
    if (f.tele > 0) f.tele -= dt;
    if (f.slow > 0) f.slow -= dt;
    if (f.blind > 0) f.blind -= dt;
    if (f.boss && f.boss.enrage && !f.enraged && rag.shield <= 0) { f.enraged = true; rag.flash = 1; Fx.text(rag.head.x, rag.head.y - 60, 'ENRAGED', '#ff8a94', 22); Sfx.boss(); Fx.ring(rag.chest.x, rag.chest.y, 10, 120, 0.4, '#ff5d73', 6); }
    if (f.state === 'enter') f.state = 'idle';
    if (f.state === 'idle') {
      rag.aimW = approach(rag.aimW, 0, dt * 4);
      if (f.reload > 0) f.reload -= dt;
      rag.hold = f.reload > 0 ? null : def.ammo;
      if (player.dead || state !== 'play') return;
      f.t -= dt * (f.slow > 0 ? 0.5 : 1);
      if (f.t <= 0) { f.state = 'wind'; f.windMax = f.t = ((f.boss && f.boss.wind) || def.wind) * Math.max(0.6, 1 - 0.03 * (run.stage - 1)) * (f.enraged ? 0.75 : 1); f.left = f.burst; f.sol = aimAt(f); f.tele = 0.35; Sfx.warn(); }
    } else if (f.state === 'wind') {
      rag.aim = f.sol.ang; rag.aimW = approach(rag.aimW, 1, dt * 7);
      f.t -= dt * (f.slow > 0 ? 0.5 : 1); rag.pull = clamp(1 - f.t / f.windMax, 0, 1);
      if (f.t <= 0) {
        foeThrow(f);
        if (--f.left > 0) { f.windMax = f.t = (f.boss && f.boss.gap) || 0.3; f.sol = aimAt(f); }
        else { const rs = (f.boss && f.boss.rest) || def.rest; f.state = 'idle'; f.t = rand(rs[0], rs[1]) * Math.max(0.5, 1.1 - 0.06 * (run.stage - 1)) * (f.enraged ? 0.7 : 1) * (f.boss ? 0.9 * Math.max(0.65, 1 - 0.07 * (f.cycle || 0)) : 1); }
      }
    }
    // bosses whistle up help
    if (f.boss && (f.minionT -= dt) <= 0) {
      f.minionT = rand(9, 12);
      const cap = 1 + Math.min(1, Math.floor(run.stage / 4));
      if (foes.filter(o => o.rag.alive && o !== f).length < cap) { const m = spawnWave(); m.minion = true; }
    }
  }

  /* --------------------------------------------------------------- crates */
  const BALLOONS = ['#ff5d73', '#ffc933', '#4fa8ff', '#45e08a', '#b05be0', '#ff9a3c', '#35e0ff', '#ff4f93', '#c8ff2e'];
  let lastBalloon = -1;
  function spawnCrate(kind) {
    let i; do { i = Math.floor(Math.random() * BALLOONS.length); } while (i === lastBalloon);
    lastBalloon = i;
    // anywhere across the sky, but never right over your own island
    crates.push({ x: rand(620, WORLD_W - 330), y: WORLD_H + 60, ph: rand(0, TAU), popped: false, t: 0, kind: kind || 'mystery', col: BALLOONS[i] });
  }
  function popCrate(c, s) {
    if (c.popped) return;
    c.popped = true;
    Fx.confetti(c.x, c.y, 26); Fx.burst(c.x, c.y, 8, { colors: ['#b98a52', '#8a6236'], speed: [120, 360], life: [0.4, 0.8], size: [4, 8], shape: 'rect' });
    Sfx.crate(); track('crates'); run.crates++;
    if (s) logHit(s.seq);
    // health and stamina are 15% each, climbing to 25% as that bar runs low (full odds at 60% and above, top odds when empty)
    const odds = frac => 0.15 + 0.10 * clamp(1 - frac / 0.6, 0, 1);
    const pHp = odds(player.hp / player.maxHp), pSta = odds(player.sta / player.maxSta);
    const r = Math.random();
    if (r < pHp) {
      const n = Math.round(player.maxHp * 0.35); heal(n); Sfx.heal();
      Fx.text(c.x, c.y - 40, 'HEALTH +' + n, '#9ff0c0', 24); Fx.ring(c.x, c.y, 8, 70, 0.4, '#9ff0c0', 5);
    } else if (r < pHp + pSta) {
      const n = 75; player.sta = Math.min(player.maxSta, player.sta + n); Sfx.heal();
      Fx.text(c.x, c.y - 40, 'STAMINA +' + n, '#9fd0ff', 24); Fx.ring(c.x, c.y, 8, 70, 0.4, '#9fd0ff', 5);
    } else if (r > 0.88) {
      const n = Math.round(rand(20, 40) * coinMul());
      gain(n); Sfx.coin(4);
      Fx.text(c.x, c.y - 40, 'COINS +' + n, '#ffc933', 24);
    } else {
      const have = bag();
      const pool = ITEMS.filter(i => !have.includes(i.id) && i.id !== 'rock' && i.id !== 'sack');
      const it = pick(pool.length ? pool : ITEMS);
      player.bonus = { id: it.id, n: it.multi ? 3 : 4, on: true };
      Fx.text(c.x, c.y - 40, it.name.toUpperCase() + ' x' + player.bonus.n, '#ffffff', 24);
      if (on.toast) on.toast('FREE THROWS: ' + it.name.toUpperCase() + ' - ' + it.desc, 'gift');
    }
  }

  /* ------------------------------------------------------------ the step */
  function step(dt) {
    if (state === 'play') run.t += dt;
    // player
    const rag = player.rag;
    if (!player.dead) {
      player.cd -= dt; player.inv -= dt; if (player.noLimp > 0) player.noLimp -= dt;
      if ((player.staWait -= dt) <= 0) player.sta = Math.min(player.maxSta, player.sta + staRegen() * dt);
      // a duck is a flat fee and lasts a moment: a dodge, not a place to hide
      if (!duckHeld) { duckTired = false; duckOn = false; }
      else if (!duckOn && !duckTired && state === 'play') {
        if (player.sta >= DUCK_COST) { player.sta -= DUCK_COST; duckOn = true; duckT = DUCK_MAX; if (run.tut) run.tut.ducked = true; }
        else { duckTired = true; staFlash = 0.5; Sfx.empty(); }
      }
      if (duckOn && (duckT -= dt) <= 0) { duckOn = false; duckTired = true; }
      const ducking = duckOn;
      rag.duck = approach(rag.duck, ducking ? 1 : 0, dt * 9);
      const aiming = aim.on && aim.power > 0 && !ducking && state === 'play';
      if (state === 'play') {
        rag.aimW = approach(rag.aimW, aiming ? 1 : 0, dt * (aiming ? 9 : 5));
        if (aiming) { rag.aim = aim.ang; rag.pull = aim.power; player.sta = Math.max(0, player.sta - HOLD_DRAIN * dt); player.staWait = Math.max(player.staWait, 0.1); }
        // holding the pull ran the stamina below what the throw costs: let it go now, rather than leave it stuck in the hand
        if (aiming && aim.afford && aim.power > 0.12 && !run.tut && player.sta < throwCost() && player.cd <= 0.2 && rag.mode === 'active') { aimEnd(aim.id); if (pending) pending.auto = true; }
        else if (rag.throwT < 0) rag.pull = approach(rag.pull, 0, dt * 6);
      }
      const id = currentItemId();
      player.rel = Math.max(0, (player.rel || 0) - dt);
      rag.hold = player.cd > 0.12 && player.rel <= 0 ? null : id; rag.holdR = ITEM[id].r * 0.95;
      if (pending) {
        pending.t -= dt;
        if (ducking || pending.t <= 0) pending = null;
        else if (player.cd <= 0) { tryThrow(pending.ang, pending.power, pending.auto); pending = null; }
      }
    }
    if (state === 'menu') stepDemo(dt);

    for (const pl of plats) {
      pl.update(dt, time);
      for (let i = pl.props.length - 1; i >= 0; i--) if ((pl.props[i].life -= dt) <= 0) pl.props.splice(i, 1);
    }
    wall.y = home.y - 66;
    for (const f of foes) stepFoe(f, dt);
    if (!CHAR[Save.data.char].accent) rag.accent = bandColor(time);
    rag.update(dt, plats);
    // your own island has invisible walls at both ends, and falling off anyway ends the run
    if (!player.dead && state === 'play' && rag.mode !== 'active') {
      for (const p of rag.pts) {
        if (p.x < home.left + 8) { p.x = home.left + 8; p.px = p.x; }
        else if (p.x > home.right - 8) { p.x = home.right - 8; p.px = p.x; }
      }
      if (rag.pts[P.PELVIS].y > WORLD_H + 120) hurtPlayer(1e9, { x: rag.pts[P.PELVIS].x, y: WORLD_H, dirx: 0, diry: 1 });
    }
    for (const f of foes) f.rag.update(dt, plats);
    for (let i = 0; i < shots.length; i++) if (!shots[i].dead) stepShot(shots[i], dt);
    for (let i = shots.length - 1; i >= 0; i--) if (shots[i].dead) shots.splice(i, 1);
    stepZones(dt);

    // an island with nobody on it falls away at once: nobody standing there, nobody about to land there
    for (const pl of plats) {
      if (pl.kind !== 'foe' || pl.falling || pl.state === 'in') continue;
      const o = pl.owner;
      const used = foes.some(f => {
        const r = f.rag;
        if (!r.alive) return false;
        if (r.plat === pl) return true;
        if (f !== o || r.mode !== 'tumble') return false;
        const pv = r.pts[P.PELVIS];     // flung off but still above its island and close enough to land back on it
        return pv.x > pl.left - 70 && pv.x < pl.right + 70 && pv.y < pl.top + 40 && pv.y > pl.top - 320;
      });
      if (!used) { pl.t += dt; if (pl.t > 0.12) pl.drop(); } else pl.t = 0;
    }
    for (const f of foes) if (f.rag.alive && f.rag.plat && f.rag.plat.falling && f.rag.mode !== 'tumble') f.rag.knock(rand(-40, 40), 60, P.PELVIS, 0.4);
    for (let i = plats.length - 1; i >= 0; i--) if (plats[i].falling && plats[i].y > WORLD_H + 400) plats.splice(i, 1);
    for (let i = foes.length - 1; i >= 0; i--) { const r = foes[i].rag; if (!r.alive && (r.deadT > 3.6 || r.pts[P.PELVIS].y > WORLD_H + 500)) foes.splice(i, 1); }

    for (let i = crates.length - 1; i >= 0; i--) {
      const c = crates[i];
      c.t += dt; c.y -= 58 * dt; c.x += Math.sin(c.t * 1.3 + c.ph) * 16 * dt;
      if (c.popped || c.y < -140) crates.splice(i, 1);
    }

    if (state === 'play' && !player.dead) { if (run.tut) stepTut(dt); else director(dt); }
    if (run.fever > 0 && (run.fever -= dt) <= 0) { run.fever = 0; Sfx.setHype(!!run.boss); }
    if (run.stand > 0 && !player.dead) {
      slowT = Math.max(slowT, 0.1); slowK = 0.6;
      run.stand = Math.max(0.001, run.stand - dt);
      if (run.stand <= 0.001 && !shots.some(q => q.owner === 'p' && !q.dead)) {
        run.stand = 0; player.inv = 0;
        hurtPlayer(1e9, { x: rag.head.x, y: rag.head.y, dirx: -0.6, diry: -0.4 });
      }
    }
    if (state === 'play' && !player.dead && !run.tut && !run.demo && !hold && (!run.bounty || run.bounty.done) && (run.bountyT -= dt) <= 0) newBounty();
    if (run.overT > 0 && (run.overT -= dt) <= 0) finishRun();
    if (state === 'play' && !player.dead && !run.demo && !run.tut && Math.floor(run.t / 8) !== run.lastSave) { run.lastSave = Math.floor(run.t / 8); saveRun(); }
    if (run.perkT > 0 && !player.dead && (run.perkT -= dt) <= 0) offerPerks();
    Fx.update(dt);
  }

  function director(dt) {
    const alive = foes.filter(f => f.rag.alive);
    if (run.boss) return;
    if (run.bossT > 0) { if ((run.bossT -= dt) <= 0) spawnBoss(); return; }
    if (run.perkT > 0 || hold) return;
    if (run.stageKills >= stageKills(run.stage)) { if (!alive.length) run.bossT = 0.9; return; }
    const cap = Math.min(5, 1 + Math.ceil(run.stage / 2));
    if (alive.length < cap && run.stageKills + alive.filter(f => !f.minion).length < stageKills(run.stage)) {
      if (!alive.length) run.spawnT = Math.min(run.spawnT, 0.25);
      run.spawnT -= dt;
      if (run.spawnT <= 0) { spawnWave(); run.spawnT = rand(1.4, 2.4) * Math.max(0.55, 1 - 0.04 * run.stage); }
    }
    if ((run.goldT -= dt) <= 0 && alive.length && !alive.some(f => f.gold)) { spawnGold(); run.goldT = rand(42, 65); }
    if ((run.crateT -= dt * (1 + pk('crate'))) <= 0 && crates.length === 0) { spawnCrate(); run.crateT = rand(20, 30); }
  }

  /* The plunger's rope: a chain of points hanging from your hand to the foe, a fixed length, pulled by gravity.
     As the foe is dragged in it goes slack and swings, and while it is stretched it snaps straight. */
  const ROPE_N = 16;
  function stepRope(z, dt) {
    const a = player.rag.hand, b = z.rag.chest;
    if (!z.nodes) {
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      z.len = d * 1.12; z.nodes = [];
      for (let k = 0; k < ROPE_N; k++) { const t = k / (ROPE_N - 1); z.nodes.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) + Math.sin(t * Math.PI) * 18, px: 0, py: 0 }); z.nodes[k].px = z.nodes[k].x; z.nodes[k].py = z.nodes[k].y; }
    }
    const nodes = z.nodes, seg = z.len / (ROPE_N - 1), sub = 3, h = dt / sub;
    for (let st = 0; st < sub; st++) {
      for (let k = 1; k < ROPE_N - 1; k++) {
        const p = nodes[k], vx = (p.x - p.px) * 0.992, vy = (p.y - p.py) * 0.992;
        p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + 1400 * h * h;
      }
      for (let it = 0; it < 10; it++) {
        nodes[0].x = a.x; nodes[0].y = a.y; nodes[ROPE_N - 1].x = b.x; nodes[ROPE_N - 1].y = b.y;
        for (let k = 0; k < ROPE_N - 1; k++) {
          const p = nodes[k], q = nodes[k + 1], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1e-4, diff = (d - seg) / d;
          const pw = k === 0 ? 0 : 0.5, qw = k + 1 === ROPE_N - 1 ? 0 : 0.5, tot = (pw + qw) || 1;
          p.x += dx * diff * pw / tot; p.y += dy * diff * pw / tot; q.x -= dx * diff * qw / tot; q.y -= dy * diff * qw / tot;
        }
      }
    }
  }
  function stepZones(dt) {
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      if (z.kind === 'delay') { if ((z.t -= dt) <= 0) { zones.splice(i, 1); z.fn(); } continue; }
      if (z.kind === 'rope') { if ((z.t -= dt) <= 0 || !z.rag.alive) zones.splice(i, 1); else stepRope(z, dt); continue; }
      // pocket hole: drag everything in, then spit it out
      z.t += dt;
      const R = 310;
      for (const f of foes) {
        const rag = f.rag;
        if (!rag.alive) continue;
        const c = rag.chest, dx = z.x - c.x, dy = z.y - c.y, d = Math.hypot(dx, dy) || 1;
        if (d > R) continue;
        if (f.boss || f.dummy) { rag.impulse(P.NECK, dx / d * 30, dy / d * 30, 1); continue; }
        if (rag.mode !== 'tumble' && d < 250 && rag.frozen <= 0) { rag.knock(dx / d * 120, -160, P.NECK, 0.3); f.state = 'idle'; f.t = Math.max(f.t, 1); }
        if (rag.mode === 'tumble') {
          rag.tumbleT = 0.3;
          const a = 2600 * (1 - d / R) + 700;
          for (const p of rag.pts) { p.px -= (dx / d * a - (p.x - p.px) / dt * 1.6) * dt * dt; p.py -= (dy / d * a - G * 0.9 - (p.y - p.py) / dt * 1.6) * dt * dt; }
        }
      }
      for (const e of shots) {
        if (e.owner !== 'e' || e.dead) continue;
        const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (d > R + 60) continue;
        e.vx += dx / d * 2600 * dt; e.vy += dy / d * 2600 * dt; e.vx *= 0.97; e.vy *= 0.97;
        if (d < 34) { Fx.burst(e.x, e.y, 5, { color: '#b98cff', speed: [40, 160], life: [0.2, 0.4], size: [2, 4], grav: 0 }); kill(e); }
      }
      if (Math.random() < 0.6) { const a = rand(0, TAU), rr = rand(90, 200); Fx.burst(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, 1, { colors: ['#b98cff', '#e4d3ff'], speed: [200, 300], life: [0.25, 0.4], size: [2, 3.5], grav: 0, drag: 0, ang: a + Math.PI, spread: 0.1 }); }
      if (z.t >= z.dur) {
        zones.splice(i, 1);
        Fx.ring(z.x, z.y, 10, 230, 0.4, '#e4d3ff', 9); Fx.burst(z.x, z.y, 26, { colors: ['#b98cff', '#e4d3ff', '#ffffff'], speed: [200, 700], life: [0.3, 0.7], size: [3, 6], grav: 0, drag: 2.5, glow: true });
        Sfx.boom(true); shake = Math.max(shake, 0.6);
        if (z.s && z.s.owner === 'p') selfBlast(z.x, z.y, 190, z.dmg * 1.4);     // the pocket hole spits at you too
        for (const f of foes) {
          const rag = f.rag;
          if (!rag.alive) continue;
          const c = rag.chest, dx = c.x - z.x, dy = c.y - z.y, d = Math.hypot(dx, dy) || 1;
          if (d > 190) continue;
          let nx = dx / d, ny = dy / d - 0.6; const n = Math.hypot(nx, ny) || 1; nx /= n; ny /= n;
          if (d < 20) { nx = rand(-0.6, 0.6); ny = -0.8; }
          hurtFoe(f, z.dmg, { x: c.x, y: c.y, dirx: nx, diry: ny, s: z.s, kb: z.kb });
        }
        logDone(z.seq);
      }
    }
  }

  // the home screen: your thrower lobs whatever is in slot one at a dummy
  /* ---- item preview: the shop shows a thing doing what it does, on foes that take it and never fight back ---- */
  let previewId = null, previewGap = 0;
  function spawnPreviewFoes() {
    const spots = [{ x: 860, y: 530 }, { x: 1010, y: 440 }];
    for (const at of spots) {
      const f = spawnFoe('chucker', null, at);
      f.passive = true; f.preview = true; f.hp = f.maxHp = 9999; f.plat.state = 'idle'; f.plat.y = f.plat.baseY; f.rag.snap();
    }
  }
  function preview(id) {
    state = 'menu'; paused = false; hold = false; slowT = 0; hitStop = 0;
    run = freshRun(true);
    themeFrom = themeTo = (Math.max(1, Save.data.best.stage) - 1) % THEMES.length; themeT = 1;
    buildWorld();
    previewId = id; previewGap = 0; spawnPreviewFoes();
    demoT = 1.0; aimCancel(); Sfx.setStage(1);
  }
  function endPreview() { previewId = null; toMenu(); }
  function stepDemo(dt) {
    const rag = player.rag;
    let d;
    if (previewId) {
      // keep two targets standing: top the health up, and bring them back if they were knocked off
      const live2 = foes.filter(f => f.preview && f.rag.alive);
      if (!live2.length) { if ((previewGap += dt) > 1.1) { previewGap = 0; foes.length = 0; plats.splice(0, plats.length, home, wall); spawnPreviewFoes(); } return; }
      for (const f of live2) { f.hp = f.maxHp; f.t = Math.max(f.t, 1); f.state = 'idle'; if (f.blind > 0) f.blind -= dt * 0.5; }
      d = live2[0];
    } else d = foes.find(f => f.dummy);
    if (!d || !d.rag.alive) return;
    demoT -= dt;
    const id = previewId || currentItemId(), def = ITEM[id] || ITEM.rock;
    rag.hold = player.cd > 0.12 ? null : id; rag.holdR = def.r * 0.95;
    player.cd -= dt; player.sta = player.maxSta;
    if (demoT < 0.7 && demoT > 0) {
      const c = d.rag.chest, n = rag.T[P.NECK];
      const T = def.life ? def.life * 0.6 : 0.95, g = G * (def.grav || 0.001);
      const aimAt = previewId && id === 'anvil' ? { x: d.rag.head.x, y: d.rag.head.y - 150 } : previewId && id === 'hole' ? { x: c.x - 60, y: c.y } : { x: c.x, y: c.y - 20 };
      const vx = (aimAt.x - n.x) / T, vy = (aimAt.y - n.y) / T - 0.5 * g * T;
      // the same pose and release as a real throw: pull back, cock, whip, let go
      const ang = Math.atan2(vy, vx), pw = clamp((Math.hypot(vx, vy) / (def.spd || 1) - THROW_MIN) / (THROW_MAX - THROW_MIN), 0.2, 1);
      rag.aim = ang; rag.aimW = approach(rag.aimW, 1, dt * 9); rag.pull = clamp(1 - demoT / 0.7, 0, 1) * pw;
      player.demo = { ang, pw };
    } else if (demoT <= 0 && player.demo) {
      player.cd = 0; player.sta = player.maxSta;
      tryThrow(player.demo.ang, player.demo.pw);
      player.demo = null;
      demoT = previewId ? rand(3.2, 4) : rand(2.4, 3.4);
    } else { rag.aimW = approach(rag.aimW, 0, dt * 5); if (rag.throwT < 0) rag.pull = approach(rag.pull, 0, dt * 6); }
    if (d.rag.frozen > 0) d.rag.frozen -= dt;
  }

  function update(dtReal) {
    time += dtReal;
    shake = Math.max(0, shake - dtReal * 2.4);
    if (aim.on) aim.t += dtReal;
    {
      const settled = aim.on && aim.power > 0.12 && time - aim.moved > 0.08 && aim.t > 0.12;
      aim.vis = approach(aim.vis, settled ? 1 : 0, dtReal * (settled ? 6 : 14));
    }
    if (aim.snap) aim.snap.t += dtReal;
    if (aim.flash > 0) aim.flash -= dtReal;
    hurtFlash = Math.max(0, hurtFlash - dtReal * 2.2); healFlash = Math.max(0, healFlash - dtReal * 1.6); staFlash = Math.max(0, staFlash - dtReal);
    themeT = Math.min(1, themeT + dtReal * 0.6);
    feverGlow = approach(feverGlow, run && run.fever > 0 && state === 'play' ? 1 : 0, dtReal * 3);
    for (let i = coinFx.length - 1; i >= 0; i--) {
      const c = coinFx[i];
      if (paused) break;
      c.t += dtReal;
      if (c.t >= c.dur) { coinFx.splice(i, 1); coinPing++; Sfx.tick(); }
    }
    menuT = approach(menuT, state === 'menu' ? 1 : 0, dtReal * 2.2);
    if (paused || hold) return;
    if (hitStop > 0) { hitStop -= dtReal; return; }
    let k = 1;
    if (slowT > 0) { slowT -= dtReal; k = slowK; }
    acc += dtReal * k;
    let n = 0;
    while (acc >= STEP && n < 8) { step(STEP); acc -= STEP; n++; }
    if (n === 8) acc = 0;
  }

  /* --------------------------------------------------------------- render */
  // a directed camera (used to film the trailer): w = how many world units fit across the screen, centred on x, y
  let cine = null;
  function camera() {
    if (cine) { const k = cw / cine.w; view.s = k; view.ox = cw / 2 - cine.x * k; view.oy = ch / 2 - cine.y * k; return; }
    const s0 = Math.min(cw / WORLD_W, ch / WORLD_H);
    const ps = s0, pox = (cw - WORLD_W * ps) / 2, poy = (ch - WORLD_H * ps) / 2;
    // menu: zoom in on the two throwers, to the right of the ink panel
    const room = Math.max(200, cw - menuInset);
    const ms = Math.min(room / 1000, ch / 760), mox = menuInset + (room - 1000 * ms) / 2 - 80 * ms, moy = ch * 0.5 - 500 * ms;
    const t = easeInOut(menuT);
    view.s = lerp(ps, ms, t); view.ox = lerp(pox, mox, t); view.oy = lerp(poy, moy, t);
  }

  // one wooden crate: planks with grain, a darker frame, steel corner plates with rivets and a cross brace
  function drawCrate(x, y, w, h, rot, tone) {
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot);
    const hw = w / 2, hh = h / 2, pl = 3, ph = h / pl;
    const light = tone ? '#c99a62' : '#c4935a', mid = tone ? '#b98a52' : '#b2824c', dark = '#94673a';
    ctx.fillStyle = 'rgba(30,20,10,0.22)'; ctx.beginPath(); ctx.roundRect(-hw + 2, -hh + 3, w, h, 4); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(-hw, -hh, w, h, 4); ctx.clip();
    for (let i = 0; i < pl; i++) {
      const py = -hh + i * ph;
      ctx.fillStyle = i % 2 ? light : mid; ctx.fillRect(-hw, py, w, ph);
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(-hw, py, w, 1.6);
      ctx.fillStyle = 'rgba(40,24,8,0.28)'; ctx.fillRect(-hw, py + ph - 1.6, w, 1.6);
      ctx.strokeStyle = 'rgba(80,50,20,0.28)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let g = 0; g < 3; g++) { const gy = py + ph * (0.3 + 0.2 * g), gx = -hw + 4 + ((i * 11 + g * 17) % 14); ctx.moveTo(gx, gy); ctx.lineTo(gx + 9 + g * 3, gy + (g % 2 ? 0.8 : -0.8)); }
      ctx.stroke();
    }
    ctx.restore();
    // frame and brace
    ctx.strokeStyle = dark; ctx.lineWidth = 3.4; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.roundRect(-hw + 1.7, -hh + 1.7, w - 3.4, h - 3.4, 3); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-hw + 5, -hh + 5); ctx.lineTo(hw - 5, hh - 5); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,190,0.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-hw + 6, -hh + 4); ctx.lineTo(hw - 4, hh - 6); ctx.stroke();
    // steel corner plates + rivets
    for (const [cx, cy, sx, sy] of [[-hw, -hh, 1, 1], [hw, -hh, -1, 1], [-hw, hh, 1, -1], [hw, hh, -1, -1]]) {
      ctx.fillStyle = '#59616f'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + sx * 11, cy); ctx.lineTo(cx + sx * 11, cy + sy * 3.4); ctx.lineTo(cx + sx * 3.4, cy + sy * 3.4); ctx.lineTo(cx + sx * 3.4, cy + sy * 11); ctx.lineTo(cx, cy + sy * 11); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8b94a4'; ctx.fillRect(Math.min(cx, cx + sx * 11), Math.min(cy, cy + sy * 1.6), 11, 1.4);
      ctx.fillStyle = '#c9d0dc'; ctx.beginPath(); ctx.arc(cx + sx * 2.2, cy + sy * 2.2, 1, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function drawWall(th) {
    const L = wall.left, T = wall.top, w = wall.w, h = wall.h / 2;
    drawCrate(L - 1, T + h, w + 2, h, 0, false);                 // bottom crate sits square on the grass
    drawCrate(L + 3, T - 0.5, w - 4, h, -0.045, true);            // the top one is plonked on slightly crooked
    ctx.strokeStyle = th.grassHi; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath();
    for (const [dx, hh, sw] of [[-5, 9, -3], [-1, 12, 1], [3, 8, 4]]) { ctx.moveTo(L + dx, T + wall.h + 1); ctx.lineTo(L + dx + sw, T + wall.h - hh); }
    for (const [dx, hh, sw] of [[w + 1, 10, 3], [w + 5, 7, 4]]) { ctx.moveTo(L + dx, T + wall.h + 1); ctx.lineTo(L + dx + sw, T + wall.h - hh); }
    ctx.stroke();
  }

  function drawBalloons(pl) {
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    for (const b of pl.balloons) {
      if (!b.alive) continue;
      const bx = pl.x + b.ox + Math.sin(time * 1.6 + b.ph) * 4, by = pl.y + b.oy + Math.cos(time * 1.3 + b.ph) * 3;
      const ax = pl.x + clamp(b.ox, -pl.w / 2 + 6, pl.w / 2 - 6);
      ctx.beginPath(); ctx.moveTo(bx, by + b.r * 1.15); ctx.quadraticCurveTo((bx + ax) / 2 + 8, (by + pl.y) / 2, ax, pl.y); ctx.stroke();
      ctx.fillStyle = b.col; ctx.beginPath(); ctx.ellipse(bx, by, b.r * 0.9, b.r * 1.1, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx - 4, by + b.r * 1.05); ctx.lineTo(bx + 4, by + b.r * 1.05); ctx.lineTo(bx, by + b.r * 1.3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(bx - b.r * 0.3, by - b.r * 0.4, b.r * 0.2, b.r * 0.34, -0.5, 0, TAU); ctx.fill();
    }
  }

  function drawFoeUi(f) {
    const rag = f.rag;
    if (!rag.alive || f.dummy) return;
    const hd = rag.head, s = rag.s;
    if (f.gold) {
      // sits just above the health bar once that has appeared, otherwise where the bar will go
      const w = 54, k = clamp(f.goldT / f.goldMax, 0, 1), y = hd.y - 34 * s - (f.hp < f.maxHp ? 13 : 0);
      ctx.fillStyle = 'rgba(12,14,21,0.6)'; ctx.fillRect(hd.x - w / 2, y, w, 5);
      ctx.fillStyle = '#ffe14d'; ctx.fillRect(hd.x - w / 2, y, w * k, 5);
    }
    // wind-up tell: a ring that closes in on the throwing hand
    if (f.state === 'wind') {
      const k = clamp(f.t / f.windMax, 0, 1), h = rag.hand;
      ctx.globalAlpha = 0.85; ctx.strokeStyle = '#ff5d73'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(h.x, h.y - 6, 10 + k * 26, 0, TAU); ctx.stroke();
      if (f.laser && f.sol) {
        const n = rag.T[P.NECK];
        ctx.globalAlpha = 0.25 + 0.6 * (1 - k); ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
        ctx.beginPath();
        for (let i = 0; i <= 14; i++) { const t = i * 0.05; const x = n.x + f.sol.vx * t, y = n.y + f.sol.vy * t + 0.5 * G * t * t; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    }
    if (f.marked > 0) {
      ctx.globalAlpha = Math.min(0.5, f.marked * 0.3); ctx.fillStyle = '#ff4fa8';
      const c = rag.chest; ctx.beginPath(); ctx.ellipse(c.x - 3, c.y - 2, 16 * s, 22 * s, 0.2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(c.x + 12 * s, c.y + 14 * s, 6 * s, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (f.boss || f.hp >= f.maxHp) return;
    const w = 46 * s, x = hd.x - w / 2, y = hd.y - 34 * s - (rag.crown ? 14 * s : 0);
    ctx.fillStyle = 'rgba(12,14,21,0.75)'; ctx.beginPath(); ctx.roundRect(x - 2, y - 2, w + 4, 9, 4); ctx.fill();
    ctx.fillStyle = f.bleed > 0 ? '#7ad06a' : f.burnT > 0 ? '#ff9a3c' : '#ff5d73';
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(3, w * clamp(f.hp / f.maxHp, 0, 1)), 5, 2.5); ctx.fill();
  }

  // where the throw would land if it flew unobstructed: the first foe or island it meets
  function predictImpact(def, power, ang) {
    const v = throwSpeed(def, power), p0 = release(player.rag, ang), g = G * (def.grav != null ? def.grav : 1);
    let x = p0.x, y = p0.y, vx = Math.cos(ang) * v, vy = Math.sin(ang) * v;
    const r = Math.max(8, def.r);
    for (let t = 0; t < 3; t += 0.012) {
      x += vx * 0.012; y += vy * 0.012 + 0.5 * g * 0.012 * 0.012; vy += g * 0.012;
      if (y > WORLD_H + 80 || x > WORLD_W + 200) return null;
      if (t > 0.1) {
        for (const f of foes) { if (live(f) && f.rag.hitTest(x, y, r)) return { x, y, foe: true }; }
        for (const pl of plats) {
          if (pl === home || pl.falling || pl.state === 'in') continue;
          if (x > pl.left - r * 0.5 && x < pl.right + r * 0.5 && y + r * 0.6 > pl.top && y - r < pl.bottom && !(pl === wall && x < pl.left)) return { x, y: Math.min(y, pl.top), foe: false };
        }
      }
    }
    return null;
  }

  // the arc: dots that flow away from the hand, shrinking, with a reticle where it lands
  function drawAimGuide() {
    if (!aim.on || aim.power <= 0 || player.dead || player.rag.duck > 0.5 || aim.vis < 0.02) return;
    const def = ITEM[currentItemId()];
    const v = throwSpeed(def, aim.power), p0 = release(player.rag, aim.ang);
    let vx = Math.cos(aim.ang) * v, vy = Math.sin(aim.ang) * v;
    const g = G * (def.grav != null ? def.grav : 1);
    const n = 9 + 3 * ulvl('guide'), gap = 30, can = player.sta >= staCost(def) || usingBonus();
    const col = can ? '#ffffff' : '#ff8a94';
    const hit = can ? predictImpact(def, aim.power, aim.ang) : null;
    const shown = n * aim.vis * aim.vis * (3 - 2 * aim.vis);      // the dots draw themselves on from the hand outwards, easing in
    let x = p0.x, y = p0.y, d = (time * 70) % gap, i = 0;
    const h = 0.004;
    for (let k = 0; k < 1100 && i < n; k++) {
      vy += g * h; const sx = vx * h, sy = vy * h;
      x += sx; y += sy; d += Math.hypot(sx, sy);
      if (d < gap) continue;
      d -= gap; i++;
      const f = 1 - i / (n + 1), reveal = clamp(shown - (i - 1), 0, 1);
      if (reveal <= 0) break;
      ctx.globalAlpha = (0.4 + 0.6 * f) * reveal;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 2.8 + 3.2 * f, 0, TAU); ctx.fill();
    }
    if (hit) {
      const pulse = 1 + 0.12 * Math.sin(time * 9), r = (hit.foe ? 17 : 11) * pulse;
      ctx.globalAlpha = (hit.foe ? 0.95 : 0.55) * clamp((aim.vis - 0.55) * 2.2, 0, 1); ctx.lineCap = 'round';
      for (const [w, c] of [[3, hit.foe ? '#ff5d73' : '#ffffff']]) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); ctx.arc(hit.x, hit.y, r, 0, TAU); ctx.stroke();
        if (hit.foe) { ctx.beginPath(); for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2 + time * 0.8; ctx.moveTo(hit.x + Math.cos(a) * (r + 3), hit.y + Math.sin(a) * (r + 3)); ctx.lineTo(hit.x + Math.cos(a) * (r + 10), hit.y + Math.sin(a) * (r + 10)); } ctx.stroke(); }
      }
    }
    ctx.globalAlpha = 1;
  }

  /* The pull, drawn where the finger is:
       a dashed ring for how far a full-power pull reaches, with a ripple when you press
       a gauge ring around the anchor that fills with power, and notches at 25/50/75/100%
       two elastic strands from the anchor to a knob that carries the power number
       an arrow out the far side of the anchor for the way it will fly
       a burst at MAX, and on release the elastic snaps back past the anchor and settles */
  function drawPull() {
    const ink = 'rgba(0,0,0,0)';           // no dark outlines: a soft shadow keeps the white readable on light skies
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = 'rgba(10,12,22,0.5)'; ctx.shadowBlur = 9;
    if (!aim.on && aim.snap) {   // the release
      const S = aim.snap, k = S.t / 0.28;
      if (k >= 1) { aim.snap = null; ctx.restore(); return; }
      const e = easeOutBack(clamp(k / 0.7, 0, 1)), px = lerp(S.kx, S.sx, e), py = lerp(S.ky, S.sy, e);
      ctx.globalAlpha = 1 - k;
      const nx = -S.uy * 10 * (1 - k), ny = S.ux * 10 * (1 - k);
      for (const [w, c] of [[8, ink], [3.4, S.col]]) {
        ctx.strokeStyle = c; ctx.lineWidth = w * (1 - 0.6 * k);
        ctx.beginPath(); ctx.moveTo(S.sx + nx, S.sy + ny); ctx.lineTo(px, py); ctx.lineTo(S.sx - nx, S.sy - ny); ctx.stroke();
      }
      ctx.fillStyle = S.col; ctx.beginPath(); ctx.arc(px, py, (17 + 5 * S.p) * (1 - 0.5 * k), 0, TAU); ctx.fill();
      ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5 * (1 - k);
      ctx.beginPath(); ctx.arc(S.sx, S.sy, 12 + 70 * easeOut(k) * (0.5 + S.p), 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore(); return;
    }
    if (!aim.on || state !== 'play' || player.dead) { ctx.restore(); return; }
    const p = aim.power, max = aim.max;
    const dx = aim.cx - aim.sx, dy = aim.cy - aim.sy, len = Math.hypot(dx, dy);
    const ux = len > 0.5 ? dx / len : 0, uy = len > 0.5 ? dy / len : 1;
    const L = Math.min(len, max), kx = aim.sx + ux * L, ky = aim.sy + uy * L;
    const def = ITEM[currentItemId()];
    const can = usingBonus() || player.sta >= staCost(def);
    const full = p >= 0.985;
    const col = !can ? '#9aa1b3' : full ? '#ff5d73' : mixHex('#ffffff', Theme.acc, p);
    aim.col = col; aim.ux = ux; aim.uy = uy; aim.kx = kx; aim.ky = ky;
    const appear = Math.min(1, aim.t / 0.12);
    // press ripple
    if (aim.t < 0.4) {
      const k = aim.t / 0.4; ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(aim.sx, aim.sy, 10 + 46 * easeOut(k), 0, TAU); ctx.stroke();
    }
    // reach ring
    ctx.globalAlpha = 0.5 * appear;
    ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.setLineDash([3, 11]);
    ctx.beginPath(); ctx.arc(aim.sx, aim.sy, max, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(aim.sx, aim.sy, max, 0, TAU); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = appear;
    if (p > 0) {
      // notches along the pull line
      for (let q = 1; q <= 4; q++) {
        const f = q / 4, cx = aim.sx + ux * max * f, cy = aim.sy + uy * max * f, nl = q === 4 ? 11 : 6;
        ctx.strokeStyle = p >= f - 0.001 ? col : 'rgba(255,255,255,0.45)'; ctx.lineWidth = q === 4 ? 3.5 : 2.4;
        ctx.beginPath(); ctx.moveTo(cx - uy * nl, cy + ux * nl); ctx.lineTo(cx + uy * nl, cy - ux * nl); ctx.stroke();
      }
      // the way it will fly
      const al = 30 + 44 * p, ax = aim.sx - ux * al, ay = aim.sy - uy * al, a = Math.atan2(-uy, -ux);
      for (const [w, c] of [[9, ink], [4.5, col]]) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(aim.sx - ux * 18, aim.sy - uy * 18); ctx.lineTo(ax, ay);
        ctx.moveTo(ax + Math.cos(a + 2.5) * 13, ay + Math.sin(a + 2.5) * 13); ctx.lineTo(ax, ay); ctx.lineTo(ax + Math.cos(a - 2.5) * 13, ay + Math.sin(a - 2.5) * 13);
        ctx.stroke();
      }
      // elastic: thinner the further it stretches, and it hums a little at full draw
      const nx = -uy * 10, ny = ux * 10, hum = full ? Math.sin(time * 70) * 1.6 : 0;
      for (const [w, c] of [[lerp(9, 5.5, p), ink], [lerp(5.5, 2.4, p), col]]) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(aim.sx + nx, aim.sy + ny); ctx.lineTo(kx + hum * -uy, ky + hum * ux); ctx.lineTo(aim.sx - nx, aim.sy - ny); ctx.stroke();
      }
      if (len > max + 6) {
        ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([2, 7]);
        ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(aim.cx, aim.cy); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = appear;
      }
    }
    // anchor with a gauge ring that fills with power
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(aim.sx, aim.sy, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(aim.sx, aim.sy, 18, 0, TAU); ctx.stroke();
    if (p > 0) { ctx.strokeStyle = col; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(aim.sx, aim.sy, 18, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke(); }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(aim.sx, aim.sy, 13, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(aim.sx, aim.sy, 3.5, 0, TAU); ctx.fill();
    // burst the moment full power is reached
    if (full && !aim.maxed) { aim.maxed = true; aim.flash = 0.3; try { if (navigator.vibrate) navigator.vibrate(14); } catch (e) { /* not everywhere */ } }
    if (!full) aim.maxed = false;
    if (aim.flash > 0) {
      const k = 1 - aim.flash / 0.3; ctx.globalAlpha = (1 - k); ctx.strokeStyle = '#ff5d73'; ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(kx, ky, 20 + 40 * easeOut(k), 0, TAU); ctx.stroke(); ctx.globalAlpha = appear;
    }
    // knob with the power on it
    const r = 19 + 4 * p + (full ? Math.sin(time * 22) * 1.2 : 0) + (aim.flash > 0 ? 5 * aim.flash / 0.3 : 0);
    ctx.fillStyle = p > 0 ? col : 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(kx, ky, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#12141c'; ctx.font = '900 14px Rubik, sans-serif';
    ctx.fillText(p > 0 ? (full ? 'MAX' : String(Math.round(p * 100))) : '', kx, ky + 1);
    const label = p <= 0 ? (len > 3 ? 'PULL BACK FURTHER' : '') : !can ? 'NO STAMINA' : '';
    if (label) {
      ctx.font = '900 12px Rubik, sans-serif';
      const ly = ky + (uy < -0.3 ? -r - 14 : r + 16);
      ctx.lineWidth = 4; ctx.strokeStyle = ink; ctx.strokeText(label, kx, ly);
      ctx.fillStyle = can || p <= 0 ? '#ffffff' : '#ff8a94'; ctx.fillText(label, kx, ly);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.globalAlpha = 1;
    World.draw(ctx, canvas.width, canvas.height, themeFrom, themeTo, themeT);
    camera();
    const th = theme();
    const shx = Save.data.settings.shake ? Math.sin(time * 71) * shake * 9 : 0, shy = Save.data.settings.shake ? Math.cos(time * 83) * shake * 7 : 0;
    ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * (view.ox + shx), dpr * (view.oy + shy));
    ItemArt.setScale(dpr * view.s);

    for (const z of zones) {
      if (z.kind !== 'hole') continue;
      const k = Math.min(1, z.t / 0.25) * (z.t > z.dur - 0.2 ? (z.dur - z.t) / 0.2 : 1);
      ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, '#7a3fe0', z.x, z.y, 260 * k, 0.5); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#12061f'; ctx.beginPath(); ctx.arc(z.x, z.y, 44 * k, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b98cff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) { const a = -time * 6 + i * TAU / 4; ctx.beginPath(); ctx.arc(z.x, z.y, (54 + i * 16) * k, a, a + 1.3); ctx.stroke(); }
    }
    for (const pl of plats) { if (pl.balloons) drawBalloons(pl); pl.draw(ctx, th, time); }
    drawWall(th);
    for (const c of crates) {
      const sw = Math.sin(c.t * 1.3 + c.ph) * 0.12;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(c.x, c.y - 18); ctx.lineTo(c.x, c.y - 44); ctx.stroke();
      ctx.fillStyle = c.col || '#ff9a3c'; ctx.beginPath(); ctx.ellipse(c.x, c.y - 66, 20, 24, 0, 0, TAU); ctx.fill();
      ctx.__tint = c.col || null; ItemArt.draw(ctx, 'crate', c.x, c.y, sw, 22, time); ctx.__tint = null;
    }
    for (const f of foes) f.rag.draw(ctx, time);
    for (const z of zones) {
      if (z.kind !== 'rope') continue;
      if (!z.nodes) continue;
      const n = z.nodes;
      ctx.globalAlpha = clamp(z.t / 0.2, 0, 1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const path = () => { ctx.beginPath(); ctx.moveTo(n[0].x, n[0].y); for (let k = 1; k < n.length - 1; k++) ctx.quadraticCurveTo(n[k].x, n[k].y, (n[k].x + n[k + 1].x) / 2, (n[k].y + n[k + 1].y) / 2); ctx.lineTo(n[n.length - 1].x, n[n.length - 1].y); };
      ctx.strokeStyle = '#8a5c2c'; ctx.lineWidth = 4; path(); ctx.stroke();                         // the body of the rope
      ctx.strokeStyle = '#d9a566'; ctx.lineWidth = 2.6; path(); ctx.stroke();
      ctx.setLineDash([2.2, 3.4]); ctx.strokeStyle = 'rgba(110,70,30,0.55)'; ctx.lineWidth = 3; path(); ctx.stroke(); ctx.setLineDash([]);   // the twist
      ctx.globalAlpha = 1;
    }
    player.rag.draw(ctx, time);
    for (const s of shots) {
      if (s.owner === 'e') { ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, '#ff3b4d', s.x, s.y, s.r * 2.6, 0.5 + 0.2 * Math.sin(time * 14)); ctx.globalCompositeOperation = 'source-over'; }
      else if (s.def.id === 'duck') { ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, '#ffd24a', s.x, s.y, s.r * 2.4, 0.5); ctx.globalCompositeOperation = 'source-over'; }
      ItemArt.draw(ctx, s.art, s.x, s.y, s.rot + (s.art === 'forks' ? Math.PI / 2 : 0), s.r, time);
    }
    Fx.draw(ctx, time);
    for (const f of foes) drawFoeUi(f);
    drawAimGuide();
    Fx.drawText(ctx);

    // screen space: the pull band, low-health vignette
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPull();
    const low = state === 'play' && !player.dead ? clamp(1 - player.hp / (player.maxHp * 0.35), 0, 1) * (0.5 + 0.2 * Math.sin(time * 6)) : 0;
    const v = Math.max(hurtFlash * 0.6, low * 0.5);
    if (v > 0.01) {
      const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
      g.addColorStop(0, 'rgba(226,67,75,0)'); g.addColorStop(1, `rgba(226,67,75,${v})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    }
    if (feverGlow > 0.01) {
      const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.42, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
      g.addColorStop(0, 'rgba(255,154,60,0)'); g.addColorStop(1, `rgba(255,154,60,${feverGlow * (0.26 + 0.08 * Math.sin(time * 9))})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    }
    if (run && run.stand > 0) {
      const beat = 0.5 + 0.5 * Math.sin(time * 9);
      const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.25, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
      g.addColorStop(0, 'rgba(20,4,8,0)'); g.addColorStop(1, `rgba(60,6,14,${0.55 + 0.2 * beat})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    }
    for (const c of coinFx) {
      if (c.t < 0) continue;
      const k = c.t / c.dur, e = k * k * (3 - 2 * k), u = 1 - e;
      const x = u * u * c.x0 + 2 * u * e * c.x1 + e * e * coinTarget.x, y = u * u * c.y0 + 2 * u * e * c.y1 + e * e * coinTarget.y;
      const r = 7 * (1 - 0.35 * e);
      ctx.fillStyle = '#ffc933'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff0a8'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.45, 0, TAU); ctx.fill();
    }
    if (healFlash > 0.01) {
      const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.4, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
      g.addColorStop(0, 'rgba(69,224,138,0)'); g.addColorStop(1, `rgba(69,224,138,${healFlash * 0.35})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    }
  }

  // where a world point sits on screen (for the tutorial pointer)
  const toScreen = (x, y) => ({ x: x * view.s + view.ox, y: y * view.s + view.oy });

  return {
    init, resize, update, render, start, toMenu, saveRun, setCine(o) { cine = o; }, setTheme(i) { themeFrom = themeTo = i; themeT = 1; }, pullMax() { return aim.max; }, skipTut: endTut, DUCK_COST, setMenuInset, aimStart, aimMove, aimEnd, aimCancel, setDuck, selectSlot, cycleSlot, pickPerk, toScreen, on,
    staCost, refreshBag() { if (player) { selectFirstSlot(); } },
    get state() { return state; }, get paused() { return paused; }, set paused(v) { paused = v; if (v) aimCancel(); },
    get hold() { return hold; }, get run() { return run; }, get player() { return player; }, get aiming() { return aim.on; },
    get itemId() { return currentItemId(); }, get usingBonus() { return usingBonus(); }, get staFlash() { return staFlash; }, get tutorial() { return !!(run && run.tut); }, get themeDark() { return theme().dark; },
    get foes() { return foes; }, get shots() { return shots; }, get crates() { return crates; }, get time() { return time; },
    get bag() { return bag(); }, get aimVis() { return aim.vis; },
    preview, endPreview, replayPreview() { demoT = Math.min(demoT, 0.7); }, get previewing() { return !!previewId; },
    bandColor,
    // the hotbar closes up gaps in the bag, so key 2 is always the second thing shown
    selectNth(n) { const b = bag(), idx = b.map((id, i) => (id ? i : -1)).filter(i => i >= 0); if (idx[n] != null) selectSlot(idx[n]); },
    get fever() { return run ? clamp(run.fever / FEVER_T, 0, 1) : 0; }, get stand() { return run && !player.dead ? clamp(run.stand / STAND_T, 0, 1) : 0; }, get feverEvery() { return FEVER_EVERY; },
    get coinPing() { return coinPing; }, setCoinTarget(x, y) { coinTarget = { x, y }; },
    _spawn: spawnFoe, _crate: spawnCrate, _gold: spawnGold, _bump: bump, __plats: () => plats,
  };
})();
