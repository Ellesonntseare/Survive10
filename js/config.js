/**
 * config.js
 * ---------
 * Every tunable number in the game lives here. Nothing else in the
 * project should contain a "magic number" for balance -- if you want
 * to change how the game feels, this is the file to open.
 */

// A single shared event bus so DOM UI, Phaser scenes and game systems
// can talk to each other without holding direct references.
const EventBus = new Phaser.Events.EventEmitter();

const CONFIG = {
  WORLD: {
    WIDTH: 3200,
    HEIGHT: 3200,
    TILE: 128,
    LANE_SPACING: 480,   // spacing of the road lattice drawn in buildArena()
    ROAD_HALF_WIDTH: 48  // how close to a road line counts as "on the road"
  },

  RUN_DURATION_MS: 10 * 60 * 1000, // exactly 10 minutes

  // Space bar fires an immediate bonus shot on top of the weapon's normal
  // auto-fire, on its own separate cooldown so it can't just be spammed.
  MANUAL_FIRE_COOLDOWN_MS: 400,

  // Caps how much work the game has to do at once so late-run performance
  // stays smooth regardless of build/kill rate. See EnemyManager in
  // enemy.js -- enemies are pooled (reused, not destroyed/recreated) and
  // stragglers left far behind get quietly recycled rather than piling up.
  PERFORMANCE: {
    maxEnemies: 120,
    stragglerDespawnDistance: 2200
  },

  KNOCKBACK: {
    baseSpeed: 260,
    durationMs: 120
  },

  // Strict road-following: enemies navigate along the road lattice and
  // only break off to chase the player directly once within this range.
  ROAD_LOGIC: {
    chaseRadius: 220
  },

  // Second weapon: a ring of blades orbiting the player, unlocked and
  // upgraded through the normal level-up upgrade pool (see upgrades.js).
  // radius/rotationSpeed/hitCooldownMs are fixed; damage/count scale via
  // Player.stats.orbitDamage / orbitCount.
  ORBIT_WEAPON: {
    radius: 70,
    rotationSpeed: 2.4,   // radians per second
    hitCooldownMs: 350,   // per-enemy cooldown so one blade can't hit-lock a target
    baseDamage: 8,
    maxBlades: 6
  },

  // Pre-run loadouts, picked on the character-select screen. Each `mods`
  // entry is a multiplier applied once, on top of PLAYER_BASE, when the
  // run starts (see Player.applyLoadout in player.js).
  CHARACTERS: [
    {
      id: 'scavenger',
      name: 'SCAVENGER',
      tagline: 'Finds an edge in everything.',
      summary: 'Experience +40% · Max health -15%',
      mods: { expMultiplier: 1.4, maxHealth: 0.85 }
    },
    {
      id: 'brawler',
      name: 'BRAWLER',
      tagline: 'Built to take the hit and give it back.',
      summary: 'Max health +30% · Damage +20% · Move speed -15%',
      mods: { maxHealth: 1.3, damage: 1.2, moveSpeed: 0.85 }
    },
    {
      id: 'runner',
      name: 'RUNNER',
      tagline: 'Never stops moving, never lets up.',
      summary: 'Move speed +25% · Attack speed +20% · Max health -10%',
      mods: { moveSpeed: 1.25, attackSpeed: 1.2, maxHealth: 0.9 }
    }
  ],

  COLORS: {
    // Hazard / abandoned-city palette
    bgAsphalt: 0x1b2023,
    bgAsphaltLine: 0x2a3236,
    building: 0x2c3438,
    buildingDark: 0x20262a,
    treeCanopy: 0x2f4a35,
    treeTrunk: 0x4a3524,
    carBody: 0x54606a,
    carWreck: 0x3a2a26,
    streetLight: 0xb8a15a,
    player: 0x7fe07d,
    playerOutline: 0x2f4a35,
    basic: 0xb85450,
    fast: 0xe0c34c,
    tank: 0x6a5acd,
    ranged: 0x4cc0e0,
    elite: 0xe07f3b,
    boss: 0xc43b3b,
    projectilePlayer: 0xf2a93b,
    projectileEnemy: 0xe0524c,
    exp: 0x7fe0c9,
    hazardAmber: 0xf2a93b,
    hazardRed: 0xc43b3b
  },

  PLAYER_BASE: {
    maxHealth: 100,
    moveSpeed: 220,
    damage: 10,
    attackSpeed: 1.0,      // shots per second
    attackRange: 260,
    projectileSpeed: 480,
    projectileSize: 1.0,   // multiplier
    critChance: 0.05,      // 5%
    projectileCount: 1,
    expMultiplier: 1.0,
    radius: 18
  },

  // Experience required to reach level N (index = level, starting level 1)
  expForLevel(level) {
    return Math.round(20 + level * level * 8 + level * 12);
  },

  ENEMY_TYPES: {
    basic: {
      key: 'basic',
      label: 'Shambler',
      color: 'basic',
      radius: 16,
      speed: 70,
      health: 20,
      damage: 6,
      expValue: 5,
      scoreValue: 10,
      contactCooldownMs: 700,
      knockbackResist: 1.0
    },
    fast: {
      key: 'fast',
      label: 'Sprinter',
      color: 'fast',
      radius: 13,
      speed: 165,
      health: 14,
      damage: 5,
      expValue: 6,
      scoreValue: 14,
      contactCooldownMs: 600,
      knockbackResist: 1.0
    },
    tank: {
      key: 'tank',
      label: 'Hulk',
      color: 'tank',
      radius: 26,
      speed: 45,
      health: 140,
      damage: 16,
      expValue: 18,
      scoreValue: 40,
      contactCooldownMs: 900,
      knockbackResist: 0.25
    },
    ranged: {
      key: 'ranged',
      label: 'Spitter',
      color: 'ranged',
      radius: 15,
      speed: 60,
      health: 26,
      damage: 8,
      expValue: 10,
      scoreValue: 22,
      contactCooldownMs: 700,
      preferredDistance: 320,
      shootRange: 420,
      shootCooldownMs: 2000,
      projectileSpeed: 260,
      projectileDamage: 8,
      knockbackResist: 0.85
    },
    elite: {
      key: 'elite',
      label: 'Warlord',
      color: 'elite',
      radius: 22,
      speed: 90,
      health: 90,
      damage: 14,
      expValue: 30,
      scoreValue: 60,
      contactCooldownMs: 650,
      knockbackResist: 0.5
    }
  },

  // Difficulty phases, in ms of elapsed run time.
  PHASES: [
    {
      untilMs: 2 * 60 * 1000,
      spawnIntervalMs: 1400,
      spawnPerWave: 1,
      types: { basic: 1 },
      healthMult: 1.0,
      damageMult: 1.0
    },
    {
      untilMs: 4 * 60 * 1000,
      spawnIntervalMs: 1000,
      spawnPerWave: 2,
      types: { basic: 0.6, fast: 0.4 },
      healthMult: 1.25,
      damageMult: 1.05
    },
    {
      untilMs: 6 * 60 * 1000,
      spawnIntervalMs: 850,
      spawnPerWave: 2,
      types: { basic: 0.35, fast: 0.25, ranged: 0.2, elite: 0.2 },
      healthMult: 1.6,
      damageMult: 1.15
    },
    {
      untilMs: 8 * 60 * 1000,
      spawnIntervalMs: 650,
      spawnPerWave: 3,
      types: { basic: 0.25, fast: 0.25, tank: 0.2, ranged: 0.15, elite: 0.15 },
      healthMult: 2.1,
      damageMult: 1.3
    },
    {
      untilMs: 10 * 60 * 1000,
      spawnIntervalMs: 450,
      spawnPerWave: 4,
      types: { basic: 0.2, fast: 0.2, tank: 0.25, ranged: 0.15, elite: 0.2 },
      healthMult: 2.8,
      damageMult: 1.5
    }
  ],

  BOSS: {
    label: 'THE OVERSEER',
    radius: 60,
    health: 3200,
    damage: 26,
    speed: 55,
    phase2HealthPct: 0.5,
    phase3HealthPct: 0.2,
    attackCooldownMs: 3200,
    chargeCooldownMs: 6000,
    summonCooldownMs: 9000,
    scoreValue: 1000
  },

  SAVE_KEY: 'survive10_save_v1'
};

