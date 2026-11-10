'use strict';
/* =========================================================================
   Progress: save data, the bag (three item slots), upgrades, daily missions,
   the login streak and ranks. Saved through Platform (CrazyGames data module,
   else localStorage).
   ========================================================================= */

const Save = (() => {
  const KEY = 'save_v1';
  const fresh = () => ({
    coins: 0,
    items: ['rock'],
    bag: ['rock', null, null],
    upgrades: {},
    settings: { sfx: true, music: true, shake: true },
    best: { kos: 0, stage: 1, streak: 0 },
    stats: { kills: 0, headshots: 0, ringouts: 0, bosses: 0, deflects: 0, earned: 0, crates: 0, combo5: 0, runs: 0, tricks: 0, throws: 0 },
    rank: 0,
    daily: { day: -1, list: [], bonus: false },
    streak: { count: 0, claimedDay: -1 },
    seenTut: false, seenDuck: false, seenSwap: false,
  });
  let data = fresh();

  function load() {
    try {
      const raw = Platform.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw), f = fresh();
        data = Object.assign(f, d);
        for (const k of ['settings', 'best', 'stats', 'daily', 'streak']) data[k] = Object.assign(fresh()[k], d[k] || {});
        if (!Array.isArray(data.items)) data.items = ['rock'];
        data.items = data.items.filter(id => ITEM[id]);
        if (!data.items.includes('rock')) data.items.unshift('rock');
        if (!Array.isArray(data.bag) || data.bag.length !== 3) data.bag = ['rock', null, null];
        data.bag = data.bag.map(id => (id && data.items.includes(id) ? id : null));
        if (!data.bag.some(Boolean)) data.bag[0] = 'rock';
        if (typeof data.upgrades !== 'object' || !data.upgrades) data.upgrades = {};
      }
    } catch (e) { data = fresh(); }
    rollDaily();
  }
  function save() { try { Platform.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }
  function reset() { data = fresh(); rollDaily(); save(); }

  function addCoins(n) { data.coins = Math.max(0, data.coins + Math.round(n)); save(); }

  /* ------------------------------------------------------------------ bag */
  const owns = id => data.items.includes(id);
  function buyItem(id) {
    const it = ITEM[id];
    if (!it || owns(id) || data.coins < it.price) return false;
    data.coins -= it.price; data.items.push(id);
    const free = data.bag.indexOf(null);
    if (free >= 0) data.bag[free] = id;
    save(); return true;
  }
  // put an owned item in a slot; if it already sits in another slot the two swap
  function equip(id, slot) {
    if (!owns(id) || slot < 0 || slot > 2) return false;
    const cur = data.bag.indexOf(id);
    if (cur === slot) return true;
    if (cur >= 0) data.bag[cur] = data.bag[slot];
    data.bag[slot] = id;
    if (!data.bag.some(Boolean)) data.bag[0] = 'rock';
    save(); return true;
  }
  function unequip(slot) {
    if (data.bag.filter(Boolean).length <= 1) return false;
    data.bag[slot] = null; save(); return true;
  }
  const bagItems = () => data.bag.filter(Boolean);
  const nextItem = () => ITEMS.find(i => !owns(i.id)) || null;

  /* ------------------------------------------------------------- upgrades */
  const lvl = id => data.upgrades[id] || 0;
  function buyUpgrade(id) {
    const u = UPGRADE[id], l = lvl(id);
    if (!u || l >= u.max) return false;
    const c = upgradeCost(u, l);
    if (data.coins < c) return false;
    data.coins -= c; data.upgrades[id] = l + 1; save(); return true;
  }
  const canAffordAny = () => UPGRADES.some(u => lvl(u.id) < u.max && data.coins >= upgradeCost(u, lvl(u.id))) || ITEMS.some(i => !owns(i.id) && data.coins >= i.price);

  /* ------------------------------------------------------------- missions */
  function rollDaily() {
    const day = dayIndex();
    if (data.daily.day === day && data.daily.list.length) return;
    const R = mulberry32((day * 2654435761) >>> 0);
    const pool = MISSION_POOL.slice();
    const list = [];
    while (list.length < 3 && pool.length) {
      const m = pool.splice(Math.floor(R() * pool.length), 1)[0];
      const n = m.n[0] + Math.floor(R() * (m.n[1] - m.n[0] + 1));
      list.push({ id: m.id, stat: m.stat, n, prog: 0, reward: m.reward, claimed: false, text: m.text.replace('{n}', n) });
    }
    data.daily = { day, list, bonus: false };
    save();
  }
  // bump a lifetime stat and any mission that counts it; returns a mission that just completed
  function track(stat, n = 1) {
    if (data.stats[stat] != null) data.stats[stat] += n;
    rollDaily();
    let done = null;
    for (const m of data.daily.list) {
      if (m.stat !== stat || m.prog >= m.n) continue;
      m.prog = Math.min(m.n, m.prog + n);
      if (m.prog >= m.n) done = m;
    }
    return done;
  }
  function claimMission(i) {
    const m = data.daily.list[i];
    if (!m || m.claimed || m.prog < m.n) return 0;
    m.claimed = true; data.coins += m.reward; save();
    return m.reward;
  }
  const allClaimed = () => data.daily.list.length > 0 && data.daily.list.every(m => m.claimed);
  function claimBonus() {
    if (!allClaimed() || data.daily.bonus) return 0;
    data.daily.bonus = true; data.coins += 250; save(); return 250;
  }
  const missionsReady = () => data.daily.list.some(m => !m.claimed && m.prog >= m.n) || (allClaimed() && !data.daily.bonus);

  /* --------------------------------------------------------- login streak */
  const STREAK = [50, 75, 100, 125, 150, 200, 400];
  function streakState() {
    const day = dayIndex(), s = data.streak;
    const claimable = s.claimedDay !== day;
    let count = s.count;
    if (claimable && s.claimedDay !== day - 1) count = 0;   // missed a day: back to day 1
    return { claimable, day: count % 7, reward: STREAK[count % 7], count, table: STREAK };
  }
  function claimStreak() {
    const st = streakState();
    if (!st.claimable) return 0;
    data.streak = { count: st.count + 1, claimedDay: dayIndex() };
    data.coins += st.reward; save();
    return st.reward;
  }

  /* ---------------------------------------------------------------- ranks */
  function rankInfo() {
    const kos = data.stats.kills;
    let i = 0;
    while (i + 1 < RANKS.length && kos >= RANKS[i + 1].kos) i++;
    const cur = RANKS[i], next = RANKS[i + 1] || null;
    return { i, cur, next, kos, t: next ? (kos - cur.kos) / (next.kos - cur.kos) : 1 };
  }
  // pays out every rank reached since the last check; returns [{ name, pay }]
  function claimRanks() {
    const info = rankInfo(), out = [];
    while (data.rank < info.i) {
      data.rank++;
      const r = RANKS[data.rank];
      data.coins += r.pay; out.push(r);
    }
    if (out.length) save();
    return out;
  }

  // returns { newBest, newStage }
  function recordRun(kos, stage, streak) {
    const b = data.best;
    const res = { newBest: kos > b.kos, newStage: stage > b.stage };
    b.kos = Math.max(b.kos, kos); b.stage = Math.max(b.stage, stage); b.streak = Math.max(b.streak, streak);
    save();
    if (res.newBest) Platform.submitScore(b.kos);
    return res;
  }

  return {
    load, save, reset, addCoins, owns, buyItem, equip, unequip, bagItems, nextItem, lvl, buyUpgrade, canAffordAny,
    track, claimMission, claimBonus, allClaimed, missionsReady, rollDaily, streakState, claimStreak, rankInfo, claimRanks, recordRun,
    get data() { return data; },
  };
})();
