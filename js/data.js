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
  { id: 'magnet', name: 'Magnet', price: 3200, sta: 12, dmg: 9, r: 13, kb: 0.9, spd: 0.95, grav: 0.8, spin: 8,
    tag: 'HOMING', desc: 'Curves towards the nearest foe. Rips off helmets and lids and makes them fumble their throw.' },
  { id: 'anvil', name: 'Anvil', price: 3800, sta: 13, dmg: 42, r: 17, kb: 1.2, spd: 0.9, grav: 0.85, spin: 0, heavy: true,
    tag: 'DROPS', desc: 'Throw it over their heads. The moment it is above a foe it stops dead and drops straight down.' },
  { id: 'pinata', name: 'Pinata', price: 4400, sta: 10, dmg: 7, r: 15, kb: 0.4, spd: 0.95, grav: 1, spin: 6,
    tag: 'BURSTS', desc: 'Pops at the top of its arc and rains eight hard candies on everything below.' },
  { id: 'jar', name: 'Storm Jar', price: 5200, sta: 11, dmg: 16, r: 12, kb: 0.6, spd: 1, grav: 1, spin: 8,
    tag: 'CHAINS', desc: 'Smashes into lightning that jumps to every foe in reach and stuns them.' },
  { id: 'hole', name: 'Pocket Hole', price: 6200, sta: 14, dmg: 20, r: 13, kb: 2.4, spd: 0.95, grav: 0.9, spin: 10,
    tag: 'SUCKS', desc: 'Opens a hole that drags foes and their throws in, then spits everyone out.' },
  { id: 'duck', name: 'Golden Duck', price: 7500, sta: 7, dmg: 17, r: 13, kb: 1.0, spd: 1, grav: 1, spin: 6, bounce: 1,
    tag: 'x3 COINS', desc: 'A knockout with the duck pays triple coins. It bounces once, too.' },
  { id: 'sack', name: 'Mystery Sack', price: 9000, sta: 7, dmg: 0, r: 14, kb: 1, spd: 1, grav: 1, spin: 6,
    tag: '???', desc: 'Every throw pulls out something random, even things you do not own, and it hits 30% harder.' },
  { id: 'pie', name: 'Cream Pie', price: 230, sta: 5, dmg: 6, r: 14, kb: 0.3, spd: 0.95, grav: 1, spin: 5, stick: true,
    tag: 'BLINDS', desc: 'Splats in the face and blinds the foe: their throws go wildly off target for five seconds.' },
  { id: 'knife', name: 'Throwing Knife', price: 400, sta: 6, dmg: 12, r: 11, kb: 0.2, spd: 1.3, grav: 0.6, spin: 0, stick: true,
    tag: 'CRIT', desc: 'Fast and flat. A headshot hits four times as hard. Sticks wherever it lands.' },
  { id: 'sauce', name: 'Hot Sauce', price: 560, sta: 6, dmg: 5, r: 12, kb: 0.3, spd: 1, grav: 1, spin: 7,
    tag: 'BURNS', desc: 'Smashes open and sets the foe on fire for five seconds.' },
  { id: 'slime', name: 'Slime', price: 740, sta: 6, dmg: 6, r: 13, kb: 0.4, spd: 0.95, grav: 1, spin: 4, stick: true,
    tag: 'SLOWS', desc: 'Sticky goo that halves how fast a foe winds up and throws, for six seconds.' },
  { id: 'pan', name: 'Frying Pan', price: 980, sta: 9, dmg: 18, r: 15, kb: 1.5, spd: 0.95, grav: 1, spin: 9,
    tag: 'STUNS', desc: 'CLANG. Stuns a foe for a second and a half and smashes any lid they hold.' },
  { id: 'glove', name: 'Boxing Glove', price: 1250, sta: 8, dmg: 16, r: 14, kb: 3.2, spd: 1.35, grav: 0.15, spin: 0, life: 0.55,
    tag: 'PUNCH', desc: 'A spring-loaded punch. Short range, almost instant, with a huge knockback.' },
  { id: 'beachball', name: 'Beach Ball', price: 1600, sta: 8, dmg: 5, r: 24, kb: 1.4, spd: 0.7, grav: 0.3, spin: 3, bounce: 3,
    tag: 'LAUNCHES', desc: 'Big, bouncy and floaty. Whatever it hits is thrown straight up in the air.' },
  { id: 'glue', name: 'Glue Bomb', price: 3500, sta: 11, dmg: 10, r: 12, kb: 0.6, spd: 0.95, grav: 1, spin: 6,
    tag: 'TIMED', desc: 'Sticks to whatever it hits, then goes off a second and a half later.' },
  { id: 'banana', name: 'Banana Peel', price: 280, sta: 5, dmg: 7, r: 13, kb: 0.4, spd: 1, grav: 1, spin: 8, stick: true,
    tag: 'SLIPS', desc: 'Whatever it hits slips and goes down flat, however sturdy. Bosses just stumble and lose a second.' },
  { id: 'dice', name: 'Dice', price: 520, sta: 5, dmg: 11, r: 11, kb: 0.5, spd: 1.05, grav: 1, spin: 14, bounce: 1,
    tag: 'GAMBLE', desc: 'Rolls a number on every hit. A one barely scratches, a six hits more than twice as hard.' },
  { id: 'marbles', name: 'Marbles', price: 680, sta: 7, dmg: 5, r: 7, kb: 0.25, spd: 1.1, grav: 1, spin: 12, bounce: 3, multi: 5,
    tag: 'x5', desc: 'A handful of five that bounce three times each. Hard to dodge, easy to land one.' },
  { id: 'shuriken', name: 'Shuriken', price: 900, sta: 6, dmg: 10, r: 10, kb: 0.2, spd: 1.35, grav: 0.5, spin: 28, pierce: true, multi: 2,
    tag: 'x2 PIERCE', desc: 'Two fast flat stars that cut straight through everything in the way.' },
  { id: 'horseshoe', name: 'Horseshoe', price: 1050, sta: 6, dmg: 13, r: 13, kb: 0.7, spd: 1, grav: 1, spin: 14, bounce: 1,
    tag: 'LUCKY', desc: 'Nearly every other hit is a critical. Lands on its feet and bounces once.' },
  { id: 'teddy', name: 'Teddy Bear', price: 1300, sta: 6, dmg: 8, r: 14, kb: 0.5, spd: 0.95, grav: 1, spin: 6, bounce: 2,
    tag: 'COMFORT', desc: 'Soft, bouncy and kind. Every time it connects you patch up 4 health.' },
  { id: 'bell', name: 'Brass Bell', price: 1500, sta: 8, dmg: 8, r: 13, kb: 0.8, spd: 0.95, grav: 1, spin: 6,
    tag: 'DONG', desc: 'Rings out where it lands and stuns every foe nearby, helmets and lids or not.' },
  { id: 'egg', name: 'Rotten Egg', price: 1700, sta: 5, dmg: 4, r: 11, kb: 0.2, spd: 1, grav: 1, spin: 9,
    tag: 'POISONS', desc: 'Splats into a stink that poisons for eight seconds. Tougher the longer you leave it.' },
  { id: 'melon', name: 'Watermelon', price: 2000, sta: 9, dmg: 14, r: 16, kb: 1.1, spd: 0.92, grav: 1, spin: 5,
    tag: 'SPLATS', desc: 'Hits hard, then bursts into five seeds that spit out in every direction.' },
  { id: 'paint', name: 'Paint Bucket', price: 2400, sta: 9, dmg: 6, r: 14, kb: 0.6, spd: 0.95, grav: 1, spin: 5,
    tag: 'MARKS', desc: 'Splashes everyone around the landing with paint. Marked foes take 30% more damage for six seconds.' },
  { id: 'cushion', name: 'Whoopee Cushion', price: 2900, sta: 8, dmg: 4, r: 15, kb: 3.0, spd: 0.9, grav: 1, spin: 5,
    tag: 'PARP', desc: 'Lands with a gust that shoves every foe nearby away from the middle. Almost no damage, huge push.' },
  { id: 'trap', name: 'Mousetrap', price: 3300, sta: 8, dmg: 12, r: 12, kb: 0.3, spd: 1, grav: 1, spin: 7, stick: true,
    tag: 'SNAP', desc: 'Snaps shut on contact. The foe is stunned for a second and a half and sticks with the trap on.' },
  { id: 'disco', name: 'Disco Ball', price: 4000, sta: 10, dmg: 9, r: 14, kb: 0.5, spd: 0.95, grav: 1, spin: 7,
    tag: 'DAZZLES', desc: 'Throws light everywhere. Every foe on screen loses their aim for five seconds.' },
  { id: 'clock', name: 'Alarm Clock', price: 4800, sta: 10, dmg: 8, r: 13, kb: 0.4, spd: 1, grav: 1, spin: 6, stick: true,
    tag: 'TIMED STUN', desc: 'Sticks on, then goes off two seconds later: a wide blast of noise that stuns everyone nearby.' },
  { id: 'cannon', name: 'Cannonball', price: 5600, sta: 12, dmg: 26, r: 14, kb: 2.9, spd: 1.12, grav: 0.55, spin: 3, bounce: 2, heavy: true,
    tag: 'SKIPS', desc: 'Fast, flat and very heavy. It skips off whatever it hits, smashes lids and sends nearly anyone flying.' },
];
// the shop lists things cheapest first
ITEMS.sort((a, b) => a.price - b.price);
const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));

