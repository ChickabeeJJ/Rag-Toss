'use strict';
/* =========================================================================
   Content as data: throwables, enemy archetypes, bosses, upgrades, run perks,
   themes, missions and ranks. Behaviour for each item's gimmick lives in
   game.js, keyed by the `fx` field here.
   ========================================================================= */

const G = 1500;              // world gravity, px/s^2
const WORLD_W = 1600, WORLD_H = 900;
// full power has to reach the furthest, highest island with the slowest item
const THROW_MIN = 380, THROW_MAX = 1760;

/* Stamina is a pool of 200 and a throw only takes a few points of it.
   r: radius, sta: stamina cost, dmg: base damage, kb: knockback weight,
   spd / grav: multipliers on throw speed and gravity, spin: rad/s */
const ITEMS = [
  { id: 'rock', name: 'Rock', price: 0, sta: 4, dmg: 14, r: 11, kb: 1.0, spd: 1, grav: 1, spin: 7,
    tag: 'HONEST', desc: 'No tricks. Cheap to throw and it hits where you aim it.' },
  { id: 'chicken', name: 'Rubber Chicken', price: 150, sta: 5, dmg: 10, r: 13, kb: 0.8, spd: 1, grav: 1, spin: 11, bounce: 4,
    tag: 'BOUNCES', desc: 'Bounces four times off islands and foes. Every bounce adds 50% damage.' },
  { id: 'boomerang', name: 'Boomerang', price: 320, sta: 6, dmg: 12, r: 14, kb: 0.9, spd: 0.9, grav: 0.22, spin: 22, pierce: true,
    tag: 'COMES BACK', desc: 'Cuts through everyone, turns round and cuts through them again. Catch it for the stamina back.' },
  { id: 'cactus', name: 'Cactus', price: 480, sta: 6, dmg: 8, r: 13, kb: 0.6, spd: 1, grav: 1, spin: 6, stick: true,
    tag: 'PRICKLY', desc: 'Sticks in and keeps hurting for five seconds. More cactus, more hurting.' },
  { id: 'snowball', name: 'Snowball', price: 640, sta: 6, dmg: 8, r: 12, kb: 0.5, spd: 1.05, grav: 1, spin: 4,
    tag: 'FREEZES', desc: 'Freezes a foe solid. The next thing to hit them shatters the ice for double damage.' },
  { id: 'bowling', name: 'Bowling Ball', price: 850, sta: 10, dmg: 24, r: 17, kb: 3.2, spd: 0.9, grav: 1, spin: 5, pierce: true, heavy: true,
    tag: 'HEAVY', desc: 'Ploughs through bodies, smashes lids and sends nearly anyone flying off their island.' },
  { id: 'forks', name: 'Cutlery', price: 1100, sta: 7, dmg: 8, r: 9, kb: 0.4, spd: 1.08, grav: 0.95, spin: 0, stick: true, multi: 3,
    tag: 'x3', desc: 'Three forks in a fan. They stick wherever they land.' },
  { id: 'dynamite', name: 'Dynamite', price: 1400, sta: 12, dmg: 32, r: 12, kb: 2.3, spd: 0.95, grav: 1, spin: 9, blast: 150,
    tag: 'BOOM', desc: 'Explodes on anything it touches. The blast ignores lids and throws foes clear.' },
  { id: 'beehive', name: 'Beehive', price: 1800, sta: 9, dmg: 6, r: 14, kb: 0.5, spd: 0.95, grav: 1, spin: 5,
    tag: 'SWARM', desc: 'Cracks open into six angry bees. Each one picks its own foe and chases it down.' },
  { id: 'plunger', name: 'Plunger', price: 2200, sta: 8, dmg: 10, r: 12, kb: 0, spd: 1.05, grav: 0.95, spin: 0, stick: true,
    tag: 'YANKS', desc: 'Sticks on and yanks the foe towards you, usually straight off their island.' },
  { id: 'firework', name: 'Firework', price: 2700, sta: 10, dmg: 22, r: 11, kb: 1.6, spd: 0.6, grav: 0, spin: 0, blast: 125,
    tag: 'STRAIGHT', desc: 'Ignores gravity and keeps speeding up. Bursts into a shower that sets foes on fire.' },
  { id: 'magnet', name: 'Magnet', price: 3200, sta: 8, dmg: 14, r: 13, kb: 0.9, spd: 0.95, grav: 0.8, spin: 8,
    tag: 'HOMING', desc: 'Curves towards the nearest foe. Rips off helmets and lids and makes them fumble their throw.' },
  { id: 'anvil', name: 'Anvil', price: 3800, sta: 13, dmg: 42, r: 17, kb: 1.2, spd: 0.9, grav: 0.85, spin: 0, heavy: true,
    tag: 'DROPS', desc: 'Throw it over their heads. The moment it is above a foe it stops dead and drops straight down.' },
  { id: 'pinata', name: 'Pinata', price: 4400, sta: 10, dmg: 7, r: 15, kb: 0.4, spd: 0.95, grav: 1, spin: 6,
    tag: 'BURSTS', desc: 'Pops at the top of its arc and rains nine hard candies on everything below.' },
  { id: 'jar', name: 'Storm Jar', price: 5200, sta: 11, dmg: 16, r: 12, kb: 0.6, spd: 1, grav: 1, spin: 8,
    tag: 'CHAINS', desc: 'Smashes into lightning that jumps to every foe in reach and stuns them.' },
  { id: 'hole', name: 'Pocket Hole', price: 6200, sta: 14, dmg: 20, r: 13, kb: 2.4, spd: 0.95, grav: 0.9, spin: 10,
    tag: 'SUCKS', desc: 'Opens a hole that drags foes and their throws in, then spits everyone out.' },
  { id: 'duck', name: 'Golden Duck', price: 7500, sta: 7, dmg: 17, r: 13, kb: 1.0, spd: 1, grav: 1, spin: 6, bounce: 1,
    tag: 'x3 COINS', desc: 'A knockout with the duck pays triple coins. It bounces once, too.' },
  { id: 'sack', name: 'Mystery Sack', price: 9000, sta: 7, dmg: 0, r: 14, kb: 1, spd: 1, grav: 1, spin: 6,
    tag: '???', desc: 'Every throw pulls out something random, even things you do not own, and it hits 30% harder.' },
];
const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));

