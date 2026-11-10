# Rag Toss

A ragdoll throwing duel on floating islands. You stand on your island, the other ragdolls stand on theirs, and everybody throws things. Press anywhere, **pull back and let go** to throw. Every thrower is an **active ragdoll**, the same idea as Element Rag: a verlet skeleton held up by muscle springs, so bodies wobble when they're hit, go limp when they're hit hard, and either pick themselves back up or tumble off their island for a **ring-out**.

You don't throw arrows. You throw **stuff**: a rubber chicken, a bowling ball, a beehive, an anvil. There are **18 things to throw**, each with its own gimmick, and you carry three of them into a run. A run never ends on its own: foes keep coming, every 8 knockouts a **boss** walks in, and every boss you beat lets you pick a **perk** before the next stage. Coins from a run buy more stuff and permanent upgrades, so the next run goes further.

It's pure HTML5 and vanilla JS, with no build step and no dependencies. It has the same structure as Element Rag and Slo-Mo: all art is drawn procedurally, every sound is synthesized, and the CrazyGames SDK v3 is wrapped in `js/platform.js`.

To play, serve the folder (for example `python3 -m http.server`) and open `index.html`.

## The game

- **Throwing.** Drag back from anywhere on the screen. The direction of the pull is the direction of the throw, the length is the power, and a dotted line shows the start of the arc. Each throw costs **stamina**, which refills on its own, and there's a short beat between throws. A release that comes a touch early is buffered.
- **Where you hit matters.** Headshots do double damage, limbs do three quarters. Hurt foes fly further when hit, and anyone knocked off their island is out, whatever health they had left.
- **Throws can be thrown at.** Anything a foe throws can be knocked out of the air (DEFLECT). Barrels take two hits.
- **Ducking.** Hold **S** to drop behind your crates. Flat throws sail over you or hit the crates, bombs do half damage. Ducking burns stamina and you can't throw while you're down, so it's a dodge, not a hiding place.
- **Streak.** Every throw that hits something adds one to your streak, worth +10% coins each, up to +100%. A throw that hits nothing resets it.
- **Mystery crates.** A crate on a balloon drifts up the middle of the screen every so often. Pop it for a few free throws of something you don't have in your bag (it gets its own slot, key **4**), or for health or coins.
- **Style.** Knockouts pay extra for HEADSHOT, RING OUT, AIRBORNE, LONG SHOT, TRICK SHOT, DOUBLE KO and SHATTER.

## Stuff to throw

| Item | Gimmick | Coins |
| --- | --- | --- |
| Rock | No tricks. Cheap to throw | free |
| Rubber Chicken | Bounces four times off islands and foes; every bounce adds 50% damage | 150 |
| Boomerang | Cuts through everyone, turns round and cuts through them again. Catch it for the stamina back | 320 |
| Cactus | Sticks in and keeps hurting for five seconds; it stacks | 480 |
| Snowball | Freezes a foe solid. The next hit shatters the ice for double damage | 640 |
| Bowling Ball | Ploughs through bodies, smashes lids and helmets, sends nearly anyone flying | 850 |
| Cutlery | Three forks in a fan, and they stick | 1100 |
| Dynamite | Explodes on anything it touches. The blast ignores lids | 1400 |
| Beehive | Cracks open into six bees that each chase a foe | 1800 |
| Plunger | Sticks on and yanks the foe towards you, usually off their island | 2200 |
| Firework | Ignores gravity, keeps speeding up, bursts and sets foes on fire | 2700 |
| Magnet | Curves towards the nearest foe, rips off helmets and lids, makes them fumble | 3200 |
| Anvil | The moment it's above a foe it stops dead and drops straight down | 3800 |
| Pinata | Pops at the top of its arc and rains nine candies | 4400 |
| Storm Jar | Smashes into lightning that jumps to every foe in reach and stuns them | 5200 |
| Pocket Hole | Opens a hole that drags foes and their throws in, then spits everyone out | 6200 |
| Golden Duck | A knockout with the duck pays triple coins. Bounces once | 7500 |
| Mystery Sack | Every throw is something random, even things you don't own, and hits 30% harder | 9000 |

Items are plain data in `ITEMS` in `js/data.js`. What each one does in the air and on impact lives in `js/game.js` (`TICK` for in-flight behaviour, `onFoeHit` and `hitResolve` for impact). Its picture is a painter in `js/items.js`, which also draws the shop and HUD icons.

## Foes

A new kind shows up in each of the first seven stages. Every foe winds up before throwing: a red ring closes in on its throwing hand, and a hit during the wind-up interrupts the throw.

| Foe | From stage | Behaviour |
| --- | --- | --- |
| Chucker | 1 | Rocks, medium arc |
| Lobber | 2 | High, slow bombs with a blast |
| Pitcher | 3 | Fast, flat fastball. Shows a dashed line before it throws |
| Juggler | 4 | Three pins in a row |
| Lid Guard | 5 | A bin lid blocks three hits from the front; aim for the head or legs, or bring something heavy or explosive. Wears a pot |
| Floater | 6 | Stands on a tiny island held up by three balloons. Pop them all and it drops |
| Brute | 7 | Big, lots of health, hard to knock over, throws barrels |

