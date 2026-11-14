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
    Sfx.setSfx(Save.data.settings.sfx); Sfx.setMusic(Save.data.settings.music); Theme.set(Save.data.settings.accent); Sfx.setSfxVol(Save.data.settings.sfxVol); Sfx.setMusicVol(Save.data.settings.musicVol);
    $('btnPlay').onclick = () => { click(); play(Save.data.run ? { resume: true } : {}); };
    $('btnNew').onclick = () => { click(); Save.clearRun(); play(); };
    $('btnShop').onclick = () => { click(); show('shop'); };
    document.querySelectorAll('#shopTabs [data-tab]').forEach(b => { b.onclick = () => { click(); shopTab = b.dataset.tab; renderShop(); }; });
    $('btnBag').onclick = () => { click(); openLoadout(); };
    $('btnUpgrades').onclick = () => { click(); show('upgrades'); };
    $('btnMissions').onclick = () => { click(); openMissions(); };
    $('btnRank').onclick = () => { click(); openRank(); };
    $('btnSettings').onclick = () => { click(); openSettings(); };
    $('btnPause').onclick = () => { click(); openPause(); };
    $('pvBack').onclick = () => { click(); closePreview(); };
    $('pvAgain').onclick = () => { click(); Game.replayPreview(); };
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
    for (const s of ['home', 'shop', 'upgrades', 'loadout']) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', id !== null);
    document.body.classList.toggle('playing', id === null);
    if (id !== null && Game.state !== 'menu') { Game.toMenu(); Platform.gameplayStop(); }
    if (id !== null) Game.refreshBag();
    if (id === 'home') renderHome();
    if (id === 'shop') { renderShop(); $('shopGrid').classList.add('intro'); }
    if (id === 'upgrades') { renderUpgrades(); $('upList').classList.add('intro'); }
    if (id === 'loadout') renderLoadout();
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
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // PLAY must not keep the keyboard
    coachKind = null; $('coach').classList.add('hidden');
    Game.start(opts);
    Sfx.ensure(); Sfx.startMusic();
    Platform.gameplayStart();
    buildSlots(); cache.perks = null; cache.bounty = null; shownCoins = null; targetT = 0;
    $('fever').classList.add('hidden'); $('stand').classList.add('hidden'); $('bounty').classList.add('hidden'); document.body.classList.remove('frenzy');
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
    bagRow($('homeBag'), i => { click(); openLoadout(i); });
    const r = Save.rankInfo();
    $('rankStrip').innerHTML = `<div class="rk-top"><b>${esc(r.cur.name.toUpperCase())}</b><span>${r.next ? `${r.kos} / ${r.next.kos} KOs` : 'TOP RANK'}</span></div><div class="rk-track"><i style="width:${(r.t * 100).toFixed(1)}%"></i></div>`;
    const touch = document.body.classList.contains('touch');
    $('homeHint').innerHTML = touch ? '<span>DRAG BACK AND LET GO TO THROW</span>' : '<span><kbd>DRAG</kbd> PULL BACK TO THROW</span><span><kbd>S</kbd> DUCK</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> SWAP</span><span><kbd>P</kbd> PAUSE</span>';
    coins();
  }

  /* -------------------------------------------------------------- sliders
     One look for every slider: a groove with a glowing fill, a round white handle with a ring in the
     accent colour, tick marks and a little value bubble that rises while you hold it. */
  function slider(id, o) {
    const p = (o.value - o.min) / (o.max - o.min);
    return `<div class="slider ${o.cls || ''}" data-slider="${id}" style="--p:${(p * 100).toFixed(2)}%;--n:${p.toFixed(4)}${o.thumb ? ';--thumb:' + o.thumb : ''}">
      <span class="sl-glow"></span><span class="sl-ticks"><i></i><i></i><i></i><i></i><i></i></span>
      <input type="range" id="${id}" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${o.value}" aria-label="${esc(o.label || id)}">
      <b class="sl-val">${esc(o.text ? o.text(o.value) : o.value)}</b></div>`;
  }
  function wireSlider(root, id, o, onInput) {
    const el = root.querySelector(`[data-slider="${id}"]`), inp = el.querySelector('input'), val = el.querySelector('.sl-val');
    const sync = () => {
      const v = +inp.value, p = (v - o.min) / (o.max - o.min);
      el.style.setProperty('--p', (p * 100).toFixed(2) + '%'); el.style.setProperty('--n', p.toFixed(4));
      val.textContent = o.text ? o.text(v) : v;
      return v;
    };
    inp.addEventListener('input', () => { const v = sync(); onInput(v, el); });
    const hold = on => () => el.classList.toggle('held', on);
    inp.addEventListener('pointerdown', hold(true)); window.addEventListener('pointerup', hold(false)); inp.addEventListener('blur', hold(false));
    sync();
    return el;
  }
  /* -------------------------------------------------------------- preview
     Any throwable, bought or not, can be tried on a pair of foes that take it and never hit back. */
  let previewFrom = null;
  function openPreview(id) {
    previewFrom = screen;
    const it = ITEM[id];
    $('pvName').textContent = it.name.toUpperCase(); $('pvTag').textContent = it.tag; $('pvDesc').textContent = it.desc;
    $(previewFrom).classList.add('hidden');
    $('preview').classList.remove('hidden');
    Game.setMenuInset(0);
    Game.preview(id);
  }
  function closePreview() {
    $('preview').classList.add('hidden');
    Game.endPreview();
    const back = previewFrom || 'shop'; previewFrom = null;
    show(back);
  }

  /* -------------------------------------------------------------- loadout */
  let loSlot = 0, loLook = null;
  function openLoadout(slot) {
    const bag = Save.data.bag;
    loSlot = slot != null ? slot : Math.max(0, bag.indexOf(null) >= 0 ? bag.indexOf(null) : 0);
    loLook = bag[loSlot] || bag.find(Boolean) || 'rock';
    show('loadout');
  }
  const itemMeters = it => {
    const m = (label, v) => `<span>${label}</span><i class="meter" style="--v:${Math.round(clamp(v, 0.05, 1) * 100)}%"></i>`;
    return `<div class="stats lo-stats">${m('DAMAGE', it.id === 'sack' ? 0.6 : (it.dmg * (it.multi || 1)) / 44)}${m('SHOVE', it.id === 'plunger' ? 1 : it.kb / 3.2)}${m('STAMINA', it.sta / 14)}</div>`;
  };
  function renderLoadout() {
    const d = Save.data, bag = d.bag, root = $('loRoot');
    if (!ITEM[loLook]) loLook = 'rock';
    const only = bag.filter(Boolean).length <= 1, look = ITEM[loLook], lookOwn = Save.owns(look.id), lookSlot = bag.indexOf(look.id);
    const stars = id => { const m = Save.masteryInfo(id); return '★'.repeat(m.lvl) + '<u>' + '★'.repeat(MASTERY.length - m.lvl) + '</u>'; };
    const slots = bag.map((id, i) => {
      const cls = 'lo-slot' + (i === loSlot ? ' sel' : '') + (id ? '' : ' empty');
      return id
        ? `<button class="${cls}" data-slot="${i}"><kbd>${i + 1}</kbd><span class="lo-art" data-art="${id}"></span><b>${esc(ITEM[id].name)}</b><small>${ic('bolt')}${Math.round(ITEM[id].sta)} <em>${stars(id)}</em></small>${only ? '' : `<span class="lo-x" data-clear="${i}" title="Take out" role="button" aria-label="Take ${esc(ITEM[id].name)} out">${ic('close')}</span>`}</button>`
        : `<button class="${cls}" data-slot="${i}"><kbd>${i + 1}</kbd><span class="lo-plus">+</span><b>EMPTY</b><small>TAP A THROWABLE</small></button>`;
    }).join('');
    const mi = Save.masteryInfo(look.id);
    let act;
    if (!lookOwn) act = d.coins >= look.price ? `<button class="btn primary wide" id="loShop"><b>BUY IT IN THE SHOP</b><small>${fmt(look.price)} COINS</small></button>` : `<button class="btn wide" id="loShop"><b>${fmt(look.price)} COINS</b><small>${fmt(look.price - d.coins)} MORE TO GO · SEE IT IN THE SHOP</small></button>`;
    else if (lookSlot === loSlot) act = `<div class="note">IN SLOT ${loSlot + 1} RIGHT NOW</div>`;
    else act = `<button class="btn primary wide" id="loPut"><b>${lookSlot >= 0 ? 'SWAP INTO' : 'PUT IN'} SLOT ${loSlot + 1}</b></button>`;
    const items = [...ITEMS.filter(i => Save.owns(i.id)), ...ITEMS.filter(i => !Save.owns(i.id))].map(it => {
      const own = Save.owns(it.id), sl = bag.indexOf(it.id);
      return `<button class="lo-item${own ? '' : ' locked'}${sl >= 0 ? ' inbag' : ''}${it.id === loLook ? ' look' : ''}${sl === loSlot ? ' here' : ''}" data-item="${it.id}">
        ${sl >= 0 ? `<i class="bagtag">${sl + 1}</i>` : ''}<span class="lo-art" data-art="${it.id}"></span><b>${esc(it.name)}</b>${own ? (sl >= 0 ? '<small class="eq">IN BAG</small>' : '') : `<small class="${d.coins >= it.price ? '' : 'poor'}">${ic('coin')}${fmt(it.price)}</small>`}</button>`;
    }).join('');
    root.innerHTML = `<div class="lo-side card">
        <div class="lo-label"><b>YOUR BAG</b><span>SLOT ${loSlot + 1} IS SELECTED</span></div>
        <div class="lo-slots">${slots}</div>
        <div class="lo-help">${bag.some(Boolean) ? `TAP A THROWABLE TO PUT IT IN <b>SLOT ${loSlot + 1}</b>. TAP A SLOT TO CHOOSE WHERE IT GOES.` : ''}</div>
        <div class="lo-detail"><div class="lo-big" data-art="${look.id}"></div>
          <div class="lo-info"><div class="pv-head"><b>${esc(look.name.toUpperCase())}</b><span class="tag">${esc(look.tag)}</span></div><p>${esc(look.desc)}</p></div></div>
        ${itemMeters(look)}
        ${lookOwn ? `<div class="mastery"><div class="rk-top"><b>MASTERY <i>${stars(look.id).replace(/<\/?u>/g, '')}</i></b><span>${mi.next ? mi.kills + ' / ' + mi.next + ' KOs' : 'MAXED'}${mi.lvl ? ' · +' + mi.lvl * 5 + '% DMG' : ''}</span></div><div class="rk-track"><i style="width:${(mi.t * 100).toFixed(1)}%"></i></div></div>` : ''}
        <button class="btn wide pvbtn" id="loPreview">${ic('play')}<b>PREVIEW IT</b></button>
        ${act}
        <div class="actions"><button class="btn primary wide" id="loDone"><b>DONE</b></button></div>
      </div>
      <div class="lo-main card"><div class="lo-label"><b>THROWABLES</b><span>${d.items.length} / ${ITEMS.length} OWNED</span></div><div class="lo-grid">${items}</div></div>`;
    root.querySelectorAll('[data-art]').forEach(el => { el.appendChild(ItemArt.iconEl(el.dataset.art, el.classList.contains('lo-big') ? 96 : 54)); });
    root.querySelectorAll('[data-slot]').forEach(b => { b.onclick = e => {
      const x = e.target.closest('[data-clear]');
      if (x) { e.stopPropagation(); if (Save.unequip(+x.dataset.clear)) { Sfx.equip(); Game.refreshBag(); loSlot = +x.dataset.clear; } else Sfx.deny(); renderLoadout(); return; }
      click(); loSlot = +b.dataset.slot; if (bag[loSlot]) loLook = bag[loSlot]; renderLoadout();
    }; });
    const put = id => {
      const own = Save.owns(id), cur = bag.indexOf(id);
      if (!own || cur === loSlot) { click(); loLook = id; renderLoadout(); return; }
      Save.equip(id, loSlot); Sfx.equip(); Game.refreshBag(); loLook = id;
      const nx = [0, 1, 2].find(i => i !== loSlot && !Save.data.bag[i]);          // on to the next empty slot, if there is one
      const placed = loSlot; if (nx != null) loSlot = nx;
      renderLoadout();
      const el = root.querySelector(`[data-slot="${placed}"]`); if (el) { el.classList.add('landed'); setTimeout(() => el.classList.remove('landed'), 420); }
    };
    root.querySelectorAll('[data-item]').forEach(b => { b.onclick = () => put(b.dataset.item); });
    $('loPreview').onclick = () => { click(); openPreview(look.id); };
    const lp = $('loPut'); if (lp) lp.onclick = () => put(look.id);
    const ls = $('loShop'); if (ls) ls.onclick = () => { click(); shopTab = 'items'; shopSel = look.id; show('shop'); };
    $('loDone').onclick = () => { click(); show('home'); };
    Icons.hydrate(root);
    coins();
  }

  /* ---------------------------------------------------------- headband */
  function bandPanel() {
    const cur = Save.data.band, rk = Save.rankInfo().i;
    const sw = BANDS.map((h, i) => {
      const open = i <= rk;
      return `<button class="sw sm${h === 'prismatic' ? ' prism' : ''}${cur === h && open ? ' on' : ''}${open ? '' : ' locked'}" data-band="${h}" data-need="${i}" style="--s:${h === 'prismatic' ? '#fff' : h}" aria-label="${h === 'prismatic' ? 'Prismatic' : h}">${open ? '' : ic('lock')}</button>`;
    }).join('');
    const next = BANDS.findIndex((h, i) => i > rk);
    return `<div class="band"><div class="set-label">HEADBAND COLOUR</div><div class="swatches">${sw}</div>
      <div class="band-note">${next < 0 ? 'EVERY COLOUR UNLOCKED. PRISMATIC SLOWLY SHIFTS COLOUR AS YOU PLAY.' : `NEXT COLOUR AT <b>${esc(RANKS[next].name.toUpperCase())}</b>${next === BANDS.length - 1 ? ' (PRISMATIC)' : ''}`}</div></div>`;
  }
  function wireBand(root) {
    root.querySelectorAll('[data-band]').forEach(b => { b.onclick = () => {
      if (b.classList.contains('locked')) { Sfx.deny(); toast('UNLOCKS AT ' + RANKS[+b.dataset.need].name.toUpperCase(), 'lock'); return; }
      click(); Save.data.band = b.dataset.band; Save.save(); refreshRookie();
      root.querySelectorAll('[data-band]').forEach(o => o.classList.toggle('on', o === b));
    }; });
  }
  // redraw only the Rookie's pictures while a colour is being dragged, so the slider itself is never rebuilt
  function refreshRookie() {
    const pv = $('shopPreview');
    if (charSel === 'rookie' && pv) { const old = pv.querySelector('canvas'); const nw = charCanvas(CHAR.rookie, 210); if (old) old.replaceWith(nw); else pv.appendChild(nw); }
    const tile = $('shopGrid').querySelector('.item.char canvas'); if (tile) tile.replaceWith(charCanvas(CHAR.rookie, 92));
  }

  /* ----------------------------------------------------------------- shop */
  // a standing preview of a character, drawn with the real ragdoll
  function charCanvas(c, size) {
    const dpr = Math.min(3, window.devicePixelRatio || 1), cv = document.createElement('canvas');
    cv.width = cv.height = Math.round(size * dpr); cv.style.width = cv.style.height = size + 'px';
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const r = new Rag({ x: 0, y: 0, facing: 1, isPlayer: true, body: c.body, shade: c.shade, accent: c.accent || Game.bandColor(performance.now() / 1000), hat: c.hat });
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
    $('shopInfo').innerHTML = `<div class="pv-head"><b>${esc(c.name.toUpperCase())}</b></div><p>Just a different look. It changes nothing about how you throw.</p>${action}${c.id === 'rookie' ? bandPanel() : ''}`;
    if (c.id === 'rookie') { Icons.hydrate($('shopInfo')); wireBand($('shopInfo')); }
    const w = $('btnWear');
    if (w) w.onclick = () => {
      if (own) { Save.equipChar(c.id); Sfx.equip(); }
      else if (Save.buyChar(c.id)) { Sfx.buy(); toast(c.name.toUpperCase() + ' UNLOCKED', 'bag'); coins(); }
      else { Sfx.deny(); return; }
      renderShop();
    };
    Icons.hydrate($('shop'));
  }

  // put an owned item in the first free slot, or take it out if it is already in the bag
  function toggleBag(id) {
    const d = Save.data, slot = d.bag.indexOf(id), free = d.bag.indexOf(null);
    if (slot >= 0) { if (Save.unequip(slot)) Sfx.equip(); else Sfx.deny(); }
    else if (free >= 0 && Save.equip(id, free)) Sfx.equip();
    else Sfx.deny();
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
      b.className = 'item' + (it.id === shopSel ? ' sel' : '') + (own ? '' : ' locked') + (slot >= 0 ? ' inbag' : '');
      b.appendChild(ItemArt.iconEl(it.id, 60));
      b.insertAdjacentHTML('beforeend', `<b>${esc(it.name)}</b>` + (slot >= 0 ? `<i class="bagtag">${slot + 1}</i><small class="eq">IN BAG</small>` : own ? '<small class="own">OWNED</small>' : `<small class="${d.coins >= it.price ? '' : 'poor'}">${ic('coin')}${fmt(it.price)}</small>`));
      // tap to look at it; tap it again to put it in the bag or take it out
      b.onclick = () => { if (it.id === shopSel && own) toggleBag(it.id); else { click(); shopSel = it.id; } renderShop(); };
      grid.appendChild(b);
    }
    grid.classList.remove('intro');
    const it = ITEM[shopSel], own = Save.owns(it.id);
    const inBag = d.bag.includes(it.id), full = !d.bag.includes(null), only = d.bag.filter(Boolean).length <= 1;
    const pv = $('shopPreview'); pv.innerHTML = ''; pv.appendChild(ItemArt.iconEl(it.id, 150));
    const stat = (label, v) => `<span>${label}</span><i style="--v:${Math.round(clamp(v, 0.04, 1) * 100)}%"></i>`;
    let action;
    if (own && inBag) action = only ? '<div class="note">IN YOUR BAG. YOU NEED AT LEAST ONE THING TO THROW.</div>' : '<button class="btn" id="btnEq"><b>TAKE OUT OF BAG</b></button>';
    else if (own) action = full ? '<div class="note hi">BAG FULL. TAP A SLOT ABOVE TO SWAP IT IN.</div>' : '<button class="btn primary" id="btnEq"><b>ADD TO BAG</b></button>';
    else if (d.coins >= it.price) action = `<button class="btn primary" id="btnBuy"><b>BUY</b><small>${fmt(it.price)} COINS</small></button>`;
    else action = `<button class="btn" disabled><b>${fmt(it.price)} COINS</b><small>${fmt(it.price - d.coins)} MORE TO GO</small></button>`;
    $('shopInfo').innerHTML = `<div class="pv-head"><b>${esc(it.name.toUpperCase())}</b><span class="tag">${esc(it.tag)}</span></div><p>${esc(it.desc)}</p><button class="btn wide pvbtn" id="btnPreview">${ic('play')}<b>PREVIEW IT</b></button>
      ${own ? (m => `<div class="mastery"><div class="rk-top"><b>MASTERY <i>${'\u2605'.repeat(m.lvl)}${'\u2606'.repeat(MASTERY.length - m.lvl)}</i></b><span>${m.next ? m.kills + ' / ' + m.next + ' KOs' : 'MAXED'}${m.lvl ? ' · +' + m.lvl * 5 + '% DMG' : ''}</span></div><div class="rk-track"><i style="width:${(m.t * 100).toFixed(1)}%"></i></div></div>`)(Save.masteryInfo(it.id)) : ''}
      <div class="stats">${stat('DAMAGE', it.id === 'sack' ? 0.6 : (it.dmg * (it.multi || 1)) / 44)}${stat('SHOVE', it.id === 'plunger' ? 1 : it.kb / 3.2)}${stat('STAMINA', it.sta / 14)}</div>${action}`;
    $('btnPreview').onclick = () => { click(); openPreview(it.id); };
    const eq = $('btnEq');
    if (eq) eq.onclick = () => { toggleBag(it.id); renderShop(); };
    $('shopBag').classList.toggle('swap', own && !inBag && full);
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
    $('bagHint').textContent = (Save.data.run ? 'FOR YOUR NEXT NEW RUN. ' : '') + !own ? 'BUY IT TO ADD IT TO YOUR BAG' : inBag ? (only ? 'THIS IS WHAT YOU THROW' : 'TAP ITS SLOT TO TAKE IT OUT') : full ? 'BAG FULL: TAP A SLOT TO SWAP ' + it.name.toUpperCase() + ' IN' : 'TAP ADD TO BAG, OR PICK A SLOT';
    Icons.hydrate($('shop'));
    Game.refreshBag();
  }

  /* ------------------------------------------------------------- upgrades */
  function renderUpgrades() {
    $('upList').classList.remove('intro');
    const list = $('upList');
    list.innerHTML = '';
    for (const u of UPGRADES) {
      const l = Save.lvl(u.id), maxed = l >= u.max, cost = upgradeCost(u, l), can = Save.data.coins >= cost;
      const row = document.createElement('div');
      row.className = 'up card' + (maxed ? ' maxed' : '');
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
      row.innerHTML = `<span class="up-ic"><span class="ic">${Icons.line(u.id)}</span></span><div class="up-body"><b>${esc(u.name.toUpperCase())}</b><span>${l ? esc(u.text(l)) : esc(u.step.toUpperCase()) + (u.once ? '' : ' PER LEVEL')}</span><div class="up-pips">${pips}</div></div>` +
        (maxed ? `<div class="up-max">${u.once ? 'OWNED' : 'MAX'}</div>` : `<button class="btn ${can ? 'primary' : ''}" ${can ? '' : 'disabled'}><b>${ic('coin')}${fmt(cost)}</b><small>${u.once ? 'ONE-TIME UNLOCK' : esc(u.step.toUpperCase())}</small></button>`);
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
    $('mRestart').onclick = () => { click(); Game.saveRun(); Save.clearRun(); play({ tutorial: !Save.data.tutDone }); };
    $('mHome').onclick = () => { click(); const ended = Game.saveRun() === 'ended'; closeModal(true); show('home'); toast(ended ? 'KNOCKED OUT. THAT RUN IS OVER.' : 'RUN SAVED. CONTINUE ANY TIME.', 'check'); };
  }
  function resume() {
    if (modalKind !== 'pause') return;
    closeModal(true);
    Game.paused = false; Platform.gameplayStart();
  }

  function openSettings() {
    const sw = ACCENTS.map(a => `<button class="sw${a.id === Theme.id ? ' on' : ''}" data-acc="${a.id}" style="--s:${a.hex}" title="${a.name}" aria-label="${a.name}"></button>`).join('');
    const S = Save.data.settings, pct = v => Math.round(v) + '%';
    const vol = `<div class="set-label">MUSIC VOLUME</div>${slider('musicVol', { min: 0, max: 100, value: Math.round(S.musicVol * 100), label: 'Music volume', text: pct })}<div class="set-label">SOUND VOLUME</div>${slider('sfxVol', { min: 0, max: 100, value: Math.round(S.sfxVol * 100), label: 'Sound volume', text: pct })}`;
    openModal('settings', `<h2>SETTINGS</h2>${toggleRow()}<div class="set-label">THEME COLOUR</div><div class="swatches">${sw}</div>${vol}
      <div class="actions"><button class="btn primary wide" id="mDone"><b>DONE</b></button><button class="btn wide danger" id="mReset"><b>RESET PROGRESS</b></button></div><a class="legal" href="privacy.html" target="_blank" rel="noopener">PRIVACY POLICY</a>`);
    wireToggles();
    $('sheet').querySelectorAll('[data-acc]').forEach(b => {
      b.onclick = () => {
        Save.data.settings.accent = b.dataset.acc; Save.save(); Theme.set(b.dataset.acc); click();
        $('sheet').querySelectorAll('[data-acc]').forEach(o => o.classList.toggle('on', o === b));
      };
    });
    wireSlider($('sheet'), 'musicVol', { min: 0, max: 100, text: pct }, v => { Save.data.settings.musicVol = v / 100; Sfx.setMusicVol(v / 100); Save.save(); });
    wireSlider($('sheet'), 'sfxVol', { min: 0, max: 100, text: pct }, v => { Save.data.settings.sfxVol = v / 100; Sfx.setSfxVol(v / 100); Save.save(); });
    $('sfxVol').addEventListener('change', () => { Sfx.ensure(); Sfx.coin(2); });
    $('mDone').onclick = () => { click(); closeModal(); };
    let armed = false;
    $('mReset').onclick = () => {
      if (!armed) { armed = true; $('mReset').innerHTML = '<b>TAP AGAIN TO WIPE EVERYTHING</b>'; Sfx.deny(); return; }
      Save.reset(); Theme.set(Save.data.settings.accent); Game.toMenu(); closeModal(); toast('PROGRESS RESET', 'restart');
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
      const kind = PERK_KIND[p.kind] || PERK_KIND.offense, rar = p.rarity, have = p.have;
      const stack = have
        ? `<div class="pk-stack"><span>OWNED x${have}</span><i>›</i><b>x${have + p.n}</b></div>`
        : `<div class="pk-stack new"><b>NEW${p.n > 1 ? ' · x' + p.n : ''}</b></div>`;
      return `<button class="perk rar-${rar.id}" data-perk="${p.id}" data-n="${p.n}" style="--c:${rar.color};--i:${i}">
        <span class="pk-key"><kbd>${i + 1}</kbd></span>
        <span class="pk-kind">${rar.name}${p.n > 1 ? `<i>${'\u25C6'.repeat(p.n)}</i>` : ''}</span>
        <span class="pk-orn"><u></u><u></u><u></u><u></u></span><span class="pk-badge"><span class="pk-glow"></span><span class="pk-ic">${Icons.perk(p.id)}</span></span>
        <b class="pk-name">${esc(p.name.toUpperCase())}</b>
        <small class="pk-type" style="color:${kind.color}">${kind.name}</small>
        <p class="pk-text">${esc(p.text)}</p>${stack}</button>`;
    }).join('');
    const owned = Object.entries(r.perks).map(([id, n]) => `<span class="pk-own" title="${esc(PERK[id].name)}">${Icons.perk(id)}${n > 1 ? `<b>${n}</b>` : ''}</span>`).join('');
    openModal('perks', `<div class="pk-head"><small>STAGE ${stage - 1} CLEARED</small><h2 class="win">BOSS DOWN</h2><div class="sub">CHOOSE A PERK. THE RARER THE CARD, THE STRONGER IT IS.</div></div>
      <div class="perk-row">${cards}</div>
      <div class="pk-foot"><span>NEXT: STAGE ${stage}</span>${owned ? `<div class="pk-owned"><em>YOUR PERKS</em>${owned}</div>` : ''}</div>`);
    let armed = false, chosen = false;
    setTimeout(() => { armed = true; }, 450);   // so a throw still held down can't pick one by accident
    const choose = el => {
      if (!armed || chosen) return;
      chosen = true; Sfx.perk(); if (+el.dataset.n >= 5) Sfx.jackpot();
      $('sheet').classList.add('picked'); el.classList.add('chosen');
      setTimeout(() => { closeModal(true); Game.pickPerk(el.dataset.perk, +el.dataset.n || 1); Platform.gameplayStart(); cache.perks = null; window.removeEventListener('keydown', keys); }, 380);
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
    // what nearly happened, and what is nearly earned: the reasons to go again
    let tease = '';
    const gap = (s.prevBest || 0) - s.kos;
    if (!s.newBest && s.prevBest >= 5 && gap >= 0 && gap <= 5) tease = `SO CLOSE. ${gap + 1} MORE WOULD HAVE BEATEN YOUR BEST`;
    else if (s.bossHp > 0 && s.bossHp < 0.45) tease = `${esc(s.bossName)} HAD ${Math.max(1, Math.round(s.bossHp * 100))}% HEALTH LEFT`;
    else if (s.toBoss > 0 && s.toBoss <= 3) tease = `${s.toBoss} KNOCKOUT${s.toBoss > 1 ? 'S' : ''} FROM THE BOSS`;
    const stars = n => '\u2605'.repeat(n) + '\u2606'.repeat(MASTERY.length - n);
    const mastUps = (s.mastered || []).map(id => `<div class="rankup">${ic('star')}<b>${esc(ITEM[id].name.toUpperCase())} MASTERY ${stars(Save.masteryLvl(id))}</b><span>+5% DMG</span></div>`).join('');
    let mast = '';
    const mi = Game.bag.filter(Boolean).map(id => ({ id, m: Save.masteryInfo(id) })).filter(o => o.m.next).sort((a, b) => (a.m.next - a.m.kills) - (b.m.next - b.m.kills))[0];
    if (mi) mast = `<div class="rank-strip in-sheet mast"><div class="rk-top"><b>${esc(ITEM[mi.id].name.toUpperCase())} MASTERY <i>${stars(mi.m.lvl)}</i></b><span>${mi.m.next - mi.m.kills} KO${mi.m.next - mi.m.kills > 1 ? 's' : ''} TO THE NEXT STAR</span></div><div class="rk-track"><i style="width:${(mi.m.t * 100).toFixed(1)}%"></i></div></div>`;
    let goal = '';
    if (next) {
      const t = clamp(d.coins / next.price, 0, 1);
      goal = `<div class="goal ${canItem ? 'ready' : ''}" id="mGoal"><div class="goal-ic"></div><div class="goal-body"><small>${canItem ? 'YOU CAN AFFORD' : 'SAVING UP FOR'}</small><b>${esc(next.name.toUpperCase())}</b>
        <div class="bar-track"><i style="width:${(t * 100).toFixed(0)}%"></i></div></div><span>${canItem ? 'GET IT' : fmt(next.price - d.coins) + ' TO GO'}</span></div>`;
    }
    openModal('results', `<h2 class="lose">KNOCKED OUT</h2><div class="sub">STAGE ${s.stage} · ${esc(THEMES[(s.stage - 1) % THEMES.length].name.toUpperCase())}</div>
      <div class="res-score"><span>KNOCKOUTS${s.newBest ? ' <em class="new">NEW BEST</em>' : ''}</span><b>${s.kos}</b></div>${tease ? `<div class="tease">${tease}</div>` : ''}
      <div class="res-grid"><div><b>x${s.combo}</b><small>BEST STREAK</small></div><div><b>${s.heads}</b><small>HEADSHOTS</small></div><div><b>${s.bounties || 0}</b><small>BOUNTIES</small></div><div><b>${s.bosses}</b><small>BOSSES</small></div></div>
      <div class="coins-gain">${ic('coin')}+${fmt(s.coins)}</div>${rankUps}${mastUps}
      <div class="rank-strip in-sheet"><div class="rk-top"><b>${esc(r.cur.name.toUpperCase())}</b><span>${r.next ? `${r.kos} / ${r.next.kos} KOs` : 'TOP RANK'}</span></div><div class="rk-track"><i style="width:${(r.t * 100).toFixed(1)}%"></i></div></div>
      ${mast}${goal}
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
    let shown = 0;
    Game.bag.forEach((id, i) => {
      if (!id) return;
      const key = ++shown;
      const b = document.createElement('button');
      b.className = 'hslot'; b.dataset.i = i;
      b.appendChild(ItemArt.iconEl(id, 44));
      b.insertAdjacentHTML('beforeend', `<kbd>${key}</kbd><small>${ic('bolt')}<span>${Math.round(Game.staCost(ITEM[id]))}</span></small>`);
      b.tabIndex = -1;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Game.selectSlot(i); });
      el.appendChild(b);
    });
    // a temporary weapon from a crate always sits at the right-hand end of the row
    el.insertAdjacentHTML('beforeend', '<button class="hslot bonus hidden" id="slotBonus" tabindex="-1"><span class="hs-ic"></span><kbd>4</kbd><b id="bonusN">3</b><small>FREE</small></button>');
    $('slotBonus').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Game.selectSlot(3); });
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

  let shownCoins = null, targetT = 0;
  function tick(dt) {
    if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.add('hidden');
    if (screen !== null) return;
    const p = Game.player, r = Game.run;
    if (!p || !r) return;
    if (coachKind) {
      if (coachKind !== 'tut' && !Game.paused && (coachT -= dt) <= 0) { coachKind = null; $('coach').classList.add('hidden'); }
    }
    set('kos', r.kos, v => { $('hudKos').textContent = v; const m = $('hudMid'); m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); });
    // the counter rolls up to the real total as the coins fly in
    const tc = Save.data.coins;
    if (shownCoins == null || tc < shownCoins || tc - shownCoins > 4000) shownCoins = tc;
    else if (shownCoins < tc) shownCoins = Math.min(tc, shownCoins + Math.max(1, (tc - shownCoins) * dt * 5));
    set('coins', Math.floor(shownCoins), v => { $('hudCoins').textContent = fmt(v); });
    set('ping', Game.coinPing, () => { const el = $('coinPill'); el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping'); });
    if ((targetT -= dt) <= 0) { targetT = 0.5; const q = $('coinPill').getBoundingClientRect(); Game.setCoinTarget(q.left + 20, q.top + q.height / 2); }
    // your best, and how near you are to it
    const best = Save.data.best.kos, gap = best - r.kos;
    const bestTxt = best < 5 || Game.tutorial ? '' : gap < 0 ? 'NEW BEST' : gap <= 3 ? (gap + 1) + ' TO BEAT YOUR BEST' : 'BEST ' + best;
    set('best', bestTxt, v => { const el = $('hudBest'); el.textContent = v; el.classList.toggle('hidden', !v); el.classList.toggle('near', gap >= 0 && gap <= 3); el.classList.toggle('beat', gap < 0); });
    // frenzy and last stand
    const fv = Game.fever, st = Game.stand;
    set('fever', fv > 0, v => { $('fever').classList.toggle('hidden', !v); document.body.classList.toggle('frenzy', v); });
    if (fv > 0) $('feverFill').style.transform = `scaleX(${fv.toFixed(3)})`;
    set('stand', st > 0, v => { $('stand').classList.toggle('hidden', !v); });
    if (st > 0) $('standFill').style.transform = `scaleX(${st.toFixed(3)})`;
    // bounty
    const bo = r.bounty, boKey = bo && !Game.tutorial ? bo.text + ':' + bo.prog + ':' + bo.done : '';
    set('bounty', boKey, v => {
      const el = $('bounty');
      el.classList.toggle('hidden', !v);
      if (!v) return;
      el.classList.toggle('done', bo.done);
      el.innerHTML = `<small>${bo.done ? 'BOUNTY PAID' : 'BOUNTY'}</small><b>${esc(bo.text)}</b><div class="bo-row"><div class="bo-track"><i style="width:${(bo.prog / bo.n * 100).toFixed(0)}%"></i></div><span>${bo.prog}/${bo.n}</span><em>+${fmt(bo.pay)}</em></div>`;
      el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    });
    set('stage', r.stage, v => { $('chipNum').textContent = v; $('chipTitle').textContent = THEMES[(v - 1) % THEMES.length].name.toUpperCase(); });
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
      if (v >= 2) { const ev = Game.feverEvery, k = v % ev; $('comboPips').innerHTML = Array.from({ length: ev }, (_, i) => `<u class="${i < k || (k === 0 && Game.fever > 0) ? 'on' : ''}"></u>`).join(''); $('comboNum').textContent = 'x' + v; $('comboBonus').textContent = '+' + Math.min(v, 10) * 10 + '% COINS'; const n = $('comboNum'); n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; }
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