/* sub-projectiles and enemy ammo (never in the shop) */
const AMMO = {
  candy: { id: 'candy', name: 'Candy', dmg: 7, r: 7, kb: 0.3, grav: 1, spin: 12 },
  bee: { id: 'bee', name: 'Bee', dmg: 5, r: 6, kb: 0.2, grav: 0, spin: 0 },
  seed: { id: 'seed', name: 'Seed', dmg: 5, r: 6, kb: 0.2, grav: 1, spin: 14 },
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

/* Six bosses, each with its own rhythm, so no two fights feel alike.
   wind / rest / flight: seconds. fan + spread: projectiles per throw and the angle between them.
   dmg scales their throws. hp is the base health (stage scaling is gentle). */
const BOSSES = [
  { base: 'chucker', name: 'KING CHUCK', hp: 170, scale: 1.55, body: '#e8a23a', shade: '#b97a1f', hat: null,
    ammo: 'e_rock', fan: 3, spread: 0.2, burst: 1, wind: 1.35, rest: [3.4, 4.4], flight: [1.2, 1.5], dmg: 0.8 },
  { base: 'lobber', name: 'MADAME LOB', hp: 190, scale: 1.5, body: '#a35bd6', shade: '#7b3fa8', hat: 'witch',
    ammo: 'e_bomb', burst: 2, gap: 0.6, wind: 1.6, rest: [4, 5], flight: [2, 2.5], dmg: 0.75, mark: true },
  { base: 'pitcher', name: 'FASTBALL FRANK', hp: 180, scale: 1.45, body: '#2f7de0', shade: '#235ba8', hat: 'cap',
    ammo: 'e_ball', burst: 1, wind: 1.7, rest: [2.6, 3.4], flight: [0.5, 0.62], dmg: 0.7, errMul: 2.6, laser: true, tired: 1.3 },
  { base: 'guard', name: 'SIR LIDSALOT', hp: 215, scale: 1.55, body: '#7f93ab', shade: '#5b6c82', hat: 'pot',
    ammo: 'e_rock', burst: 1, wind: 1.3, rest: [2.8, 3.6], flight: [1.1, 1.4], dmg: 0.8, shield: 5, enrage: true },
  { base: 'floater', name: 'BARON VON FLOAT', hp: 200, scale: 1.4, body: '#e0508f', shade: '#b03a6e', hat: 'goggles',
    ammo: 'e_dart', fan: 5, spread: 0.15, burst: 1, wind: 1.3, rest: [3.2, 4.2], flight: [0.95, 1.2], dmg: 0.42, balloons: 6 },
  { base: 'brute', name: 'THE WALL', hp: 300, scale: 1.75, body: '#6b7080', shade: '#4d515f', hat: 'horns',
    ammo: 'e_barrel', burst: 1, wind: 1.8, rest: [4.2, 5.2], flight: [1.5, 1.8], dmg: 0.7, resist: 0.55 },
];
// knockouts before the stage boss walks in: 15 on stage 1, two more each stage after
const stageKills = stage => 15 + 2 * (Math.max(1, stage) - 1);

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
  { id: 'crit', name: 'Sweet Spot', icon: 'eye', max: 6, base: 110, grow: 1.65, text: l => `+${l * 3}% CRIT CHANCE`, step: '+3% crit chance' },
  { id: 'stand', name: 'Last Stand', icon: 'shield', max: 1, base: 2500, grow: 1, once: true, text: () => 'ONE SECOND CHANCE EVERY RUN', step: 'survive one knockout per run' },
];
const UPGRADE = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
const upgradeCost = (u, lvl) => Math.round(u.base * Math.pow(u.grow, lvl) / 10) * 10;