/**
 * ASSETS -- the full list of custom-art "models" the game will try to load.
 * Drop a correctly-named image into the matching assets/ subfolder and it
 * is used automatically; anything missing falls back to the built-in
 * placeholder shape, so the game always runs even with zero art supplied.
 *
 * width/height are the LOGICAL gameplay size in pixels, not the source
 * file's resolution -- whatever you upload gets scaled to fit this size
 * automatically (see BootScene in game.js), so art of any resolution or
 * aspect ratio is safe to drop in.
 */
CONFIG.ASSETS = [
  { key: 'player', path: 'assets/player/player.png', width: CONFIG.PLAYER_BASE.radius * 2, height: CONFIG.PLAYER_BASE.radius * 2 },
  { key: 'enemy_basic', path: 'assets/enemies/basic.png', width: CONFIG.ENEMY_TYPES.basic.radius * 2, height: CONFIG.ENEMY_TYPES.basic.radius * 2 },
  { key: 'enemy_fast', path: 'assets/enemies/fast.png', width: CONFIG.ENEMY_TYPES.fast.radius * 2, height: CONFIG.ENEMY_TYPES.fast.radius * 2 },
  { key: 'enemy_tank', path: 'assets/enemies/tank.png', width: CONFIG.ENEMY_TYPES.tank.radius * 2, height: CONFIG.ENEMY_TYPES.tank.radius * 2 },
  { key: 'enemy_ranged', path: 'assets/enemies/ranged.png', width: CONFIG.ENEMY_TYPES.ranged.radius * 2, height: CONFIG.ENEMY_TYPES.ranged.radius * 2 },
  { key: 'enemy_elite', path: 'assets/enemies/elite.png', width: CONFIG.ENEMY_TYPES.elite.radius * 2, height: CONFIG.ENEMY_TYPES.elite.radius * 2 },
  { key: 'boss', path: 'assets/boss/boss.png', width: CONFIG.BOSS.radius * 2.5, height: CONFIG.BOSS.radius * 2.5 },
  { key: 'env_building', path: 'assets/environment/building.png', width: 220, height: 260 },
  { key: 'env_car', path: 'assets/environment/car.png', width: 70, height: 34 },
  { key: 'env_carwreck', path: 'assets/environment/carwreck.png', width: 74, height: 36 },
  { key: 'env_tree', path: 'assets/environment/tree.png', width: 64, height: 84 },
  { key: 'env_streetlight', path: 'assets/environment/streetlight.png', width: 16, height: 90 },
  { key: 'env_debris', path: 'assets/environment/debris.png', width: 20, height: 12 },
  { key: 'blade', path: 'assets/weapons/blade.png', width: 22, height: 22 }
];

