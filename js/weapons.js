/**
 * weapons.js
 * ----------
 * A single automatic weapon for v1 ("Scrap Blaster"). It finds the
 * nearest living enemy inside range and fires at a rate driven by the
 * player's attackSpeed stat. Structured so a second weapon type is
 * just another class with the same fire(scene, player, enemies) shape.
 */

class Weapon {
  constructor(scene) {
    this.scene = scene;
    this.cooldown = 0;
    this.projectiles = scene.physics.add.group();
  }

  findNearestEnemy(player, targets, range) {
    let nearest = null;
    let nearestDist = range;
    for (const enemy of targets) {
      if (!enemy.alive) continue;
      const d = Phaser.Math.Distance.Between(player.x, player.y, enemy.sprite.x, enemy.sprite.y);
      if (d <= nearestDist && Roads.clear(player.x,player.y,enemy.sprite.x,enemy.sprite.y,6)) {
        nearestDist = d;
        nearest = enemy;
      }
    }
    return nearest;
  }

  update(delta, player, enemyManager, boss) {
    this.cooldown -= delta;
    if (this.cooldown > 0) return;

    // The boss is not tracked inside enemyManager.enemies, so it has to
    // be added to the target list explicitly or the weapon would never
    // aim at it during the final fight.
    const targets = boss && boss.alive ? [...enemyManager.enemies, boss] : enemyManager.enemies;
    const target = this.findNearestEnemy(player, targets, player.stats.attackRange);
    const pointer = this.scene.input.activePointer;
    const aiming = pointer.isDown && pointer.leftButtonDown();
    if (!target && !aiming) return;

    const shotInterval = 1000 / Math.max(0.1, player.stats.attackSpeed * (this.scene.runContent?.fireRate || 1));
    this.cooldown = shotInterval;

    const aim = pointer.positionToCamera(this.scene.cameras.main);
    const baseAngle = aiming ? Math.atan2(aim.y-player.y, aim.x-player.x) : Phaser.Math.Angle.Between(player.x, player.y, target.sprite.x, target.sprite.y);
    this.fireSpread(player, baseAngle);
  }

  /**
   * A bonus manual shot triggered by the space bar (see GameScene.update),
   * on top of the normal auto-fire above and on its own separate cooldown.
   * Aims at the nearest enemy in range same as auto-fire; if nothing's in
   * range, fires the way the player is currently facing instead so the
   * button always does something.
   */
  manualFire(player, enemyManager, boss) {
    const targets = boss && boss.alive ? [...enemyManager.enemies, boss] : enemyManager.enemies;
    const target = this.findNearestEnemy(player, targets, player.stats.attackRange);
    const pointer = this.scene.input.activePointer;
    const aim = pointer.positionToCamera(this.scene.cameras.main);
    const angle = pointer.isDown ? Math.atan2(aim.y-player.y,aim.x-player.x) : target
      ? Phaser.Math.Angle.Between(player.x, player.y, target.sprite.x, target.sprite.y)
      : Math.atan2(player.facing.y, player.facing.x);
    this.fireSpread(player, angle);
  }

  /** Fires player.stats.projectileCount projectiles in a small fan around baseAngle. */
  fireSpread(player, baseAngle) {
    player.sprite.setRotation(baseAngle);
    const count = Math.max(1, Math.round(player.stats.projectileCount));
    const spread = 10; // degrees between multiple projectiles

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * Phaser.Math.DegToRad(spread);
      this.fireProjectile(player, baseAngle + offset);
    }