/* sub-projectiles and enemy ammo (never in the shop) */
const AMMO = {
  candy: { id: 'candy', name: 'Candy', dmg: 7, r: 7, kb: 0.3, grav: 1, spin: 12 },
  bee: { id: 'bee', name: 'Bee', dmg: 5, r: 6, kb: 0.2, grav: 0, spin: 0 },
  e_rock: { id: 'e_rock', dmg: 8, r: 10, grav: 1, spin: 7 },
  e_bomb: { id: 'e_bomb', dmg: 13, r: 12, grav: 1, spin: 5, blast: 105 },
  e_ball: { id: 'e_ball', dmg: 10, r: 8, grav: 1, spin: 20 },
  e_pin: { id: 'e_pin', dmg: 7, r: 10, grav: 1, spin: 13 },
  e_dart: { id: 'e_dart', dmg: 8, r: 7, grav: 1, spin: 0 },
  e_barrel: { id: 'e_barrel', dmg: 22, r: 20, grav: 1, spin: 4, hp: 2 },
};

/* ------------------------------------------------------------------ foes
   hp / dmg scale with the stage. wind: seconds of wind-up (the telegraph),
   rest: seconds between throws, flight: seconds the throw stays in the air,
   err: aim error, anchor: knockback needed to throw them off their feet. */
const FOES = {
  chucker: { name: 'Chucker', hp: 30, ammo: 'e_rock', wind: 0.95, rest: [2.4, 3.6], flight: [1.15, 1.5], err: 1, anchor: 1.7, coins: 5,
    body: '#e2574c', shade: '#b23c35', scale: 1 },
  lobber: { name: 'Lobber', hp: 38, ammo: 'e_bomb', wind: 1.2, rest: [3.2, 4.4], flight: [1.9, 2.3], err: 1.2, anchor: 1.8, coins: 7,
    body: '#e08a3a', shade: '#b2652a', scale: 1, hat: 'fuse' },
  pitcher: { name: 'Pitcher', hp: 32, ammo: 'e_ball', wind: 1.25, rest: [2.6, 3.6], flight: [0.62, 0.8], err: 0.55, anchor: 1.6, coins: 7,
    body: '#4f8fe0', shade: '#3a69ad', scale: 1, hat: 'cap', laser: true },
  juggler: { name: 'Juggler', hp: 40, ammo: 'e_pin', wind: 0.9, rest: [3, 4], flight: [1.05, 1.35], err: 1.25, anchor: 1.7, coins: 8, burst: 3,
    body: '#b05be0', shade: '#8442ad', scale: 1, hat: 'jester' },
  guard: { name: 'Lid Guard', hp: 55, ammo: 'e_rock', wind: 1, rest: [2.6, 3.6], flight: [1.1, 1.4], err: 0.9, anchor: 2.3, coins: 9, shield: 3,
    body: '#5c9c6b', shade: '#427450', scale: 1.05, hat: 'pot' },
  floater: { name: 'Floater', hp: 36, ammo: 'e_dart', wind: 0.9, rest: [2.2, 3.2], flight: [0.95, 1.2], err: 0.9, anchor: 1.5, coins: 9, balloons: 3,
    body: '#e06aa5', shade: '#ad4d7e', scale: 0.95, hat: 'goggles' },
  brute: { name: 'Brute', hp: 150, ammo: 'e_barrel', wind: 1.5, rest: [3.6, 4.8], flight: [1.5, 1.8], err: 0.8, anchor: 4.2, coins: 16,
    body: '#8a5a44', shade: '#684232', scale: 1.38, hat: 'horns' },
};
// the stage a foe first shows up in
const FOE_UNLOCK = [['chucker', 1], ['lobber', 2], ['pitcher', 3], ['juggler', 4], ['guard', 5], ['floater', 6], ['brute', 7]];