/* -------------------------------------------------------------- run perks
   Offered three at a time after every boss; they last until the run ends. */
// `text(n)` describes a card worth n stacks: a rarer card is the same perk, several times over
const PERKS = [
  { id: 'heavy', kind: 'offense', name: 'Heavy Hands', text: n => `+${25 * n}% damage` },
  { id: 'twin', kind: 'offense', name: 'Second Helping', max: 4, text: n => (n === 1 ? 'One throw in four comes out twice' : n >= 4 ? 'Every throw comes out twice' : `${25 * n}% of throws come out twice`) },
  { id: 'skin', kind: 'sustain', name: 'Extra Padding', text: n => `+${35 * n} max health, and heal it now` },
  { id: 'lungs', kind: 'utility', name: 'Deep Breath', text: n => `+${40 * n}% stamina refill` },
  { id: 'leech', kind: 'sustain', name: 'Snack Break', text: n => `Heal ${6 * n} with every knockout` },
  { id: 'eye', kind: 'offense', name: 'Sharp Eye', text: n => `Headshots hit ${50 * n}% harder` },
  { id: 'pop', kind: 'offense', name: 'Loud Exit', text: n => (n === 1 ? 'Knocked-out foes explode' : `Knocked-out foes explode, ${n} times as hard`) },
  { id: 'big', kind: 'offense', name: 'Family Size', text: n => `Everything you throw is ${30 * n}% bigger` },
  { id: 'crate', kind: 'utility', name: 'Special Delivery', text: n => `Mystery crates float by ${n + 1} times as often` },
  { id: 'rich', kind: 'wealth', name: 'Loose Change', text: n => `+${30 * n}% coins` },
  { id: 'shove', kind: 'offense', name: 'Big Shove', text: n => `+${40 * n}% knockback` },
  { id: 'hot', kind: 'offense', name: 'Hot Hands', text: n => (n === 1 ? 'Every hit sets the foe on fire' : `Every hit sets the foe on fire, burning ${n} times as hard`) },
  { id: 'spring', kind: 'utility', name: 'Springy', text: n => `Everything bounces ${n === 1 ? 'one more time' : n + ' more times'}` },
  { id: 'cheap', kind: 'utility', name: 'Light Load', max: 3, text: n => `Throws cost ${20 * n}% less stamina` },
];
/* How rare a card is decides how many stacks of its perk it is worth. `w` is the base chance,
   `up` what each cleared stage adds to it (common takes whatever is left). */
