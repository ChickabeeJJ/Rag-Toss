'use strict';
/* =========================================================================
   UI: home, the stuff shop and bag, upgrades, missions, rank, settings,
   pause, perk picks, results, the HUD and the first-launch tutorial panel.
   A first-ever launch boots straight into the tutorial and a run; after that
   the game opens on the home screen.
   ========================================================================= */

const UI = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = name => `<span class="ic" data-icon="${name}"></span>`;
  let screen = 'home', modalOpen = false, modalKind = null, rotateDismissed = false;
  let shopSel = 'rock', shopTab = 'items', charSel = 'rookie', coachT = 0, coachKind = null, bannerT = 0;
  const cache = {};

  function init() {
    Icons.hydrate();
    applyUiScale();
    Sfx.setSfx(Save.data.settings.sfx); Sfx.setMusic(Save.data.settings.music);
    $('btnPlay').onclick = () => { click(); play(Save.data.run ? { resume: true } : {}); };
    $('btnNew').onclick = () => { click(); Save.clearRun(); play(); };
    $('btnShop').onclick = () => { click(); show('shop'); };
    document.querySelectorAll('#shopTabs [data-tab]').forEach(b => { b.onclick = () => { click(); shopTab = b.dataset.tab; renderShop(); }; });
    $('btnBag').onclick = () => { click(); show('shop'); };
    $('btnUpgrades').onclick = () => { click(); show('upgrades'); };
    $('btnMissions').onclick = () => { click(); openMissions(); };
    $('btnRank').onclick = () => { click(); openRank(); };
    $('btnSettings').onclick = () => { click(); openSettings(); };
    $('btnPause').onclick = () => { click(); openPause(); };
    $('btnRotateOk').onclick = () => { rotateDismissed = true; checkRotate(); };
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = () => { click(); show('home'); }; });
    $('modal').addEventListener('pointerdown', e => { if (e.target === $('modal') && ['missions', 'rank', 'settings'].includes(modalKind)) closeModal(); });
    const duck = $('btnDuck');
    const duckOn = e => { e.preventDefault(); Game.setDuck(true); duck.classList.add('on'); };
    const duckOff = () => { Game.setDuck(false); duck.classList.remove('on'); };
    duck.addEventListener('pointerdown', duckOn); duck.addEventListener('pointerup', duckOff); duck.addEventListener('pointercancel', duckOff); duck.addEventListener('pointerleave', duckOff);

    Game.on.over = openResults;
    Game.on.perk = openPerks;
    Game.on.banner = banner;
    Game.on.toast = (text, icon) => toast(text, icon, 4200);
    Game.on.tut = tutStep;
    $('tutSkip').onclick = () => { click(); Game.skipTut(); };
    Platform.onAuth(() => { Save.load(); if (screen === 'home') renderHome(); });

    // a brand-new player lands straight in the tutorial; everyone else gets the home screen
    if (!Save.data.tutDone) play({ tutorial: true }); else show('home');
    checkRotate();
  }

  function click() { Sfx.ensure(); Sfx.click(); }
  // menus and HUD scale up on large screens (1280x760 is the design size)
  function applyUiScale() {
    const k = clamp(Math.min(innerWidth / 1280, innerHeight / 760), 0.72, 1.75);
    document.documentElement.style.setProperty('--ui', k.toFixed(3));
  }
  function checkRotate() {
    const portrait = window.innerHeight > window.innerWidth * 1.1;
    const mobile = Platform.device() !== 'desktop';
    $('rotate').classList.toggle('hidden', !(portrait && mobile && !rotateDismissed));
  }
  function coins() { document.querySelectorAll('.coin-val').forEach(el => { el.textContent = fmt(Save.data.coins); }); }

  function show(id) {
    const from = screen;
    screen = id;
    for (const s of ['home', 'shop', 'upgrades']) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', id !== null);
    document.body.classList.toggle('playing', id === null);
    if (id !== null && Game.state !== 'menu') { Game.toMenu(); Platform.gameplayStop(); }
    if (id !== null) Game.refreshBag();
    if (id === 'home') renderHome();
    if (id === 'shop') renderShop();
    if (id === 'upgrades') renderUpgrades();
    if (id !== null && from === null) Sfx.stopMusic();
    coins();
    requestAnimationFrame(syncInset);
  }
  function syncInset() {
    const panel = document.querySelector('.home-panel');
    const r = panel.getBoundingClientRect();
    Game.setMenuInset(screen === 'home' ? r.right : 0);
  }

  function play(opts = {}) {
    closeModal(true);
    show(null);
    coachKind = null; $('coach').classList.add('hidden');
    Game.start(opts);
    Sfx.ensure(); Sfx.startMusic();
    Platform.gameplayStart();
    buildSlots(); cache.perks = null; cache.dots = null;
    $('bossBar').classList.add('hidden'); $('combo').classList.add('hidden');
    if (!opts.tutorial && !Save.data.seenSwap && Save.bagItems().length > 1) { coach('swap', 6); Save.data.seenSwap = true; Save.save(); }
  }

  /* ----------------------------------------------------------------- home */
  function bagRow(el, onTap, sel) {
    el.innerHTML = '';
    Save.data.bag.forEach((id, i) => {
      const b = document.createElement('button');
      b.className = 'slot' + (id ? '' : ' empty') + (sel === i ? ' sel' : '');
      b.innerHTML = `<kbd>${i + 1}</kbd>`;
      if (id) { b.prepend(ItemArt.iconEl(id, 46)); b.title = ITEM[id].name; }
      else b.insertAdjacentHTML('afterbegin', '<span class="plus">+</span>');
      b.onclick = () => onTap(i, id);
      el.appendChild(b);
    });
  }
  function renderHome() {
    const d = Save.data, b = d.best;
    const run = d.run;
    $('playTitle').textContent = run ? 'CONTINUE' : 'PLAY';
    $('playSub').textContent = run ? `STAGE ${run.stage} · ${run.kos} KNOCKOUTS` : b.kos > 0 ? `BEST ${b.kos} KNOCKOUTS · STAGE ${b.stage}` : 'HOW FAR CAN YOU GET?';
    $('btnNew').classList.toggle('hidden', !run);
    $('homeBest').textContent = 'BEST ' + b.kos;
    $('shopSub').textContent = `${d.items.length} / ${ITEMS.length} FOUND`;
    const lv = UPGRADES.reduce((a, u) => a + Save.lvl(u.id), 0), mx = UPGRADES.reduce((a, u) => a + u.max, 0);
    $('upSub').textContent = `${lv} / ${mx} LEVELS`;
    $('shopDot').classList.toggle('hidden', !ITEMS.some(i => !Save.owns(i.id) && d.coins >= i.price));
    $('upDot').classList.toggle('hidden', !UPGRADES.some(u => Save.lvl(u.id) < u.max && d.coins >= upgradeCost(u, Save.lvl(u.id))));
    $('missionDot').classList.toggle('hidden', !Save.missionsReady());
    bagRow($('homeBag'), () => { click(); show('shop'); });
    const r = Save.rankInfo();
    $('rankStrip').innerHTML = `<div class="rk-top"><b>${esc(r.cur.name.toUpperCase())}</b><span>${r.next ? `${r.kos} / ${r.next.kos} KOs` : 'TOP RANK'}</span></div><div class="rk-track"><i style="width:${(r.t * 100).toFixed(1)}%"></i></div>`;
    const touch = document.body.classList.contains('touch');
    $('homeHint').innerHTML = touch ? '<span>DRAG BACK AND LET GO TO THROW</span>' : '<span><kbd>DRAG</kbd> PULL BACK TO THROW</span><span><kbd>S</kbd> DUCK</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> SWAP</span><span><kbd>P</kbd> PAUSE</span>';
    coins();
  }

  /* ----------------------------------------------------------------- shop */
  // a standing preview of a character, drawn with the real ragdoll
  function charCanvas(c, size) {
    const dpr = Math.min(3, window.devicePixelRatio || 1), cv = document.createElement('canvas');
    cv.width = cv.height = Math.round(size * dpr); cv.style.width = cv.style.height = size + 'px';
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const r = new Rag({ x: 0, y: 0, facing: 1, isPlayer: true, body: c.body, shade: c.shade, accent: c.accent, hat: c.hat });
    r.aim = -0.3; r.snap();
    const k = size / 185; g.translate(size * 0.46, size * 0.93); g.scale(k, k); r.draw(g, 0.4);
    return cv;
  }
  function renderChars() {
    const d = Save.data, grid = $('shopGrid');
    if (!CHAR[charSel]) charSel = d.char;
    grid.innerHTML = '';
    for (const c of CHARACTERS) {
      const own = Save.ownsChar(c.id), b = document.createElement('button');
      b.className = 'item char' + (c.id === charSel ? ' sel' : '') + (own ? '' : ' locked');
      b.appendChild(charCanvas(c, 92));
      b.insertAdjacentHTML('beforeend', `<b>${esc(c.name)}</b>` + (d.char === c.id ? '<small class="eq">WEARING</small>' : own ? '<small class="own">OWNED</small>' : `<small class="${d.coins >= c.price ? '' : 'poor'}">${ic('coin')}${fmt(c.price)}</small>`));
      b.onclick = () => { click(); charSel = c.id; renderShop(); };
      grid.appendChild(b);
    }
    const c = CHAR[charSel], own = Save.ownsChar(c.id);
    const pv = $('shopPreview'); pv.innerHTML = ''; pv.appendChild(charCanvas(c, 210));
    let action;
    if (d.char === c.id) action = '<div class="note">YOU ARE THROWING AS THIS ONE</div>';
    else if (own) action = '<button class="btn primary" id="btnWear"><b>WEAR</b></button>';
    else if (d.coins >= c.price) action = `<button class="btn primary" id="btnWear"><b>BUY</b><small>${fmt(c.price)} COINS</small></button>`;
    else action = `<button class="btn" disabled><b>${fmt(c.price)} COINS</b><small>${fmt(c.price - d.coins)} MORE TO GO</small></button>`;
    $('shopInfo').innerHTML = `<div class="pv-head"><b>${esc(c.name.toUpperCase())}</b></div><p>Just a different look. It changes nothing about how you throw.</p>${action}`;
    const w = $('btnWear');
    if (w) w.onclick = () => {
      if (own) { Save.equipChar(c.id); Sfx.equip(); }
      else if (Save.buyChar(c.id)) { Sfx.buy(); toast(c.name.toUpperCase() + ' UNLOCKED', 'bag'); coins(); }
      else { Sfx.deny(); return; }
      renderShop();
    };
    Icons.hydrate($('shop'));
  }

  function renderShop() {
    const d = Save.data;
    document.querySelectorAll('#shopTabs [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === shopTab));
    $('shop').classList.toggle('chars', shopTab === 'chars');
    if (shopTab === 'chars') { renderChars(); return; }
    if (!ITEM[shopSel]) shopSel = 'rock';
    const grid = $('shopGrid');
    grid.innerHTML = '';
    for (const it of ITEMS) {
      const own = Save.owns(it.id), slot = d.bag.indexOf(it.id);
      const b = document.createElement('button');
      b.className = 'item' + (it.id === shopSel ? ' sel' : '') + (own ? '' : ' locked');
      b.appendChild(ItemArt.iconEl(it.id, 60));
      b.insertAdjacentHTML('beforeend', `<b>${esc(it.name)}</b>` + (slot >= 0 ? `<small class="eq">IN SLOT ${slot + 1}</small>` : own ? '<small class="own">OWNED</small>' : `<small class="${d.coins >= it.price ? '' : 'poor'}">${ic('coin')}${fmt(it.price)}</small>`));
      b.onclick = () => { click(); shopSel = it.id; renderShop(); };
      grid.appendChild(b);
    }
    const it = ITEM[shopSel], own = Save.owns(it.id);
    const pv = $('shopPreview'); pv.innerHTML = ''; pv.appendChild(ItemArt.iconEl(it.id, 150));
    const stat = (label, v) => `<span>${label}</span><i style="--v:${Math.round(clamp(v, 0.04, 1) * 100)}%"></i>`;
    let action;
    if (own) action = d.bag.includes(it.id) ? '<div class="note">IN YOUR BAG. TAP ANOTHER SLOT TO MOVE IT.</div>' : '<div class="note hi">TAP A BAG SLOT TO TAKE IT WITH YOU</div>';
    else if (d.coins >= it.price) action = `<button class="btn primary" id="btnBuy"><b>BUY</b><small>${fmt(it.price)} COINS</small></button>`;
    else action = `<button class="btn" disabled><b>${fmt(it.price)} COINS</b><small>${fmt(it.price - d.coins)} MORE TO GO</small></button>`;
    $('shopInfo').innerHTML = `<div class="pv-head"><b>${esc(it.name.toUpperCase())}</b><span class="tag">${esc(it.tag)}</span></div><p>${esc(it.desc)}</p>
      <div class="stats">${stat('DAMAGE', it.id === 'sack' ? 0.6 : (it.dmg * (it.multi || 1)) / 44)}${stat('SHOVE', it.id === 'plunger' ? 1 : it.kb / 3.2)}${stat('STAMINA', it.sta / 14)}</div>${action}`;
    const buy = $('btnBuy');
    if (buy) buy.onclick = () => {
      if (Save.buyItem(it.id)) { Sfx.buy(); toast(it.name.toUpperCase() + ' UNLOCKED', 'bag'); renderShop(); coins(); }
      else Sfx.deny();
    };
    bagRow($('shopBag'), (i, cur) => {
      if (own && cur !== it.id) { Save.equip(it.id, i); Sfx.equip(); }
      else if (cur && cur !== it.id) { click(); shopSel = cur; }
      else if (cur === it.id && Save.unequip(i)) Sfx.equip();
      else Sfx.deny();
      renderShop();
    }, d.bag.indexOf(it.id));
    $('bagHint').textContent = own ? 'TAP A SLOT TO PUT ' + it.name.toUpperCase() + ' THERE' : 'BUY IT FIRST, THEN TAP A SLOT';
    Icons.hydrate($('shop'));
    Game.refreshBag();
  }

  /* ------------------------------------------------------------- upgrades */
  function renderUpgrades() {
    const list = $('upList');
    list.innerHTML = '';
    for (const u of UPGRADES) {
      const l = Save.lvl(u.id), maxed = l >= u.max, cost = upgradeCost(u, l), can = Save.data.coins >= cost;
      const row = document.createElement('div');
      row.className = 'up card' + (maxed ? ' maxed' : '');
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
      row.innerHTML = `<span class="up-ic"><span class="ic">${Icons.line(u.id)}</span></span><div class="up-body"><b>${esc(u.name.toUpperCase())}</b><span>${l ? esc(u.text(l)) : esc(u.step.toUpperCase()) + ' PER LEVEL'}</span><div class="up-pips">${pips}</div></div>` +
        (maxed ? '<div class="up-max">MAX</div>' : `<button class="btn ${can ? 'primary' : ''}" ${can ? '' : 'disabled'}><b>${ic('coin')}${fmt(cost)}</b><small>${esc(u.step.toUpperCase())}</small></button>`);
      const btn = row.querySelector('button');
      if (btn) btn.onclick = () => { if (Save.buyUpgrade(u.id)) { Sfx.buy(); renderUpgrades(); coins(); } else Sfx.deny(); };
      list.appendChild(row);
    }
    Icons.hydrate(list);
  }

  /* --------------------------------------------------------------- modals */
  function openModal(kind, html) {
    modalOpen = true; modalKind = kind;
    $('sheet').className = 'sheet ' + kind;
    $('sheet').innerHTML = html;
    $('modal').classList.remove('hidden');
    document.body.classList.toggle('result-open', kind === 'results');
    Icons.hydrate($('sheet'));
    $('sheet').scrollTop = 0;
  }
  function closeModal(silent) {
    if (!modalOpen) return;
    modalOpen = false; modalKind = null;
    $('modal').classList.add('hidden');
    document.body.classList.remove('result-open');
    if (!silent && screen === 'home') renderHome();
  }
  const toggleRow = () => {
    const s = Save.data.settings;
    return `<div class="toggles">
      <button class="tog ${s.sfx ? 'on' : ''}" data-set="sfx">${ic('sound')}<b>SOUND</b></button>
      <button class="tog ${s.music ? 'on' : ''}" data-set="music">${ic('music')}<b>MUSIC</b></button>
      <button class="tog ${s.shake ? 'on' : ''}" data-set="shake">${ic('shake')}<b>SHAKE</b></button></div>`;
  };
  function wireToggles() {
    $('sheet').querySelectorAll('[data-set]').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.set, s = Save.data.settings;
        s[k] = !s[k]; Save.save();
        b.classList.toggle('on', s[k]);
        Sfx.setSfx(s.sfx); Sfx.setMusic(s.music); click();
      };
    });
  }

  function openPause() {
    if (screen !== null || modalOpen || Game.state !== 'play' || Game.hold) return;
    Game.paused = true; Platform.gameplayStop(); Save.save();
    const r = Game.run;
    const perks = Object.entries(r.perks).map(([id, n]) => `<span class="chip"><span class="ic">${Icons.perk(id)}</span>${esc(PERK[id].name.toUpperCase())}${n > 1 ? ' x' + n : ''}</span>`).join('');
    openModal('pause', `<h2>PAUSED</h2><div class="sub">STAGE ${r.stage} · ${r.kos} KNOCKOUTS</div>
      ${perks ? `<div class="chips">${perks}</div>` : ''}${toggleRow()}
      <div class="actions"><button class="btn primary wide" id="mResume"><b>RESUME</b></button>
      <button class="btn" id="mRestart">${ic('restart')}<b>RESTART</b></button><button class="btn" id="mHome">${ic('home')}<b>SAVE &amp; QUIT</b></button></div>`);
    wireToggles();
    $('mResume').onclick = () => { click(); resume(); };
    $('mRestart').onclick = () => { click(); Save.clearRun(); play({ tutorial: !Save.data.tutDone }); };
    $('mHome').onclick = () => { click(); Game.saveRun(); closeModal(true); show('home'); toast('RUN SAVED. CONTINUE ANY TIME.', 'check'); };
  }
  function resume() {
    if (modalKind !== 'pause') return;
    closeModal(true);
    Game.paused = false; Platform.gameplayStart();
  }

  function openSettings() {
    openModal('settings', `<h2>SETTINGS</h2>${toggleRow()}
      <div class="actions"><button class="btn primary wide" id="mDone"><b>DONE</b></button><button class="btn wide danger" id="mReset"><b>RESET PROGRESS</b></button></div>`);
    wireToggles();
    $('mDone').onclick = () => { click(); closeModal(); };
    let armed = false;
    $('mReset').onclick = () => {
      if (!armed) { armed = true; $('mReset').innerHTML = '<b>TAP AGAIN TO WIPE EVERYTHING</b>'; Sfx.deny(); return; }
      Save.reset(); Game.toMenu(); closeModal(); toast('PROGRESS RESET', 'restart');
    };
  }

  function openMissions() {
    Save.rollDaily();
    const d = Save.data.daily;
    const rows = d.list.map((m, i) => {
      const done = m.prog >= m.n;
      return `<div class="mis ${m.claimed ? 'claimed' : done ? 'done' : ''}"><div class="mis-body"><b>${esc(m.text.toUpperCase())}</b>
        <div class="bar-track"><i style="width:${(m.prog / m.n * 100).toFixed(0)}%"></i></div><span>${Math.min(m.prog, m.n)} / ${m.n}</span></div>
        ${m.claimed ? `<div class="mis-got">${ic('check')}</div>` : `<button class="btn small ${done ? 'primary' : ''}" data-claim="${i}" ${done ? '' : 'disabled'}><b>${ic('coin')}${m.reward}</b></button>`}</div>`;
    }).join('');
    const all = Save.allClaimed();
    openModal('missions', `<h2>DAILY MISSIONS</h2><div class="sub">NEW ONES EVERY DAY AT 00:00 UTC</div>${rows}
      <div class="mis bonus ${d.bonus ? 'claimed' : all ? 'done' : ''}"><div class="mis-body"><b>FINISH ALL THREE</b><span>BONUS CHEST</span></div>
      ${d.bonus ? `<div class="mis-got">${ic('check')}</div>` : `<button class="btn small ${all ? 'primary' : ''}" id="mBonus" ${all ? '' : 'disabled'}><b>${ic('coin')}250</b></button>`}</div>
      <div class="actions"><button class="btn wide" id="mDone"><b>CLOSE</b></button></div>`);
    $('sheet').querySelectorAll('[data-claim]').forEach(b => { b.onclick = () => { const n = Save.claimMission(+b.dataset.claim); if (n) { Sfx.buy(); toast('+' + n + ' COINS', 'coin'); openMissions(); coins(); } }; });
    if ($('mBonus')) $('mBonus').onclick = () => { const n = Save.claimBonus(); if (n) { Sfx.buy(); toast('+' + n + ' COINS', 'coin'); openMissions(); coins(); } };
    $('mDone').onclick = () => { click(); closeModal(); };
  }

  function openRank() {
    const r = Save.rankInfo(), b = Save.data.best, st = Save.data.stats;
    const rows = RANKS.map((k, i) => `<div class="rk ${i < r.i ? 'done' : i === r.i ? 'cur' : ''}"><b>${esc(k.name.toUpperCase())}</b><span>${k.kos} KOs</span><small>${k.pay ? ic('coin') + fmt(k.pay) : ''}</small></div>`).join('');
    openModal('rank', `<h2>${esc(r.cur.name.toUpperCase())}</h2><div class="sub">${r.next ? `${r.next.kos - r.kos} MORE KNOCKOUTS TO ${esc(r.next.name.toUpperCase())}` : 'NOBODY THROWS BETTER'}</div>
      <div class="bar-track big"><i style="width:${(r.t * 100).toFixed(1)}%"></i></div>
      <div class="res-grid"><div><b>${b.kos}</b><small>BEST RUN</small></div><div><b>${b.stage}</b><small>BEST STAGE</small></div><div><b>x${b.streak}</b><small>BEST STREAK</small></div><div><b>${fmt(st.kills)}</b><small>ALL KOs</small></div></div>
      <div class="rk-list">${rows}</div>
      <div class="actions"><button class="btn wide" id="mDone"><b>CLOSE</b></button></div>`);
    $('mDone').onclick = () => { click(); closeModal(); };
  }

  function openPerks(picks, stage) {
    Platform.gameplayStop();
    const r = Game.run;
    const cards = picks.map((p, i) => {
      const kind = PERK_KIND[p.kind] || PERK_KIND.offense, have = r.perks[p.id] || 0;
      const stack = have
        ? `<div class="pk-stack"><span>OWNED x${have}</span><i>›</i><b>x${have + 1}</b></div>`
        : '<div class="pk-stack new"><b>NEW</b></div>';
      return `<button class="perk" data-perk="${p.id}" style="--c:${kind.color};--i:${i}">
        <span class="pk-key"><kbd>${i + 1}</kbd></span>
        <span class="pk-kind">${kind.name}</span>
        <span class="pk-badge"><span class="pk-glow"></span><span class="pk-ic">${Icons.perk(p.id)}</span></span>
        <b class="pk-name">${esc(p.name.toUpperCase())}</b>
        <p class="pk-text">${esc(p.text)}</p>${stack}</button>`;
    }).join('');
    const owned = Object.entries(r.perks).map(([id, n]) => `<span class="pk-own" title="${esc(PERK[id].name)}">${Icons.perk(id)}${n > 1 ? `<b>${n}</b>` : ''}</span>`).join('');
    openModal('perks', `<div class="pk-head"><small>STAGE ${stage - 1} CLEARED</small><h2 class="win">BOSS DOWN</h2><div class="sub">CHOOSE A PERK. IT LASTS UNTIL YOU ARE KNOCKED OUT.</div></div>
      <div class="perk-row">${cards}</div>
      <div class="pk-foot"><span>NEXT: STAGE ${stage}</span>${owned ? `<div class="pk-owned"><em>YOUR PERKS</em>${owned}</div>` : ''}</div>`);
    let armed = false, chosen = false;
    setTimeout(() => { armed = true; }, 450);   // so a throw still held down can't pick one by accident
    const choose = el => {
      if (!armed || chosen) return;
      chosen = true; Sfx.perk();
      $('sheet').classList.add('picked'); el.classList.add('chosen');
      setTimeout(() => { closeModal(true); Game.pickPerk(el.dataset.perk); Platform.gameplayStart(); cache.perks = null; window.removeEventListener('keydown', keys); }, 380);
    };
    const keys = e => { const k = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code]; if (k != null) { const el = $('sheet').querySelectorAll('[data-perk]')[k]; if (el) { e.stopPropagation(); choose(el); } } };
    window.addEventListener('keydown', keys, true);
    $('sheet').querySelectorAll('[data-perk]').forEach(b => { b.onclick = () => choose(b); });
    Icons.hydrate($('sheet'));
  }

  function openResults(s) {
    Platform.gameplayStop(); Sfx.stopMusic();
    $('toasts').innerHTML = '';   // nothing left over from the run should sit on top of the sheet
    if (s.newBest) Sfx.record();
    const d = Save.data, r = Save.rankInfo();
    const next = Save.nextItem();
    const ups = UPGRADES.some(u => Save.lvl(u.id) < u.max && d.coins >= upgradeCost(u, Save.lvl(u.id)));
    const canItem = next && d.coins >= next.price;
    const rankUps = s.ranks.map(k => `<div class="rankup">${ic('trophy')}<b>RANK UP: ${esc(k.name.toUpperCase())}</b><span>+${fmt(k.pay)}</span></div>`).join('');
    let goal = '';
    if (next) {
      const t = clamp(d.coins / next.price, 0, 1);
      goal = `<div class="goal ${canItem ? 'ready' : ''}" id="mGoal"><div class="goal-ic"></div><div class="goal-body"><small>${canItem ? 'YOU CAN AFFORD' : 'SAVING UP FOR'}</small><b>${esc(next.name.toUpperCase())}</b>
        <div class="bar-track"><i style="width:${(t * 100).toFixed(0)}%"></i></div></div><span>${canItem ? 'GET IT' : fmt(next.price - d.coins) + ' TO GO'}</span></div>`;
    }
    openModal('results', `<h2 class="lose">KNOCKED OUT</h2><div class="sub">STAGE ${s.stage} · ${esc(THEMES[(s.stage - 1) % THEMES.length].name.toUpperCase())}</div>
      <div class="res-score"><span>KNOCKOUTS${s.newBest ? ' <em class="new">NEW BEST</em>' : ''}</span><b>${s.kos}</b></div>
      <div class="res-grid"><div><b>x${s.combo}</b><small>BEST STREAK</small></div><div><b>${s.heads}</b><small>HEADSHOTS</small></div><div><b>${s.rings}</b><small>RING-OUTS</small></div><div><b>${s.bosses}</b><small>BOSSES</small></div></div>
      <div class="coins-gain">${ic('coin')}+${fmt(s.coins)}</div>${rankUps}
      <div class="rank-strip in-sheet"><div class="rk-top"><b>${esc(r.cur.name.toUpperCase())}</b><span>${r.next ? `${r.kos} / ${r.next.kos} KOs` : 'TOP RANK'}</span></div><div class="rk-track"><i style="width:${(r.t * 100).toFixed(1)}%"></i></div></div>
      ${goal}
      <div class="actions"><button class="btn primary wide big" id="mRetry">${ic('restart')}<span class="bt"><b>AGAIN</b></span></button>
      <button class="btn" id="mUp">${ic('up')}<b>UPGRADES</b>${ups ? '<i class="dot"></i>' : ''}</button><button class="btn" id="mHome">${ic('home')}<b>HOME</b></button></div>`);
    if (next) { $('sheet').querySelector('.goal-ic').appendChild(ItemArt.iconEl(next.id, 44)); $('mGoal').onclick = () => { click(); shopSel = next.id; closeModal(true); show('shop'); }; }
    let armed = false;
    setTimeout(() => { armed = true; }, 450);
    $('mRetry').onclick = () => { if (!armed) return; click(); play(); };
    $('mUp').onclick = () => { click(); closeModal(true); show('upgrades'); };
    $('mHome').onclick = () => { click(); closeModal(true); show('home'); };
  }

  /* ------------------------------------------------------------------ hud */
  function buildSlots() {
    const el = $('slots');
    el.innerHTML = '';
    Save.data.bag.forEach((id, i) => {
      if (!id) return;
      const b = document.createElement('button');
      b.className = 'hslot'; b.dataset.i = i;
      b.appendChild(ItemArt.iconEl(id, 44));
      b.insertAdjacentHTML('beforeend', `<kbd>${i + 1}</kbd><small>${ic('bolt')}<span>${Math.round(Game.staCost(ITEM[id]))}</span></small>`);
      b.addEventListener('pointerdown', e => { e.stopPropagation(); Game.selectSlot(i); });
      el.appendChild(b);
    });
    // a temporary weapon from a crate always sits at the right-hand end of the row
    el.insertAdjacentHTML('beforeend', '<button class="hslot bonus hidden" id="slotBonus"><span class="hs-ic"></span><kbd>4</kbd><b id="bonusN">3</b><small>FREE</small></button>');
    $('slotBonus').addEventListener('pointerdown', e => { e.stopPropagation(); Game.selectSlot(3); });
    Icons.hydrate(el);
    cache.slot = null; cache.bonus = undefined;
  }
  function set(key, val, fn) { if (cache[key] !== val) { cache[key] = val; fn(val); } }

  function banner(text, sub, boss) {
    const el = $('banner');
    $('bannerText').textContent = text; $('bannerSub').textContent = sub || '';
    el.classList.remove('hidden'); el.classList.toggle('boss', !!boss);
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    bannerT = 2.2;
  }
  // the coach panel: the tutorial's four steps, and the one-off slot hint
  const touchy = () => document.body.classList.contains('touch');
  const TUT = [
    () => [touchy() ? 'DRAG BACK ANYWHERE, THEN LET GO' : 'CLICK, DRAG BACK, THEN LET GO', 'HIT THE RED ONE', '<div class="pull"><i></i><u></u></div>'],
    () => ['KNOCK IT OUT', 'A HEADSHOT HITS TWICE AS HARD', ''],
    () => [touchy() ? 'HOLD DUCK WHEN THEY THROW' : 'HOLD S WHEN THEY THROW', 'DUCKING COSTS ' + Game.DUCK_COST + ' STAMINA', touchy() ? '' : '<kbd class="big">S</kbd>'],
    () => ['NOW KNOCK THIS ONE OUT', 'YOU CAN HIT THEIR THROWS OUT OF THE AIR TOO', ''],
  ];
  function setCoach(text, sub, vis, dots, skip) {
    $('coachText').textContent = text; $('coachSub').textContent = sub || ''; $('coachVis').innerHTML = vis || '';
    $('tutDots').innerHTML = dots; $('tutDots').classList.toggle('hidden', !dots); $('tutSkip').classList.toggle('hidden', !skip);
    const el = $('coach');
    el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  }
  function tutStep(n) {
    if (n < 0) { coachKind = null; $('coach').classList.add('hidden'); return; }
    const [text, sub, vis] = TUT[n]();
    coachKind = 'tut';
    setCoach(text, sub, vis, TUT.map((_, i) => `<i class="${i < n ? 'done' : i === n ? 'cur' : ''}"></i>`).join(''), true);
  }
  function coach(kind, secs) {
    coachKind = kind; coachT = secs;
    setCoach(touchy() ? 'TAP A SLOT TO SWAP WHAT YOU THROW' : 'PRESS 1 2 3 TO SWAP WHAT YOU THROW', '', touchy() ? '' : '<kbd class="big">1</kbd><kbd class="big">2</kbd><kbd class="big">3</kbd>', '', false);
  }

  function tick(dt) {
    if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.add('hidden');
    if (screen !== null) return;
    const p = Game.player, r = Game.run;
    if (!p || !r) return;
    if (coachKind) {
      if (coachKind !== 'tut' && !Game.paused && (coachT -= dt) <= 0) { coachKind = null; $('coach').classList.add('hidden'); }
    }
    set('kos', r.kos, v => { $('hudKos').textContent = v; const m = $('hudMid'); m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); });
    set('coins', Save.data.coins, v => { $('hudCoins').textContent = fmt(v); });
    set('stage', r.stage, v => { $('chipNum').textContent = v; $('chipTitle').textContent = THEMES[(v - 1) % THEMES.length].name.toUpperCase(); });
    const dotsKey = r.stage + ':' + r.stageKills + ':' + (r.boss ? 1 : 0);
    set('dots', dotsKey, () => {
      $('stageDots').innerHTML = Array.from({ length: STAGE_KILLS }, (_, i) => `<i class="${i < r.stageKills ? 'done' : i === r.stageKills ? 'cur' : ''}"></i>`).join('');
      $('bossIc').classList.toggle('on', r.stageKills >= STAGE_KILLS);
    });
    set('dark', Game.themeDark, v => document.body.classList.toggle('dark-sky', v));
    // vitals
    set('hp', Math.ceil(p.hp), v => { $('hpNum').textContent = Math.max(0, v); });
    $('hpFill').style.transform = `scaleX(${clamp(p.hp / p.maxHp, 0, 1).toFixed(3)})`;
    set('hpLow', p.hp < p.maxHp * 0.3, v => $('vitals').classList.toggle('low', v));
    set('sta', Math.floor(p.sta), v => { $('staNum').textContent = v; });
    $('staFill').style.transform = `scaleX(${clamp(p.sta / p.maxSta, 0, 1).toFixed(3)})`;
    const id = Game.itemId, cost = Game.usingBonus ? 0 : Game.staCost(ITEM[id]);
    set('staLow', p.sta < cost, v => $('staRow').classList.toggle('short', v));
    set('staFlash', Game.staFlash > 0, v => $('staRow').classList.toggle('flash', v));
    // slots
    const slotKey = Game.usingBonus ? 'b' : p.slot;
    set('slot', slotKey, v => { $('slots').querySelectorAll('.hslot').forEach(b => b.classList.toggle('active', b.classList.contains('bonus') ? v === 'b' : +b.dataset.i === v)); });
    const bonusKey = p.bonus ? p.bonus.id + p.bonus.n : '';
    set('bonus', bonusKey, () => {
      const el = $('slotBonus');
      el.classList.toggle('hidden', !p.bonus);
      if (p.bonus) { const h = el.querySelector('.hs-ic'); h.innerHTML = ''; h.appendChild(ItemArt.iconEl(p.bonus.id, 44)); $('bonusN').textContent = 'x' + p.bonus.n; }
    });
    // streak
    set('combo', r.combo, v => {
      const el = $('combo');
      el.classList.toggle('hidden', v < 2);
      if (v >= 2) { $('comboNum').textContent = 'x' + v; $('comboBonus').textContent = '+' + Math.min(v, 10) * 10 + '% COINS'; const n = $('comboNum'); n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; }
    });
    // boss
    const boss = r.boss && r.boss.rag.alive ? r.boss : null;
    set('boss', boss ? boss.name : '', v => { $('bossBar').classList.toggle('hidden', !v); if (v) $('bossName').textContent = v; });
    if (boss) $('bossFill').style.transform = `scaleX(${clamp(boss.hp / boss.maxHp, 0, 1).toFixed(3)})`;
    const pkKey = Object.entries(r.perks).map(([k, n]) => k + n).join(',');
    set('perks', pkKey, () => { $('perkRow').innerHTML = Object.entries(r.perks).map(([k, n]) => `<span title="${esc(PERK[k].name)}">${Icons.perk(k)}${n > 1 ? `<b>${n}</b>` : ''}</span>`).join(''); });
  }

  function toast(text, icon = 'check', ms = 2400) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${ic(icon)}<span>${esc(text)}</span>`;
    $('toasts').appendChild(el);
    Icons.hydrate(el);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 420); }, ms);
  }

  return {
    init, tick, show, play, openPause, resume, toast, checkRotate, closeModal, applyUiScale, syncInset,
    get screen() { return screen; }, modalOpen: () => modalOpen, get modalKind() { return modalKind; },
  };
})();