CONFIG.ASSET_LOOKUP = {};
CONFIG.ASSETS.forEach(a => { CONFIG.ASSET_LOOKUP[a.key] = a; });

/**
 * SOUND_ASSETS -- same idea as ASSETS but for audio. Drop a matching file
 * into assets/audio/ and it plays instead of the synthesized cue; nothing
 * missing just keeps using the built-in Web Audio sound for that one cue.
 * Keys match the AudioManager method names 1:1 (see audio.js).
 */
CONFIG.SOUND_ASSETS = [
  { key: 'weaponFire', path: 'assets/audio/weapon_fire.mp3' },
  { key: 'enemyHit', path: 'assets/audio/enemy_hit.mp3' },
  { key: 'enemyDeath', path: 'assets/audio/enemy_death.mp3' },
  { key: 'expPickup', path: 'assets/audio/exp_pickup.mp3' },
  { key: 'levelUp', path: 'assets/audio/level_up.mp3' },
  { key: 'upgradeSelect', path: 'assets/audio/upgrade_select.mp3' },
  { key: 'playerDamage', path: 'assets/audio/player_damage.mp3' },
  { key: 'bossAppear', path: 'assets/audio/boss_appear.mp3' },
  { key: 'bossAttack', path: 'assets/audio/boss_attack.mp3' },
  { key: 'victory', path: 'assets/audio/victory.mp3' },
  { key: 'gameOver', path: 'assets/audio/game_over.mp3' },
  { key: 'uiClick', path: 'assets/audio/ui_click.mp3' },
  { key: 'musicLoop', path: 'assets/audio/music_loop.mp3' }
];