const RARITIES = [
  { id: 'common', name: 'COMMON', n: 1, color: '#aeb6c9' },
  { id: 'rare', name: 'RARE', n: 2, color: '#4fa8ff', w: 0.26, up: 0.01 },
  { id: 'epic', name: 'EPIC', n: 3, color: '#b98cff', w: 0.10, up: 0.01 },
  { id: 'legendary', name: 'LEGENDARY', n: 5, color: '#ffc933', w: 0.03, up: 0.005 },
];
const PERK = Object.fromEntries(PERKS.map(p => [p.id, p]));
const PERK_KIND = { offense: { name: 'OFFENCE', color: '#ff7a3a' }, sustain: { name: 'SURVIVAL', color: '#45e08a' }, utility: { name: 'UTILITY', color: '#4fa8ff' }, wealth: { name: 'WEALTH', color: '#ffc933' } };

/* ----------------------------------------------------------------- themes */
const THEMES = [
  { name: 'Meadow', ridge: 'round', sky: ['#7fc4e8', '#bfe6e2', '#e8f2c8'], hills: ['#8cc79a', '#6fb184', '#4f9a70'], grass: '#8ed65a', grassHi: '#b4ec7a', dirt: '#8a6a4c', dirt2: '#72563d', dirt3: '#5f4732', dark: false },
  { name: 'Sunset', ridge: 'mesa', sky: ['#3d3a78', '#d46a6a', '#ffc27a'], hills: ['#b0647a', '#8a4868', '#5e3358'], grass: '#e0a04a', grassHi: '#f2c06a', dirt: '#7a4a44', dirt2: '#643a38', dirt3: '#4e2c2e', dark: false },
  { name: 'Snowfield', ridge: 'peaks', sky: ['#8aa6d6', '#c6d6ee', '#eef4fb'], hills: ['#c9d8ea', '#a9bfd9', '#8aa5c6'], grass: '#f3f7fc', grassHi: '#ffffff', dirt: '#7d8aa0', dirt2: '#687489', dirt3: '#566074', dark: false },
  { name: 'Night', ridge: 'round', sky: ['#0d1230', '#1e2a5a', '#3a4a7c'], hills: ['#2b3a66', '#1f2b50', '#16203d'], grass: '#4a8f7c', grassHi: '#66b39c', dirt: '#3c3f5c', dirt2: '#30324b', dirt3: '#25273b', dark: true },
  { name: 'Dunes', ridge: 'dunes', sky: ['#e8a25c', '#f4cf8e', '#fbeccb'], hills: ['#e2b676', '#cf9a58', '#b87f44'], grass: '#f0d08a', grassHi: '#fae3ab', dirt: '#b98552', dirt2: '#a06f42', dirt3: '#875b35', dark: false },
  { name: 'Storm', ridge: 'jag', sky: ['#2a3140', '#4a5568', '#77839a'], hills: ['#56637a', '#414d62', '#2f394b'], grass: '#6f9a6a', grassHi: '#8bb586', dirt: '#55505a', dirt2: '#454049', dirt3: '#36323a', dark: true },
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
const MASTERY = [8, 25, 60, 120, 220];     // knockouts with one throwable for each star
const STYLE = {
  head: ['HEADSHOT', 2], ring: ['RING OUT', 4], deflect: ['DEFLECT', 2], long: ['LONG SHOT', 3], air: ['AIRBORNE', 4],
  double: ['DOUBLE KO', 6], trick: ['TRICK SHOT', 4], shatter: ['SHATTER', 3], pop: ['POP!', 2], stop: ['INTERRUPT', 1],
};

/* -------------------------------------------------------------- characters
   Who you throw as. Pure looks: a colour and a hat, bought with coins. */
const CHARACTERS = [
  { id: 'rookie', name: 'Rookie', price: 0, body: '#f7f2e7', shade: '#d3c8b3', accent: null, hat: null },   // the Rookie's headband takes the theme colour
  { id: 'cowboy', name: 'Cowboy', price: 300, body: '#efd9b4', shade: '#cdb088', accent: '#c4642a', hat: 'cowboy' },
  { id: 'viking', name: 'Viking', price: 600, body: '#e9dcc7', shade: '#c9b99f', accent: '#5a86b8', hat: 'viking' },
  { id: 'chef', name: 'Chef', price: 900, body: '#ffffff', shade: '#dcdfe8', accent: '#e2434b', hat: 'chef' },
  { id: 'wizard', name: 'Wizard', price: 1400, body: '#dcd6f5', shade: '#b7afe0', accent: '#7b6cff', hat: 'wizard' },
  { id: 'knight', name: 'Knight', price: 2200, body: '#cfd6e2', shade: '#a6b0c2', accent: '#5b6c82', hat: 'knight' },
  { id: 'pirate', name: 'Pirate', price: 3200, body: '#f1e3c8', shade: '#cfbf9f', accent: '#2d2d3a', hat: 'pirate' },
  { id: 'royal', name: 'Royal', price: 5000, body: '#fff2c4', shade: '#e6d08a', accent: '#ffc933', hat: 'tophat' },
];
const CHAR = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

/* ------------------------------------------------------------ theme colour
   The accent the whole interface is drawn in. Picked in settings; everything
   in the CSS reads it from custom properties, the canvas reads Theme.acc. */
const ACCENTS = [
  { id: 'volt', name: 'Volt', hex: '#c8ff2e' },
  { id: 'orange', name: 'Orange', hex: '#ff9a3c' },
  { id: 'pink', name: 'Pink', hex: '#ff4f93' },
  { id: 'red', name: 'Red', hex: '#ff5a4d' },
  { id: 'purple', name: 'Purple', hex: '#a98bff' },
  { id: 'cyan', name: 'Cyan', hex: '#35e0ff' },
  { id: 'mint', name: 'Mint', hex: '#3dffb0' },
  { id: 'white', name: 'White', hex: '#f2f4fa' },
];
const Theme = {
  id: 'volt', acc: '#c8ff2e',
  set(id) {
    const a = ACCENTS.find(q => q.id === id) || ACCENTS[0];
    this.id = a.id; this.acc = a.hex;
    const n = parseInt(a.hex.slice(1), 16), st = document.documentElement.style;
    st.setProperty('--acc', a.hex);
    st.setProperty('--acc-hi', mixHex(a.hex, '#ffffff', 0.35));
    st.setProperty('--acc-ink', mixHex(a.hex, '#000000', 0.9));
    st.setProperty('--acc-rgb', `${n >> 16}, ${(n >> 8) & 255}, ${n & 255}`);
    st.setProperty('--acc-dim', mixHex('#161a25', a.hex, 0.16));
  },
};

/* Headband colours of the Rookie: each one unlocks with a rank. The last one drifts through the whole spectrum while you play. */
const BANDS = ['#45e08a', '#35e0ff', '#4f8cff', '#8f6bff', '#d05bff', '#ff4f93', '#ff5a4d', '#ff9a3c', '#ffc933', '#f2f4fa', 'prismatic'];