From stage 3 some foes wear a pot that soaks one headshot, and from stage 4 some islands travel up and down.

**Bosses** are crowned, never get knocked off their feet, throw in bursts and whistle up help: King Chuck, Madame Lob, Fastball Frank, Sir Lidsalot, Baron von Float and The Wall, then round again. When a boss falls, its reinforcements fall with it, you get a quarter of your health back, the sky changes and you pick one of three perks.

## Why you play another run

- **The run itself escalates.** More foes at once (up to four), tougher and more accurate every stage, a new foe type each stage, a boss every 8 knockouts and a new sky after each one.
- **Perks.** Fourteen of them, stackable, offered three at a time after every boss and kept until you're knocked out: Heavy Hands, Second Helping (throws come out twice), Loud Exit (knocked-out foes explode), Hot Hands, Springy, Snack Break and so on.
- **Coins.** Earned per knockout, multiplied by your streak, plus boss bonuses. They're banked as you earn them, so quitting a run keeps them.
- **Stuff and upgrades.** 18 items and nine permanent upgrades: Thick Skull (health), Big Lungs (stamina), Second Breath (refill), Strong Arm (damage), Quick Hands (time between throws), Good Eye (longer aim line), Padding (damage taken), Deep Pockets (coins) and Second Wind (get back up once per run).
- **The results screen always points at the next thing.** It shows the next item you don't own with a bar for how close you are, flags affordable upgrades, and shows your rank bar.
- **Ranks.** Lifetime knockouts move you through eleven ranks, from Butterfingers to The Last Throw. Each rank-up pays coins.
- **Daily missions and a daily reward.** Three missions a day from a pool of ten (resetting at 00:00 UTC) with a 250-coin chest for all three, and a 7-day login streak paying 50 to 400 coins.

## Controls

| Desktop | Action |
| --- | --- |
| Left mouse: press, drag back, release | Aim and throw |
| `S` / `Space` / `Shift` / right mouse (hold) | Duck |
| `1` `2` `3`, `Q` / `E`, wheel | Swap what you throw |
| `4` / `F` | Use a crate's free throws |
| `P` | Pause (Esc is left for leaving fullscreen) |

On touch screens, drag anywhere to throw, hold the DUCK button in the corner, and tap a slot to swap. Each finger is tracked separately, so you can keep a thumb on DUCK.

## Tuning

Everything that sets the difficulty curve is in a handful of one-liners near the top of `js/game.js` (`foeHpMul`, `foeDmgMul`, `staRegen`, `throwCd`) plus `aimAt` (enemy aim error) and `director` (how many foes at once, when the boss arrives). `STAGE_KILLS`, the foe table and the boss table are in `js/data.js`. The current numbers were set with a headless bot that solves the throw arc and plays through the real input path: a fresh save lasts about a minute and reaches stage 2 to 4, and a save with a handful of upgrades reaches stage 6 to 8.

## CrazyGames

This build is set up for a **Basic Launch**: no ads of any kind. `gameplayStart` / `gameplayStop` follow play, pause, perk picks and results, `happytime` fires when a boss falls, and saves go through the SDK data module (with `localStorage` as the fallback, so the game runs unchanged anywhere). For the leaderboard, put the key in `LEADERBOARD_KEY` in `js/platform.js` and the best knockout count gets submitted.

## Project layout

```
index.html
css/style.css     UI: ink panels with cut corners, keycaps, HUD, touch controls
js/util.js        math, seeded RNG, colour helpers, glow sprite cache, two-bone IK
js/platform.js    CrazyGames SDK v3 wrapper: events, happytime, accounts, data (no ads)
js/audio.js       synthesized SFX and a small generative music loop that speeds up with the stage
js/data.js        items, enemy ammo, foes, bosses, upgrades, perks, themes, missions, ranks
js/progress.js    save data, bag, upgrades, daily missions, login streak, ranks
js/items.js       procedural art for every throwable; also the shop and HUD icons
js/world.js       floating islands (blocky tile pyramids) and the painted backdrops
js/ragdoll.js     Rag: active ragdoll, throw / duck poses, tumble and recover, hit tests
js/fx.js          particles, rings, lightning, flying debris, combat text
js/game.js        throwing, item gimmicks, foe AI, knockback and ring-outs, stages, bosses, perks, rendering
js/icons.js       UI icons
js/ui.js          home, stuff shop and bag, upgrades, missions, rank, pause, perk picks, results, HUD, coaching
js/main.js        boot, loop, pointer and keyboard input
assets/fonts/     Rubik (SIL Open Font License)
```

## Credits

Font: [Rubik](https://fonts.google.com/specimen/Rubik) by Hubert and Fischer, under the SIL Open Font License 1.1.