    Audio.weaponFire();
    this.muzzleFlash(player, baseAngle);
  }

  fireProjectile(player, angle, options = {}) {
    const size = options.size || 6 * player.stats.projectileSize;
    const proj = this.scene.add.circle(player.x, player.y, size, options.color || CONFIG.COLORS.projectilePlayer);
    proj.setDepth(40);
    this.scene.physics.add.existing(proj);
    proj.body.setCircle(size);
    const speed = player.stats.projectileSpeed;
    proj.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    const crit = Math.random() < player.stats.critChance;
    proj.damage = (options.damage ?? player.stats.damage) * (crit ? 2 : 1);
    proj.hitRadius = size;
    proj.isCrit = crit;
    proj.lifespan = options.lifespan || 1500;
    proj.lastX=player.x; proj.lastY=player.y;

    this.projectiles.add(proj);
    proj.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  muzzleFlash(player, angle) {
    const flash = this.scene.add.star(player.x + Math.cos(angle)*22, player.y + Math.sin(angle)*22, 4, 3, 13, 0xffe4a8, 0.9).setRotation(angle);
    flash.setDepth(51);
    this.scene.tweens.add({
      targets: flash,
      scale: 0.2,
      alpha: 0,
      duration: 120,
      onComplete: () => flash.destroy()
    });
  }

  cleanupProjectile(proj) {
    this.projectiles.remove(proj, true, true);
  }
}

/**
 * OrbitWeapon -- the second weapon: a ring of blades that continuously
 * circles the player and damages anything it touches. Locked until the
 * player picks the "ORBITAL BLADES" upgrade (see upgrades.js), then
 * grows/strengthens through further upgrade picks. Reads its live count
 * and damage straight from player.stats each frame rather than keeping
 * its own copies, the same way Weapon reads attackSpeed/damage/etc.
 */
class OrbitWeapon {
  constructor(scene) {
    this.scene = scene;
    this.blades = [];
    this.angle = 0;
    this.lastHit = new Map(); // target -> timestamp of last hit, for the per-target cooldown
  }

  update(delta, player, enemyManager, boss) {
    const count = player.stats.orbitUnlocked ? Math.max(0, Math.round(player.stats.orbitCount)) : 0;

    if (count === 0) {
      if (this.blades.length) this.clearBlades();
      return;
    }

    this.syncBladeCount(count);

    const cfg = CONFIG.ORBIT_WEAPON;
    this.angle += cfg.rotationSpeed * (delta / 1000);

    const positions = [];
    for (let i = 0; i < count; i++) {
      const a = this.angle + (i * Math.PI * 2) / count;
      const x = player.x + Math.cos(a) * cfg.radius;
      const y = player.y + Math.sin(a) * cfg.radius;
      this.blades[i].setPosition(x, y);
      this.blades[i].setRotation(a);
      positions.push({ x, y });
    }

    this.handleHits(positions, player, enemyManager, boss);
  }

  syncBladeCount(count) {
    while (this.blades.length < count) {
      const blade = this.scene.add.image(0, 0, 'blade').setDepth(41);
      this.blades.push(blade);
    }
    while (this.blades.length > count) {
      this.blades.pop().destroy();
    }
  }

  clearBlades() {
    this.blades.forEach(b => b.destroy());
    this.blades = [];
  }

  handleHits(positions, player, enemyManager, boss) {
    const now = this.scene.time.now;
    const cfg = CONFIG.ORBIT_WEAPON;
    const targets = boss && boss.alive ? [...enemyManager.enemies, boss] : enemyManager.enemies;

    for (const target of targets) {
      if (!target.alive) continue;
      const lastHitAt = this.lastHit.get(target) || 0;
      if (now - lastHitAt < cfg.hitCooldownMs) continue;

      const radius = target.def ? target.def.radius : CONFIG.BOSS.radius;
      for (const pos of positions) {
        const dist = Phaser.Math.Distance.Between(pos.x, pos.y, target.sprite.x, target.sprite.y);
        if (dist < radius + 11) {
          const crit = Math.random() < player.stats.critChance;
          const knockbackAngle = Phaser.Math.Angle.Between(pos.x, pos.y, target.sprite.x, target.sprite.y);
          target.takeDamage(player.stats.orbitDamage * (crit ? 2 : 1), crit, knockbackAngle);
          this.lastHit.set(target, now);
          break;
        }
      }
    }

    // Prune dead targets out of the cooldown map so it doesn't grow
    // unbounded over a 10-minute run.
    if (this.lastHit.size > 40) {
      for (const [target] of this.lastHit) {
        if (!target.alive) this.lastHit.delete(target);
      }
    }
  }
}
