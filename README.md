# Rag Toss

A ragdoll throwing duel on floating islands. You stand on your island, the other ragdolls stand on theirs, and everybody throws things. Press anywhere, **pull back and let go** to throw. Every thrower is a **physical ragdoll that can also stand**: a verlet skeleton with mass, collision radii and one-way knee and elbow hinges, held up by muscle springs. Nothing about a hit is scripted. A throw pushes the bone it lands on, the muscles go soft for a moment, the body bends around the blow and the feet shuffle to catch up. Push the hips past the edge of the island or tip the trunk too far and the body lets go and falls limp, either onto the island (it gets back up) or off it for a **ring-out**.

You don't throw arrows. You throw **stuff**: a rubber chicken, a bowling ball, a beehive, an anvil. There are **26 things to throw**, each with its own gimmick, and you carry three of them into a run. A run never ends on its own: foes keep coming, every 8 knockouts a **boss** walks in, and every boss you beat lets you pick a **perk** before the next stage. Coins from a run buy more stuff and permanent upgrades, so the next run goes further.

It's pure HTML5 and vanilla JS, with no build step and no dependencies. It has the same structure as Element Rag and Slo-Mo: all art is drawn procedurally, every sound effect is synthesized (the music is one mp3), and the CrazyGames SDK v3 is wrapped in `js/platform.js`.

To play, serve the folder (for example `python3 -m http.server`) and open `index.html`.

The very first launch boots **straight into the tutorial**: a four-step, skippable walk-through on the real field (land a throw, knock the foe out, duck a throw, knock out one that fights back) that carries on into stage 1. Every launch after that opens on the home screen.

## The game

- **Throwing.** Drag back from anywhere on the screen. A dashed ring shows how far a full-power pull reaches, two elastic strands run from where you pressed to a knob that shows the power as a number (and stops at MAX), an arrow on the far side points the way the throw will go, and a line of dots ending in an arrowhead shows the start of the arc. There's a short beat between throws, and a release that comes a touch early is buffered. The thrower animates through the whole throw: weight sinks onto the back foot as you pull, the hand goes behind the head, then the arm whips through with an overshoot, the front foot plants and the back heel drives up. The item leaves the hand at the top of the whip, with speed lines, a ring and dust at the planted foot. A faint reticle shows where the arc would land, red when it's on a foe, and on release the elastic snaps back past the anchor.
- **Stamina.** A pool of 200 with small costs. A throw takes 4 to 14 points depending on what it is, holding a wind-up sips 2.5 a second, a duck is a flat 5, and it refills by itself the whole time. You only run dry by spamming the heavy stuff.
- **Where you hit matters.** Headshots do double damage, limbs do three quarters. Hurt foes fly further when hit, and anyone knocked off their island is out, whatever health they had left.
- **Throws can be thrown at.** Anything a foe throws can be knocked out of the air (DEFLECT). Barrels take two hits.
- **Ducking.** Hold **S** to drop behind your crates. Flat throws sail over you or hit the crates, bombs do half damage. A duck costs 5 stamina, lasts up to a second and a half, and you can't throw while you're down, so it's a dodge, not a hiding place.
- **Streak.** Every throw that hits something adds one to your streak, worth +10% coins each, up to +100%. A throw that hits nothing resets it.
- **Mystery crates.** A crate on a balloon drifts up the middle of the screen every so often. Pop it for a few free throws of something you don't have in your bag (it gets its own slot, key **4**), or for health, stamina or coins. Health and stamina are a 15% chance each, rising to 25% as that bar runs low (35% of your health back, or half your stamina).
- **Style.** Knockouts pay extra for HEADSHOT, RING OUT, AIRBORNE, LONG SHOT, TRICK SHOT, DOUBLE KO and SHATTER.

## Stuff to throw