const BOSSES = [
  { base: 'chucker', name: 'KING CHUCK', hp: 210, burst: 3, scale: 1.55 },
  { base: 'lobber', name: 'MADAME LOB', hp: 250, burst: 2, scale: 1.55 },
  { base: 'pitcher', name: 'FASTBALL FRANK', hp: 260, burst: 2, scale: 1.5 },
  { base: 'guard', name: 'SIR LIDSALOT', hp: 300, burst: 2, scale: 1.55, shield: 6 },
  { base: 'floater', name: 'BARON VON FLOAT', hp: 300, burst: 3, scale: 1.4, balloons: 6 },
  { base: 'brute', name: 'THE WALL', hp: 420, burst: 1, scale: 1.75 },
];
const STAGE_KILLS = 8;        // knockouts before the stage boss walks in

/* ------------------------------------------------------- permanent upgrades */
const UPGRADES = [
  { id: 'health', name: 'Thick Skull', icon: 'heart', max: 10, base: 60, grow: 1.5, text: l => `+${l * 15} MAX HEALTH`, step: '+15 health' },
  { id: 'stamina', name: 'Big Lungs', icon: 'bolt', max: 10, base: 60, grow: 1.5, text: l => `+${l * 20} MAX STAMINA`, step: '+20 stamina' },
  { id: 'regen', name: 'Second Breath', icon: 'bolt', max: 10, base: 80, grow: 1.55, text: l => `+${l * 10}% STAMINA REFILL`, step: '+10% refill' },
  { id: 'power', name: 'Strong Arm', icon: 'fist', max: 10, base: 100, grow: 1.6, text: l => `+${l * 8}% DAMAGE`, step: '+8% damage' },
  { id: 'quick', name: 'Quick Hands', icon: 'hand', max: 6, base: 120, grow: 1.7, text: l => `-${l * 8}% TIME BETWEEN THROWS`, step: '-8% wait' },
  { id: 'guide', name: 'Good Eye', icon: 'eye', max: 6, base: 90, grow: 1.7, text: l => `+${l * 2} AIM DOTS`, step: 'longer aim line' },
  { id: 'armor', name: 'Padding', icon: 'shield', max: 8, base: 120, grow: 1.65, text: l => `-${l * 5}% DAMAGE TAKEN`, step: '-5% damage taken' },
  { id: 'greed', name: 'Deep Pockets', icon: 'coin', max: 8, base: 150, grow: 1.7, text: l => `+${l * 10}% COINS`, step: '+10% coins' },
];
const UPGRADE = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
const upgradeCost = (u, lvl) => Math.round(u.base * Math.pow(u.grow, lvl) / 10) * 10;

/* -------------------------------------------------------------- run perks
   Offered three at a time after every boss; they last until the run ends. */
const PERKS = [
  { id: 'heavy', name: 'Heavy Hands', icon: 'fist', text: '+25% damage' },
  { id: 'twin', name: 'Second Helping', icon: 'hand', text: 'One throw in four comes out twice' },
  { id: 'skin', name: 'Extra Padding', icon: 'heart', text: '+35 max health, and heal it now' },
  { id: 'lungs', name: 'Deep Breath', icon: 'bolt', text: '+40% stamina refill' },
  { id: 'leech', name: 'Snack Break', icon: 'heart', text: 'Heal 6 with every knockout' },
  { id: 'eye', name: 'Sharp Eye', icon: 'eye', text: 'Headshots hit 50% harder' },
  { id: 'pop', name: 'Loud Exit', icon: 'boom', text: 'Knocked-out foes explode' },
  { id: 'big', name: 'Family Size', icon: 'bag', text: 'Everything you throw is 30% bigger' },
  { id: 'crate', name: 'Special Delivery', icon: 'gift', text: 'Mystery crates float by twice as often' },
  { id: 'rich', name: 'Loose Change', icon: 'coin', text: '+30% coins' },
  { id: 'shove', name: 'Big Shove', icon: 'wing', text: '+40% knockback' },
  { id: 'hot', name: 'Hot Hands', icon: 'flame', text: 'Every hit sets the foe on fire' },
  { id: 'spring', name: 'Springy', icon: 'up', text: 'Everything bounces one more time' },
  { id: 'cheap', name: 'Light Load', icon: 'bolt', text: 'Throws cost 20% less stamina' },
];
const PERK = Object.fromEntries(PERKS.map(p => [p.id, p]));

