# SURVIVE 10

A lightweight browser survival game built with **Phaser 3**, vanilla **HTML/CSS/JS**, and zero build step. Survive 10 minutes of an abandoned city against escalating waves of enemies, then beat the final boss.

No backend, no database, no accounts, no bundler. It runs from static files.

---

## 1. Project structure

```
survive10/
├── index.html          # Page shell: Phaser canvas mount + all DOM UI overlays
├── style.css            # All visual styling (menus, HUD, level-up cards, etc.)
├── README.md
└── js/
    ├── config.js         # ALL tunable numbers live here (stats, spawn tables, colors)
    ├── audio.js          # Procedural WebAudio sound effects + music (no audio files needed)
    ├── save.js           # localStorage wrapper (best score, settings, etc.)
    ├── player.js         # Player stats, movement, leveling, damage
    ├── weapons.js         # Auto-targeting weapon + projectiles
    ├── enemy.js           # Enemy class, spawner/manager, experience orbs
    ├── boss.js            # Final boss: phases + attack patterns
    ├── upgrades.js       # The 12-upgrade pool used by the level-up screen
    ├── ui.js              # All DOM UI (menus, HUD, panels) - talks to the game only via EventBus
    └── game.js            # Phaser scenes (Boot / Menu / Game) + texture generation + game boot
```

There is no `assets/` folder in this version — every sprite is generated at
runtime from `js/game.js` using Phaser's `Graphics.generateTexture()`, and
every sound is synthesized at runtime by `js/audio.js` using the Web Audio
API. This keeps the repository dependency-free and instantly deployable.
See section 5 for how to swap in real art/audio later.

---

## 2. Run it locally

Because the game uses ES6 classes and `fetch`-like module loading rules in
some browsers, open it through a small local web server rather than
double-clicking `index.html` (double-clicking usually works too, but a
server avoids any browser `file://` restrictions).

Pick any one of these:

```bash
# Python 3 (built into most systems)
cd survive10
python3 -m http.server 8080
# then open http://localhost:8080

# Node.js
npx serve .

# VS Code
# Install the "Live Server" extension, right-click index.html, "Open with Live Server"
```

No `npm install` is required — Phaser is loaded from a CDN `<script>` tag in
`index.html`.

---

## 3. Upload to GitHub