| Item | Gimmick | Coins |
| --- | --- | --- |
| Rock | No tricks. Cheap to throw | free |
| Rubber Chicken | Bounces four times off islands and foes; every bounce adds 50% damage | 150 |
| Cream Pie | Splats in the face and blinds the foe: their throws go wildly off target for five seconds | 230 |
| Boomerang | Cuts through everyone, turns round and cuts through them again. Catch it for the stamina back | 320 |
| Throwing Knife | Fast and flat. A headshot hits four times as hard. Sticks where it lands | 400 |
| Cactus | Sticks in and keeps hurting for five seconds; it stacks | 480 |
| Hot Sauce | Smashes open and sets the foe on fire for five seconds | 560 |
| Snowball | Freezes a foe solid. The next hit shatters the ice for double damage | 640 |
| Slime | Sticky goo that halves how fast a foe winds up and throws, for six seconds | 740 |
| Bowling Ball | Ploughs through bodies, smashes lids and helmets, sends nearly anyone flying | 850 |
| Frying Pan | CLANG. Stuns a foe for a second and a half and smashes any lid they hold | 980 |
| Cutlery | Three forks in a fan, and they stick | 1100 |
| Boxing Glove | A spring-loaded punch. Short range, almost instant, with a huge knockback | 1250 |
| Dynamite | Explodes on anything it touches. The blast ignores lids | 1400 |
| Beach Ball | Big, bouncy and floaty. Whatever it hits is thrown straight up | 1600 |
| Beehive | Cracks open into six bees that each chase a foe | 1800 |
| Plunger | Sticks on and yanks the foe towards you, usually off their island | 2200 |
| Firework | Ignores gravity, keeps speeding up, bursts and sets foes on fire | 2700 |
| Magnet | Curves towards the nearest foe, rips off helmets and lids, makes them fumble | 3200 |
| Glue Bomb | Sticks to whatever it hits, then goes off a second and a half later | 3500 |
| Anvil | The moment it's above a foe it stops dead and drops straight down | 3800 |
| Pinata | A donkey that pops at the top of its arc and rains nine candies | 4400 |
| Storm Jar | Smashes into lightning that jumps to every foe in reach and stuns them | 5200 |
| Pocket Hole | Opens a hole that drags foes and their throws in, then spits everyone out | 6200 |
| Golden Duck | A knockout with the duck pays triple coins. Bounces once | 7500 |
| Mystery Sack | Every throw is something random, even things you don't own, and hits 30% harder | 9000 |

Items are plain data in `ITEMS` in `js/data.js`. What each one does in the air and on impact lives in `js/game.js` (`TICK` for in-flight behaviour, `onFoeHit` and `hitResolve` for impact). Its picture is a painter in `js/items.js`, which also draws the shop and HUD icons.

## Foes

A new kind shows up in each of the first seven stages. Every foe winds up before throwing: a red ring closes in on its throwing hand, and a hit during the wind-up interrupts the throw. Every hit ragdolls the body, whatever it was thrown with: the muscles switch off, the bone that was struck takes the impulse, the foe drops limp, slides and gets back up (a heavier throw keeps it down longer and sends it further, and off the edge if it goes far enough). Bosses are too big to fall, so they bend hard around the blow instead. Foes' islands are wide, but a few plain hits in a row will still slide a foe over the edge (about three rocks), and a heavy throw does it at once. You go limp too when a real blow lands (and not twice within a few seconds) and can't throw until you're back on your feet. Islands with nobody on them fall away at once.

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

**Bosses** are crowned and heavy enough that they never lose their footing, and each one fights differently. When a boss falls, its reinforcements fall with it, you get a quarter of your health back, the sky changes and you pick one of three perks.

| Boss | Pattern |
| --- | --- |
| King Chuck | A fan of three rocks, slowly |
| Madame Lob | Two bombs per throw, with a red circle on the floor showing where each one will land |
| Fastball Frank | Very fast pitches after a long wind-up with a dashed aim line, then he is winded for a second and a half |
| Sir Lidsalot | Hides behind five lids. Break them all and he enrages and throws faster |
| Baron von Float | His island bobs high and low and he throws a fan of five darts. Pop his six balloons to drop him |
| The Wall | Slow barrels, and he shrugs off light throws: bring something heavy or explosive |

## Why you play another run

