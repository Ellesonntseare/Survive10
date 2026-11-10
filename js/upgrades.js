/**
 * upgrades.js
 * -----------
 * Every upgrade is described declaratively: how to format its current
 * value, its new value, and an apply(stats) function that mutates the
 * player's stats object. Adding a new upgrade means adding one entry
 * to UPGRADE_POOL -- nothing else needs to change.
 */

const UPGRADE_POOL = [
  {
    id: 'damage',
    name: 'POWER',
    unit: '',
    describe: (v) => `Attack damage: ${Math.round(v)}`,
    format: 'Damage +25%',
    apply(stats) {
      stats.damage = Math.round(stats.damage * 1.25 * 10) / 10;
    }
  },
  {
    id: 'attackSpeed',
    name: 'RAPID FIRE',
    describe: (v) => `Shots per second: ${v.toFixed(2)}`,
    format: 'Attack speed +20%',
    apply(stats) { stats.attackSpeed = Math.round(stats.attackSpeed * 1.2 * 100) / 100; }
  },
  {
    id: 'moveSpeed',
    name: 'SPEED',
    describe: (v) => `Move speed: ${Math.round(v)}`,
    format: 'Movement speed +15%',
    apply(stats) { stats.moveSpeed = Math.round(stats.moveSpeed * 1.15); }
  },
  {
    id: 'health',
    name: 'VITALITY',
    describe: (v) => `Max health: ${Math.round(v)}`,
    format: 'Maximum health +30 (also heals 30)',
    apply(stats) { stats.maxHealth += 30; stats.health = Math.min(stats.maxHealth, stats.health + 30); }
  },
  {
    id: 'heal',
    name: 'FIELD REPAIR',
    describe: (v) => `Current health: ${Math.round(v)}`,
    format: 'Restore 50% of max health',
    apply(stats) { stats.health = Math.min(stats.maxHealth, stats.health + Math.round(stats.maxHealth * 0.5)); }
  },
  {
    id: 'range',
    name: 'REACH',
    describe: (v) => `Attack range: ${Math.round(v)}`,
    format: 'Attack range +20%',
    apply(stats) { stats.attackRange = Math.round(stats.attackRange * 1.2); }
  },
  {
    id: 'projSpeed',
    name: 'VELOCITY',
    describe: (v) => `Projectile speed: ${Math.round(v)}`,
    format: 'Projectile speed +25%',
    apply(stats) { stats.projectileSpeed = Math.round(stats.projectileSpeed * 1.25); }
  },
  {
    id: 'projSize',
    name: 'HEAVY ROUNDS',
    describe: (v) => `Projectile size: x${v.toFixed(2)}`,
    format: 'Projectile size +20%',
    apply(stats) { stats.projectileSize = Math.round(stats.projectileSize * 1.2 * 100) / 100; }
  },
  {
    id: 'crit',
    name: 'PRECISION',
    describe: (v) => `Critical chance: ${Math.round(v * 100)}%`,
    format: 'Critical chance +5%',
    apply(stats) { stats.critChance = Math.min(0.75, stats.critChance + 0.05); }
  },
  {
    id: 'expGain',
    name: 'SCAVENGER',
    describe: (v) => `Experience gain: x${v.toFixed(2)}`,
    format: 'Experience gain +15%',
    apply(stats) { stats.expMultiplier = Math.round(stats.expMultiplier * 1.15 * 100) / 100; }
  },
  {
    id: 'extraProjectile',
    name: 'TWIN BARREL',
    describe: (v) => `Projectiles fired: ${Math.round(v)}`,
    format: '+1 additional projectile',
    apply(stats) { stats.projectileCount += 1; }
  },
  {
    id: 'cooldown',
    name: 'COOLING VENTS',
    describe: (v) => `Shots per second: ${v.toFixed(2)}`,
    format: 'Attack speed +15% (cooldown reduction)',
    apply(stats) { stats.attackSpeed = Math.round(stats.attackSpeed * 1.15 * 100) / 100; }
  },
  {
    id: 'orbitUnlock',
    name: 'ORBITAL BLADES',
    describe: (v) => `Orbital blades: ${v ? 'active' : 'none'}`,
    format: 'Unlock a rotating blade that damages anything it touches',
    available(stats) { return !stats.orbitUnlocked; },
    apply(stats) { stats.orbitUnlocked = true; stats.orbitCount = 1; }
  },
  {
    id: 'orbitBlade',
    name: 'TWIN BLADES',
    describe: (v) => `Blades: ${Math.round(v)}`,
    format: '+1 orbital blade',
    available(stats) { return stats.orbitUnlocked && stats.orbitCount < CONFIG.ORBIT_WEAPON.maxBlades; },
    apply(stats) { stats.orbitCount += 1; }
  },
  {
    id: 'orbitDamage',
    name: 'SHARPENED EDGE',
    describe: (v) => `Blade damage: ${Math.round(v)}`,
    format: 'Orbital blade damage +25%',
    available(stats) { return stats.orbitUnlocked; },
    apply(stats) { stats.orbitDamage = Math.round(stats.orbitDamage * 1.25 * 10) / 10; }
  }
];

const UpgradeSystem = {
  /** Returns 3 distinct upgrade definitions with their before/after values baked in. */
  rollThree(stats) {
    // Some upgrades are conditional (e.g. blade upgrades only make sense
    // once the orbital weapon is unlocked) -- filter those out first so
    // they're never offered when they wouldn't do anything useful.
    const pool = UPGRADE_POOL.filter(def => !def.available || def.available(stats));
    Phaser.Utils.Array.Shuffle(pool);
    const picks = pool.slice(0, 3);
    // Offer a companion unlock early until both weapons have been collected.
    const unlock = pool.find(d => d.id === "shotgunUnlock" || d.id === "arcUnlock");
    if (unlock && !picks.includes(unlock)) picks[2] = unlock;
    return picks.map(def => {
      const currentValue = def.describe(this._statValueFor(def.id, stats));
      // Compute a preview by applying to a cloned stats object.
      const clone = { ...stats };
      def.apply.call({}, clone);
      const newValue = def.describe(this._statValueFor(def.id, clone));
      return { ...def, currentValueLabel: currentValue, newValueLabel: newValue };
    });
  },

  _statValueFor(id, stats) {
    const field = UPGRADE_POOL.find(d => d.id === id)?.field;
    if (field) return stats[field];
    switch (id) {
      case 'damage': return stats.damage;
      case 'attackSpeed': return stats.attackSpeed;
      case 'moveSpeed': return stats.moveSpeed;
      case 'health': return stats.maxHealth;
      case 'heal': return stats.health;
      case 'range': return stats.attackRange;
      case 'projSpeed': return stats.projectileSpeed;
      case 'projSize': return stats.projectileSize;
      case 'crit': return stats.critChance;
      case 'expGain': return stats.expMultiplier;
      case 'extraProjectile': return stats.projectileCount;
      case 'cooldown': return stats.attackSpeed;
      case 'orbitUnlock': return stats.orbitUnlocked;
      case 'orbitBlade': return stats.orbitCount;
      case 'orbitDamage': return stats.orbitDamage;
      default: return 0;
    }
  }
};