```bash
cd survive10
git init
git add .
git commit -m "Initial commit: SURVIVE 10"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

---

## 4. Deploy to Render (Static Site)

1. Push the project to GitHub (step 3).
2. In the Render dashboard: **New → Static Site**.
3. Connect your GitHub repository.
4. Settings:
   - **Build Command:** *(leave empty — there is nothing to build)*
   - **Publish Directory:** `.` (the repository root, since `index.html` lives there)
5. Click **Create Static Site**. Render will serve `index.html` at the root
   URL automatically.

All asset paths in the project are relative (`js/config.js`, `style.css`,
etc.) and Phaser is loaded from a public CDN, so nothing needs to change
between local dev and the deployed Render URL.

---

## 5. Using your own art ("models")

Every visual in the game — the player, all 5 enemy types, the boss, and
every environment prop — is loaded automatically from a fixed set of file
paths. **You don't need to write any code to swap them.** Just drop a
correctly named image into the matching folder:

| What | File to add |
|---|---|
| Player | `assets/player/player.png` |
| Basic enemy | `assets/enemies/basic.png` |
| Fast enemy | `assets/enemies/fast.png` |
| Tank enemy | `assets/enemies/tank.png` |
| Ranged enemy | `assets/enemies/ranged.png` |
| Elite enemy | `assets/enemies/elite.png` |
| Boss | `assets/boss/boss.png` |
| Building | `assets/environment/building.png` |
| Car | `assets/environment/car.png` |
| Wrecked car | `assets/environment/carwreck.png` |
| Tree | `assets/environment/tree.png` |
| Street light | `assets/environment/streetlight.png` |
| Debris | `assets/environment/debris.png` |
| Orbital blade | `assets/weapons/blade.png` |

The full list (including exact filenames) lives in `CONFIG.ASSETS` in
`js/config.js` — that's the single source of truth `BootScene` reads from.

**Any image resolution or aspect ratio works.** `BootScene` (in
`js/game.js`) loads whatever you provide, then "bakes" it into a texture
of the exact size the game expects using an offscreen `RenderTexture`
before the run starts — so a 4000×4000 painting and a 64×64 pixel-art
icon both just work, scaled to fit. Nothing else in the codebase needs to
change or even know an image was swapped in. Note that this scales to
*fill* the target size exactly (it doesn't letterbox), so an image whose
aspect ratio doesn't match the table above (e.g. a square image used for
the car, which is wide) will look stretched — crop/pad your source image
to roughly match the target width/height if that matters to you.

**Nothing is required.** Any file that's missing, wrongly named, or fails
to load falls back to the original placeholder shape for that one asset
— everything else keeps using whatever you *did* provide. Check the
browser console if something doesn't look right; a failed load logs the
path it tried.

To add a texture for something not in the table above (e.g. custom
projectile art), add an entry to `CONFIG.ASSETS` with a `key`, `path`,
and logical `width`/`height` in pixels, and add a matching placeholder
generator function in `BootScene.create()` in `js/game.js` (copy the
shape of any existing one, e.g. `env_debris`) so there's still a fallback
if that file is missing.

**Sound works the same way** — see section 5a below.

---

## 5a. Using your own sounds

Every sound effect and the background music loop works exactly like the
art above: drop a correctly named file into `assets/audio/` and it's used
automatically, with no code changes.

| Sound | File to add |
|---|---|
| Weapon fire | `assets/audio/weapon_fire.mp3` |
| Enemy hit | `assets/audio/enemy_hit.mp3` |
| Enemy death | `assets/audio/enemy_death.mp3` |
| Experience pickup | `assets/audio/exp_pickup.mp3` |
| Level up | `assets/audio/level_up.mp3` |
| Upgrade selected | `assets/audio/upgrade_select.mp3` |
| Player takes damage | `assets/audio/player_damage.mp3` |
| Boss appears | `assets/audio/boss_appear.mp3` |
| Boss attacks | `assets/audio/boss_attack.mp3` |
| Victory | `assets/audio/victory.mp3` |
| Game over | `assets/audio/game_over.mp3` |
| UI click | `assets/audio/ui_click.mp3` |
| Background music (loops) | `assets/audio/music_loop.mp3` |

The full list lives in `CONFIG.SOUND_ASSETS` in `js/config.js`. `BootScene`
loads each one; whichever ones load, `AudioManager` (`js/audio.js`) plays
that file through Phaser's sound manager instead of its synthesized
version — per cue, so you can replace just a few and leave the rest as
the built-in Web Audio sounds. Both the Sound Effects and Music sliders
in Settings apply to real files the same as synthesized ones.

To add a sound for something not in the table (e.g. a new weapon's own
cue), add an entry to `CONFIG.SOUND_ASSETS` with a `key` and `path`, then
call `this._play('yourKey', () => { /* fallback synth cue */ })` from a
new method in `AudioManager` — see any existing cue (e.g. `uiClick()`)
for the pattern.

---

## 6. How to modify enemies

Open `js/config.js` and edit `CONFIG.ENEMY_TYPES`. Each entry is a plain
object:

```js
basic: {
  key: 'basic',
  label: 'Shambler',
  color: 'basic',       // must match a key in CONFIG.COLORS
  radius: 16,
  speed: 70,
  health: 20,
  damage: 6,
  expValue: 5,
  scoreValue: 10,
  contactCooldownMs: 700,
  knockbackResist: 1.0  // 0 = immune, 1 = full knockback from CONFIG.KNOCKBACK.baseSpeed
}
```

To add a **new enemy type**:

1. Add an entry to `CONFIG.ENEMY_TYPES` with a unique key (e.g. `swarmer`).
2. Add a matching color to `CONFIG.COLORS` (e.g. `swarmer: 0x...`).
3. Generate its texture in `BootScene.create()` in `js/game.js` (copy one of
   the existing shape blocks, e.g. the diamond for "fast").
4. Reference the new key's weight inside `CONFIG.PHASES[n].types` so it
   actually spawns during that time window.

To change **difficulty pacing**, edit `CONFIG.PHASES` — each phase controls
spawn rate, which enemy types can appear and their weighting, and health/
damage multipliers for that time window.

---

## 7. How to add weapons

`js/weapons.js` has two weapons now: `Weapon` (the auto-targeting "Scrap
Blaster", always active from the start) and `OrbitWeapon` (a ring of
blades that circles the player and damages anything it touches — the
second weapon, unlocked through the normal level-up upgrade pool rather
than being available from the start). `OrbitWeapon` is a real, working
example of the pattern described below — read it alongside these steps
if you want a concrete reference.

To add a third weapon:

1. Create a new class (e.g. `class ShotgunWeapon { ... }`) with the same
   shape: a constructor taking `(scene)`, and an `update(delta, player,
   enemyManager, boss)` method that fires/acts when appropriate. Read
   live stats straight from `player.stats` each frame rather than keeping
   your own copies (see how `OrbitWeapon` reads `orbitCount`/`orbitDamage`)
   so upgrades affect it automatically.
2. In `GameScene.create()` (`js/game.js`), instantiate it alongside
   `this.weapon` / `this.orbitWeapon` and call its `update()` in
   `GameScene.update()`.
3. If you want it to start locked like `OrbitWeapon` does, add an
   `xUnlocked` flag to `Player.stats` (in `js/player.js`) and an unlock
   upgrade with an `available(stats)` guard in `js/upgrades.js` — see
   `orbitUnlock` for the exact pattern, including how follow-up upgrades
   (`orbitBlade`, `orbitDamage`) only appear once it's unlocked.
4. If it needs its own sprite, add it to `CONFIG.ASSETS` in `js/config.js`
   (see section 5) so it gets the same automatic custom-art loading and
   placeholder fallback as everything else.

---

## 8. How to add upgrades

Open `js/upgrades.js` and add a new object to the `UPGRADE_POOL` array:

```js
{
  id: 'myNewUpgrade',
  name: 'DISPLAY NAME',
  describe: (v) => `Some stat: ${v}`,
  format: 'What this upgrade does, shown on the card',
  apply(stats) { stats.someField = /* mutate it */; }
}
```

Then add a matching `case 'myNewUpgrade': return stats.someField;` line to
`UpgradeSystem._statValueFor()` in the same file so the level-up card can
show a "before → after" preview. That's the only other place that needs to
know about it — the level-up screen automatically includes it in the random
pool of three choices.

If the upgrade should only be offered conditionally (a follow-up upgrade
that only makes sense once something else is unlocked, or one that should
stop appearing past a cap), add an `available(stats)` predicate returning
`true`/`false` — see `orbitUnlock`/`orbitBlade`/`orbitDamage` for a working
example (a weapon-unlock upgrade, a follow-up that only appears once
unlocked, and one that also caps out). Upgrades with no `available()` are
always offered, same as before.

---

## 9. Design notes

- **Environment objects (buildings, cars, trees, streetlights, wreckage)
  are decorative only** — they have no collision. This was a deliberate
  choice so the arena stays readable during frantic combat, per the brief's
  requirement that atmosphere must never make combat hard to follow.
- **The boss reuses the same `Enemy`-shaped interface** (`.alive`,
  `.sprite`, `.takeDamage()`) so the player's weapon and projectile
  collision code do not need any special-casing to damage it.
- All game/UI communication goes through a single `EventBus`
  (`Phaser.Events.EventEmitter`, defined in `config.js`) — `ui.js` never
  touches a Phaser object, and the Phaser scenes never touch the DOM
  directly. This makes it straightforward to swap the whole UI layer later
  without touching gameplay code.

---

## 10. Character loadouts

Before each run, the player picks a survivor on the character-select
screen (Main Menu → PLAY). Each one is a small set of stat multipliers
applied once, at the start of the run, defined in `CONFIG.CHARACTERS`
in `js/config.js`:

```js
{
  id: 'scavenger',
  name: 'SCAVENGER',
  tagline: 'Finds an edge in everything.',
  summary: 'Experience +40% · Max health -15%',
  mods: { expMultiplier: 1.4, maxHealth: 0.85 }
}
```

`mods` keys must match a field on `Player.stats` (see `js/player.js`) —
each one is multiplied by its factor via `Player.applyLoadout()`. To add
a fourth survivor, add an entry to the array; the character-select
screen picks it up automatically (`js/ui.js` renders one card per
`CONFIG.CHARACTERS` entry, no other wiring needed). The chosen
character persists across TRY AGAIN / PLAY AGAIN restarts, and resets
back to a fresh pick whenever the player returns to the Main Menu.

---

## 11. In-game settings (audio + performance)

Settings are reachable from the Main Menu **and** from the Pause menu
mid-run (ESC → SETTINGS), so the player never has to quit a run to
adjust them:

- **Sound effects / Music** — two 0–100 sliders, backed by
  `AudioManager.sfxVolume` / `musicVolume` in `js/audio.js`. Dragging
  the music slider live-updates the running background loop's gain
  node rather than restarting it.
- **Performance mode** — a single toggle, persisted as
  `graphicsQuality: 'high' | 'low'` in `js/save.js`. When enabled it:
  - spaces decorative props (buildings/cars/trees/etc.) further apart
    in `buildArena()`, roughly halving draw calls;
  - halves hit/death particle counts in `GameScene.spawnHitEffect` /
    `spawnDeathEffect`;
  - disables camera shake entirely (`GameScene.shakeCamera()` is a
    no-op when performance mode is on — every shake in the codebase,
    including the player/boss ones, is routed through this one method
    so there's a single place to extend if you add more effects later).

  Toggling it mid-run applies immediately via a `graphics-quality-changed`
  event — no restart needed.

All settings are persisted in the same `localStorage` blob as best-run
stats (see `CONFIG.SAVE_KEY`), so they carry over between sessions.

---

## 12. Enemy road-following navigation

Enemies stay on the streets instead of beelining through buildings.
The world's roads (drawn in `buildArena()` in `js/game.js`) form a full
lattice — every vertical road crosses every horizontal one — so any two
points are connected by at most one turn at an intersection. `roadWaypoint()`
in `js/enemy.js` uses that to pick the next waypoint fresh every frame
(no stored path, so it always reacts instantly if the player moves):

1. If the enemy isn't on a road yet, head for whichever road line is closer.
2. If it's on exactly one road, drive along it toward the road that
   crosses nearest the player.
3. At an intersection, turn onto whichever axis still needs covering.

Once an enemy gets within `CONFIG.ROAD_LOGIC.chaseRadius` (220px by
default) of the player, it breaks off the road network and chases
directly — that's the "cut across near you" behavior. Ranged enemies use
their own `shootRange` as that cutoff instead, so they navigate the
roads until they're close enough to start kiting and shooting.

Two things worth knowing if you extend this:

- **The boss ignores road logic entirely** — it already has its own
  movement/attack pattern (chase, charge, summon) and a big set-piece
  encounter reads better without it stopping to take corners.
- **Both constants live in `CONFIG.WORLD`** (`LANE_SPACING`,
  `ROAD_HALF_WIDTH`) so the road *graph* enemies navigate always matches
  the road *grid* `buildArena()` actually draws — if you change one you
  don't need to touch the other, they read from the same source.

---

## 13. Performance: enemy cap, pooling, and stragglers

Three things keep the game running smoothly regardless of how the run
goes, all in `js/enemy.js`:

- **Hard cap.** `CONFIG.PERFORMANCE.maxEnemies` (120 by default) bounds
  how many enemies can exist at once — both the normal wave spawner and
  the boss's minion summons stop spawning once it's hit, resuming as soon
  as the count drops back below it.
- **Straggler despawn.** Any enemy that ends up more than
  `CONFIG.PERFORMANCE.stragglerDespawnDistance` (2200px) from the player —
  typically one that got stuck on a long road detour — is quietly removed
  with no effects, no exp, no score. It wasn't a meaningful threat at that
  distance anyway, and this keeps the population from slowly filling up
  with enemies that can never actually catch up over a 10-minute run.
- **Pooling.** Enemies are never actually destroyed. When one dies or gets
  despawned, `Enemy.retire()` hides its sprite and hands the same instance
  back to `EnemyManager.pool` instead of calling `.destroy()`; the next
  spawn calls `EnemyManager.spawnAt()`, which reuses a pooled instance
  (via `Enemy.reset()`) before ever creating a new one. In practice the
  game ends up allocating at most `maxEnemies` worth of sprites for the
  *entire* run, no matter how many total enemies get spawned and killed.

If you add a system that keeps its own per-enemy state (`OrbitWeapon`'s
hit-cooldown map is an example already in the codebase), remember that a
revived instance reuses the same object reference as its previous life —
clear or ignore stale entries keyed by that reference when an enemy is
revived (see the `orbitWeapon.lastHit.delete(enemy)` call in
`EnemyManager.spawnAt()`), or old state can leak into a "new" enemy.