- **The run itself escalates.** More foes at once (up to four), tougher and more accurate every stage, a new foe type each stage, a boss after 15 knockouts (two more each stage after that) and a new sky after each one.
- **Perks.** Fourteen of them, offered three at a time after every boss (click, or press 1, 2 or 3), stackable and kept until you're knocked out. Each card rolls a rarity, and a rarer card is the same perk several times over: Common x1, Rare x2, Epic x3, Legendary x5 (about 58% / 27% / 11% / 3.5% early on, with the rare ones a little likelier each stage).
- **Runs are saved.** Quitting from the pause menu (or closing the tab) keeps your stage, knockouts, perks, health and the bag you started with (changing your loadout only applies to the next new run). The home screen then says CONTINUE, with a smaller button to start over. Dying ends the saved run.
- **Frenzy.** Every tenth hit in a row lights you up for seven seconds: throws cost no stamina, come out faster and every knockout pays double. The streak chip shows ten pips filling toward the next one.
- **Bounties.** One small job at a time in the top-left corner (three headshots, a x5 streak, two knockouts with the chicken, a close call), paid on the spot. Each one is worth a little more than the last.
- **Golden ragdolls.** Now and then a golden one drifts in. It never fights back, it leaves after nine seconds, and knocking it out is a jackpot.
- **Last stand.** A one-time 600-coin unlock on the Upgrades screen. With it, once a run, the blow that would finish you leaves you standing in slow motion. Land a throw before the bar runs out and you are back at 35% health.
- **Mastery.** Every throwable earns up to five stars from knockouts (8, 25, 60, 120, 220). Each star is +5% damage with it, for good.
- **Small things.** Coins fly from a knockout to the counter, which rolls up. About one hit in eleven is a crit (the Sweet Spot upgrade adds 3% per level). A throw that just misses you is a close call and gives stamina back. The counter shows your best and tells you when you are three away from beating it.
- **Coins.** Earned per knockout, multiplied by your streak, plus boss bonuses. They're banked as you earn them, so quitting a run keeps them.
- **Characters.** Eight to wear (Rookie, Cowboy, Viking, Chef, Wizard, Knight, Pirate, Royal), each with its own colour and hat, bought with coins on the Characters tab of the Stuff screen. They are looks only; nothing about throwing changes.
- **Stuff and upgrades.** 26 items and ten permanent upgrades: Thick Skull (health), Big Lungs (stamina), Second Breath (refill), Strong Arm (damage), Quick Hands (time between throws), Good Eye (longer aim line), Padding (damage taken), and Deep Pockets (coins).
- **The results screen always points at the next thing.** It shows the next item you don't own with a bar for how close you are, flags affordable upgrades, and shows your rank bar.
- **Ranks.** Lifetime knockouts move you through eleven ranks, from Butterfingers to The Last Throw. Each rank-up pays coins.
- **Missions.** Three at a time from a pool of ten, refreshed at 00:00 UTC, with a 250-coin chest for finishing all three. There is no login reward.

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

There are **no ads of any kind** in this build (a Basic Launch): `gameplayStart` / `gameplayStop` follow play, pause, perk picks and results, `happytime` fires when a boss falls, and saves go through the SDK data module (with `localStorage` as the fallback, so the game runs unchanged anywhere). For the leaderboard, put the key in `LEADERBOARD_KEY` in `js/platform.js` and the best knockout count gets submitted.

## Project layout

```
index.html
css/style.css     UI: ink panels with cut corners, keycaps, HUD, touch controls
js/util.js        math, seeded RNG, colour helpers, glow sprite cache, two-bone IK
js/platform.js    CrazyGames SDK v3 wrapper: events, happytime, accounts, data (no ads)
js/audio.js       synthesized SFX, and the music track (assets/music.mp3) that speeds up with the stage
js/data.js        items, enemy ammo, foes, bosses, upgrades, perks, themes, missions, ranks
js/progress.js    save data, bag, upgrades, missions, ranks
js/items.js       procedural art for every throwable; also the shop and HUD icons
js/world.js       floating islands (blocky tile pyramids) and the backdrop: a sky gradient and hills
js/ragdoll.js     Rag: physical ragdoll (radii, hinges, friction), standing poses, daze, balance, toppling, hit tests
js/fx.js          particles, rings, lightning, flying debris, combat text
js/game.js        throwing, item gimmicks, foe AI, knockback and ring-outs, stages, bosses, perks, rendering
js/icons.js       UI icons
js/ui.js          home, stuff shop and bag, upgrades, missions, rank, pause, perk picks, results, HUD, tutorial panel
js/main.js        boot, loop, pointer and keyboard input
assets/fonts/     Rubik (SIL Open Font License)
crazygames/       listing trailers: 1920x1080 landscape and 1080x1680 portrait, 19 s, 30 fps, H.264 + AAC
```

## Privacy

The game collects nothing: progress lives in the player's own browser (or the CrazyGames save system), with no accounts, ads or trackers. The policy is `privacy.html`, linked from the settings screen and the home screen.

## Credits

Music: "Scurry and Slide" (`assets/music.mp3`), supplied by the game's author.

Font: [Rubik](https://fonts.google.com/specimen/Rubik) by Hubert and Fischer, under the SIL Open Font License 1.1.
