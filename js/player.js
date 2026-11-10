/**
 * player.js
 * ---------
 * The Player class owns all player stats and the physics body. It
 * knows nothing about enemies or weapons directly -- GameScene wires
 * those together -- which keeps upgrades simple to apply.
 */

class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    const base = CONFIG.PLAYER_BASE;

    this.stats = {
      maxHealth: base.maxHealth,
      health: base.maxHealth,
      moveSpeed: base.moveSpeed,
      damage: base.damage,
      attackSpeed: base.attackSpeed,
      attackRange: base.attackRange,
      projectileSpeed: base.projectileSpeed,
      projectileSize: base.projectileSize,
      critChance: base.critChance,
      projectileCount: base.projectileCount,
      expMultiplier: base.expMultiplier,
      // Second weapon (orbiting blades) -- locked until the player picks
      // the "ORBITAL BLADES" upgrade; see weapons.js/OrbitWeapon and
      // upgrades.js for how these get set and used.
      orbitUnlocked: false,
      orbitCount: 0,
      orbitDamage: CONFIG.ORBIT_WEAPON.baseDamage
    };

    Object.assign(this.stats, EXPANSION_STATS);
    this.level = 1;
    this.exp = 0;
    this.expToNext = CONFIG.expForLevel(1);
    this.alive = true;
    this.invulnerableUntil = 0;

    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setCircle(base.radius);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(50);
    scene.physics.add.collider(this.sprite, scene.roadWalls);
    this.sprite.body.setMaxSpeed(base.moveSpeed * 2);

    this.weaponName = 'Scrap Blaster';
    this.facing = { x: 1, y: 0 };
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  update(delta, input) {
    if (!this.alive) return;

    let vx = 0, vy = 0;
    if (input.left) vx -= 1;
    if (input.right) vx += 1;
    if (input.up) vy -= 1;
    if (input.down) vy += 1;

    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      vx /= len; vy /= len;
      this.facing = { x: vx, y: vy };
    }

    const speed=this.stats.moveSpeed*(this.scene.runContent?.moveRate || 1);
    this.sprite.setVelocity(vx * speed, vy * speed);
  }

  takeDamage(amount) {
    if (!this.alive || this.scene.runContent?.buffs.shield > 0) return;
    const now = this.scene.time.now;
    if (now < this.invulnerableUntil) return;
    this.invulnerableUntil = now + 250; // brief i-frames so one bad frame can't chain-kill
    this.stats.health = Math.max(0, this.stats.health - amount);
    EventBus.emit('player-damaged', { health: this.stats.health, maxHealth: this.stats.maxHealth });
    Audio.playerDamage();
    this.scene.shakeCamera(120, 0.004);
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.sprite.clearTint());

    if (this.stats.health <= 0) {
      this.alive = false;
      EventBus.emit('player-died');
    }
  }

  heal(amount) {
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + amount);
    EventBus.emit('player-damaged', { health: this.stats.health, maxHealth: this.stats.maxHealth });
  }

  gainExp(amount) {
    this.exp += amount * this.stats.expMultiplier;
    let leveledUp = false;
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level += 1;
      this.expToNext = CONFIG.expForLevel(this.level);
      leveledUp = true;
    }
    EventBus.emit('exp-changed', { exp: this.exp, expToNext: this.expToNext, level: this.level });
    if (leveledUp) EventBus.emit('level-up', { level: this.level });
  }

  applyUpgrade(upgrade) {
    // Every upgrade's apply(stats) fully mutates whatever it needs to
    // (including current health for the health/heal upgrades), so no
    // special-casing is needed here.
    upgrade.apply(this.stats);
    EventBus.emit('player-damaged', { health: this.stats.health, maxHealth: this.stats.maxHealth });
  }

  /**
   * Applies a character-select loadout (a set of multipliers on top of
   * PLAYER_BASE) once, at the very start of a run. Any stat named in
   * `mods` is multiplied by its factor; maxHealth changes also refill
   * current health to the new max since this only ever runs pre-fight.
   */
  applyLoadout(mods) {
    if (!mods) return;
    Object.entries(mods).forEach(([key, factor]) => {
      if (this.stats[key] === undefined) return;
      this.stats[key] = this.stats[key] * factor;
    });
    if (mods.maxHealth !== undefined) {
      this.stats.health = this.stats.maxHealth;
    }
    // Round the couple of stats that should stay whole numbers.
    this.stats.maxHealth = Math.round(this.stats.maxHealth);
    this.stats.health = Math.round(this.stats.health);
    this.stats.moveSpeed = Math.round(this.stats.moveSpeed);
  }
}