/* ----------------------------------------------------------------- themes */
const THEMES = [
  { name: 'Meadow', sky: ['#7fc4e8', '#bfe6e2', '#e8f2c8'], hills: ['#8cc79a', '#6fb184', '#4f9a70'], grass: '#8ed65a', grassHi: '#b4ec7a', dirt: '#8a6a4c', dirt2: '#72563d', dirt3: '#5f4732', dark: false },
  { name: 'Sunset', sky: ['#3d3a78', '#d46a6a', '#ffc27a'], hills: ['#b0647a', '#8a4868', '#5e3358'], grass: '#e0a04a', grassHi: '#f2c06a', dirt: '#7a4a44', dirt2: '#643a38', dirt3: '#4e2c2e', dark: false },
  { name: 'Snowfield', sky: ['#8aa6d6', '#c6d6ee', '#eef4fb'], hills: ['#c9d8ea', '#a9bfd9', '#8aa5c6'], grass: '#f3f7fc', grassHi: '#ffffff', dirt: '#7d8aa0', dirt2: '#687489', dirt3: '#566074', dark: false },
  { name: 'Night', sky: ['#0d1230', '#1e2a5a', '#3a4a7c'], hills: ['#2b3a66', '#1f2b50', '#16203d'], grass: '#4a8f7c', grassHi: '#66b39c', dirt: '#3c3f5c', dirt2: '#30324b', dirt3: '#25273b', dark: true },
  { name: 'Dunes', sky: ['#e8a25c', '#f4cf8e', '#fbeccb'], hills: ['#e2b676', '#cf9a58', '#b87f44'], grass: '#f0d08a', grassHi: '#fae3ab', dirt: '#b98552', dirt2: '#a06f42', dirt3: '#875b35', dark: false },
  { name: 'Storm', sky: ['#2a3140', '#4a5568', '#77839a'], hills: ['#56637a', '#414d62', '#2f394b'], grass: '#6f9a6a', grassHi: '#8bb586', dirt: '#55505a', dirt2: '#454049', dirt3: '#36323a', dark: true },
];

/* --------------------------------------------------------------- missions */
const MISSION_POOL = [
  { id: 'ko', stat: 'kills', n: [20, 40], reward: 120, text: 'Knock out {n} foes' },
  { id: 'head', stat: 'headshots', n: [8, 16], reward: 130, text: 'Land {n} headshots' },
  { id: 'ring', stat: 'ringouts', n: [5, 10], reward: 140, text: 'Knock {n} foes off their islands' },
  { id: 'boss', stat: 'bosses', n: [2, 3], reward: 160, text: 'Beat {n} bosses' },
  { id: 'deflect', stat: 'deflects', n: [5, 10], reward: 120, text: 'Knock {n} throws out of the air' },
  { id: 'coins', stat: 'earned', n: [200, 400], reward: 110, text: 'Earn {n} coins' },
  { id: 'crate', stat: 'crates', n: [3, 5], reward: 120, text: 'Pop {n} mystery crates' },
  { id: 'combo', stat: 'combo5', n: [3, 5], reward: 130, text: 'Reach a x5 streak {n} times' },
  { id: 'runs', stat: 'runs', n: [3, 5], reward: 100, text: 'Finish {n} runs' },
  { id: 'trick', stat: 'tricks', n: [4, 8], reward: 140, text: 'Score {n} trick shots' },
];

/* lifetime knockouts -> rank. Each rank-up pays coins. */
const RANKS = [
  { name: 'Butterfingers', kos: 0, pay: 0 },
  { name: 'Pebble Flicker', kos: 15, pay: 100 },
  { name: 'Backyard Tosser', kos: 40, pay: 150 },
  { name: 'Junk Slinger', kos: 90, pay: 250 },
  { name: 'Island Menace', kos: 180, pay: 400 },
  { name: 'Yard Sale Legend', kos: 320, pay: 600 },
  { name: 'Chaos Pitcher', kos: 520, pay: 900 },
  { name: 'Sky Bully', kos: 800, pay: 1300 },
  { name: 'Grand Chucker', kos: 1200, pay: 1800 },
  { name: 'Toss Royalty', kos: 1800, pay: 2500 },
  { name: 'The Last Throw', kos: 2800, pay: 4000 },
];

/* style bonuses: label + extra coins */
const STYLE = {
  head: ['HEADSHOT', 2], ring: ['RING OUT', 4], deflect: ['DEFLECT', 2], long: ['LONG SHOT', 3], air: ['AIRBORNE', 4],
  double: ['DOUBLE KO', 6], trick: ['TRICK SHOT', 4], shatter: ['SHATTER', 3], pop: ['POP!', 2], stop: ['INTERRUPT', 1],
};
