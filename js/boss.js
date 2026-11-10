/**
 * boss.js
 * -------
 * The final boss appears once the 10-minute timer elapses. It cycles
 * through attacks on cooldowns and escalates behaviour at two health
 * thresholds (phase 2 at 50%, phase 3 at 20%).
 */

class Boss {
  constructor(scene, x, y) {
    this.scene = scene;
    const def = CONFIG.BOSS;
    this.def = def;
    this.maxHealth = def.health;
    this.health = def.health;
    this.phase = 1;
    this.alive = true;
    this.attackTimer = def.attackCooldownMs;
    this.chargeTimer = def.chargeCooldownMs;
    this.summonTimer = def.summonCooldownMs;
    this.charging = false;
    this.chargeVector = { x: 0, y: 0 };

    ({x,y} = Roads.snap(x,y));
    this.sprite = scene.physics.add.sprite(x, y, 'boss');
    this.sprite.setCircle(def.radius, def.radius*0.25, def.radius*0.25);
    scene.physics.add.collider(this.sprite, scene.roadWalls);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(35);
    this.sprite.enemyRef = this; // reuse the same collision hook as normal enemies
    this.lastContactAt = 0;
  }

  get speedMultiplier() {
    if (this.phase === 3) return 1.6;
    if (this.phase === 2) return 1.25;
    return 1;
  }

  get attackRateMultiplier() {
    if (this.phase === 3) return 0.55;
    if (this.phase === 2) return 0.75;
    return 1;
  }

  updatePhase() {
    const pct = this.health / this.maxHealth;
    if (pct <= this.def.phase3HealthPct && this.phase < 3) {
      this.phase = 3;
      EventBus.emit('boss-phase', { phase: 3 });
    } else if (pct <= this.def.phase2HealthPct && this.phase < 2) {
      this.phase = 2;
      EventBus.emit('boss-phase', { phase: 2 });
    }
  }

  update(delta, player, enemyManager) {
    if (!this.alive) return;
    this.updatePhase();

    if (this.charging) {
      this.sprite.setVelocity(this.chargeVector.x, this.chargeVector.y);
      this.chargeDuration -= delta;
      if (this.chargeDuration <= 0) {
        this.charging = false;
        this.sprite.setVelocity(0, 0);
      }
    } else {
      const target = Roads.clear(this.sprite.x,this.sprite.y,player.x,player.y,this.def.radius+2) ? player : roadWaypoint(this.sprite.x,this.sprite.y,player.x,player.y);
      const dx = target.x - this.sprite.x;
      const dy = target.y - this.sprite.y;
      const dist = Math.hypot(dx, dy) || 1;
      this.sprite.setVelocity((dx / dist) * this.def.speed * this.speedMultiplier, (dy / dist) * this.def.speed * this.speedMultiplier);

      const now = this.scene.time.now;
      const dist2 = Math.hypot(player.x-this.sprite.x,player.y-this.sprite.y);
      if (dist2 < this.def.radius + CONFIG.PLAYER_BASE.radius && now - this.lastContactAt > 700) {
        this.lastContactAt = now;
        player.takeDamage(this.def.damage);
      }
    }

    this.attackTimer -= delta * (1 / this.attackRateMultiplier);
    if (this.attackTimer <= 0) {
      this.attackTimer = this.def.attackCooldownMs;
      this.randomAttack(player);
    }

    this.chargeTimer -= delta;
    if (this.chargeTimer <= 0 && !this.charging) {
      this.chargeTimer = this.def.chargeCooldownMs;
      this.startCharge(player);
    }

    this.summonTimer -= delta;
    if (this.summonTimer <= 0) {
      this.summonTimer = this.def.summonCooldownMs;
      this.summonMinions(enemyManager, player);
    }
  }

  randomAttack(player) {
    const choice = Math.random();
    if (choice < 0.5) this.projectileBurst(player);
    else this.areaAttack(player);
  }

  projectileBurst(player) {
    Audio.bossAttack();
    const count = this.phase === 3 ? 12 : this.phase === 2 ? 9 : 6;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const proj = this.scene.add.circle(this.sprite.x, this.sprite.y, 9, CONFIG.COLORS.projectileEnemy);
      proj.setDepth(34);
      this.scene.physics.add.existing(proj);
      proj.body.setCircle(9);
      proj.body.setVelocity(Math.cos(angle) * 220, Math.sin(angle) * 220);
      proj.damage = this.def.damage * 0.4;
      this.scene.enemyManager.enemyProjectiles.add(proj);
      proj.lastX=this.sprite.x; proj.lastY=this.sprite.y;
      proj.body.setVelocity(Math.cos(angle) * 220, Math.sin(angle) * 220);
    }
  }

  areaAttack(player) {
    Audio.bossAttack();
    const zone = this.scene.add.circle(player.x, player.y, 90, CONFIG.COLORS.hazardRed, 0.25);
    zone.setDepth(15);
    zone.setStrokeStyle(2, CONFIG.COLORS.hazardRed, 0.8);
    this.scene.tweens.add({
      targets: zone,
      alpha: 0.55,
      duration: 700,
      onComplete: () => {
        const dist = Phaser.Math.Distance.Between(zone.x, zone.y, player.x, player.y);
        if (dist < 90) player.takeDamage(this.def.damage * 0.9);
        this.scene.shakeCamera(200, 0.006);
        zone.destroy();
      }
    });
  }

  startCharge(player) {
    if (!Roads.clear(this.sprite.x,this.sprite.y,player.x,player.y,this.def.radius+2)) return;
    this.charging = true;
    this.chargeDuration = 500;
    const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.x, player.y);
    const speed = 620;
    this.chargeVector = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
    Audio.bossAttack();
    this.scene.shakeCamera(150, 0.003);
  }

  summonMinions(enemyManager, player) {
    // Respect the same population cap as normal spawning so a long boss
    // fight with unkilled minions can't grow the enemy count unbounded.
    if (enemyManager.enemies.length >= CONFIG.PERFORMANCE.maxEnemies) return;

    const count = this.phase >= 2 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      if (enemyManager.enemies.length >= CONFIG.PERFORMANCE.maxEnemies) break;
      const angle = Math.random() * Math.PI * 2;
      const x = this.sprite.x + Math.cos(angle) * 100;
      const y = this.sprite.y + Math.sin(angle) * 100;
      const type = Math.random() < 0.5 ? 'basic' : 'fast';
      enemyManager.spawnAt(type, x, y, 1.2, 1.1);
    }
  }

  takeDamage(amount, isCrit) {
    if (!this.alive) return;
    // The boss is deliberately immune to knockback (a shove wouldn't read as
    // "boss" scale), but it still gets the same hit feedback as everything else.
    this.health -= amount;
    this.scene.spawnDamageNumber(this.sprite.x, this.sprite.y - this.def.radius, amount, isCrit);
    this.scene.spawnHitEffect(this.sprite.x, this.sprite.y, 'boss');
    Audio.enemyHit();
    EventBus.emit('boss-health', { health: Math.max(0, this.health), maxHealth: this.maxHealth });

    if (this.health <= 0) this.die();
  }

  die() {
    this.alive = false;
    this.sprite.body.enable = false;
    this.scene.spawnDeathEffect(this.sprite.x, this.sprite.y, 'boss', true);
    Audio.victory();
    EventBus.emit('boss-defeated', { score: this.def.scoreValue });

    // Slower, heavier death animation to match its scale.
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.6,
      scaleY: 0.3,
      rotation: 0.4,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeIn',
      onComplete: () => this.sprite.destroy()
    });
  }
}
