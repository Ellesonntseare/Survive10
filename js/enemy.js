/**
 * enemy.js
 * --------
 * Enemy: a single hostile actor driven by a type definition from
 * CONFIG.ENEMY_TYPES (see config.js for stats).
 * EnemyManager: spawns enemies around the player according to the
 * current difficulty phase, and updates them all each frame.
 * ExpOrb / ExpManager: the pickups enemies leave behind.
 */

/**
 * Strict road-following navigation. The world's roads form a full
 * lattice (every vertical road crosses every horizontal road -- see
 * buildArena() in game.js), so any two points are connected by at most
 * one turn at an intersection. This returns the next waypoint to head
 * toward rather than a full path, so it's cheap enough to recompute
 * fresh every frame and always reacts instantly to the player moving.
 */
function roadWaypoint(fromX, fromY, toX, toY) {
  const spacing = CONFIG.WORLD.LANE_SPACING;
  const halfWidth = 5;

  const nearestRoadX = Math.max(41, Math.min(Math.floor(CONFIG.WORLD.WIDTH / spacing) * spacing, Math.round(fromX / spacing) * spacing));
  const nearestRoadY = Math.max(41, Math.min(Math.floor(CONFIG.WORLD.HEIGHT / spacing) * spacing, Math.round(fromY / spacing) * spacing));
  const onVertical = Math.abs(fromX - nearestRoadX) < halfWidth;
  const onHorizontal = Math.abs(fromY - nearestRoadY) < halfWidth;

  const targetRoadX = Math.max(41, Math.min(Math.floor(CONFIG.WORLD.WIDTH / spacing) * spacing, Math.round(toX / spacing) * spacing));
  const targetRoadY = Math.max(41, Math.min(Math.floor(CONFIG.WORLD.HEIGHT / spacing) * spacing, Math.round(toY / spacing) * spacing));

  if (!onVertical && !onHorizontal) {
    // Not on the network yet -- head for whichever road line is closer.
    const distToVert = Math.abs(fromX - nearestRoadX);
    const distToHoriz = Math.abs(fromY - nearestRoadY);
    return distToVert < distToHoriz
      ? { x: nearestRoadX, y: fromY }
      : { x: fromX, y: nearestRoadY };
  }

  if (onVertical && !onHorizontal) {
    // Drive along this vertical road toward the horizontal road nearest the target.
    return { x: nearestRoadX, y: targetRoadY };
  }

  if (onHorizontal && !onVertical) {
    // Drive along this horizontal road toward the vertical road nearest the target.
    return { x: targetRoadX, y: nearestRoadY };
  }

  // At an intersection: still need to cover whichever axis isn't aligned yet.
  if (Math.abs(nearestRoadX - targetRoadX) > 4) return { x: targetRoadX, y: nearestRoadY };
  if (Math.abs(nearestRoadY - targetRoadY) > 4) return { x: nearestRoadX, y: targetRoadY };
  return { x: nearestRoadX, y: nearestRoadY };
}

class Enemy {
  constructor(scene, typeKey, x, y, healthMult, damageMult) {
    this.scene = scene;

    // The sprite and health bar are created ONCE per instance and reused
    // for every future spawn once this enemy dies/despawns and goes back
    // into EnemyManager's pool -- see retire()/reset() below. Only the
    // very first spawn of a given pooled instance goes through here.
    this.sprite = scene.physics.add.sprite(x, y, `enemy_${typeKey}`);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(30);
    scene.physics.add.collider(this.sprite, scene.roadWalls);
    this.sprite.enemyRef = this;

    // Small health bar above the enemy (hidden until damaged, to keep
    // the screen readable when there are many enemies on screen).
    this.healthBarBg = scene.add.rectangle(x, y, 28, 4, 0x000000, 0.5).setDepth(31);
    this.healthBarFg = scene.add.rectangle(x, y, 28, 4, 0xff4444, 1).setDepth(32);

    this.chargeWarning = scene.add.graphics().setDepth(14);
    this.reset(typeKey, x, y, healthMult, damageMult);
  }

  /**
   * Reconfigures this instance for a spawn -- used both the first time
   * and every time a pooled (previously retired) instance is revived, so
   * the sprite and health bar get reused rather than destroyed/recreated.
   */
  reset(typeKey, x, y, healthMult, damageMult) {
    this.def = CONFIG.ENEMY_TYPES[typeKey];
    this.typeKey = typeKey;
    this.maxHealth = Math.round(this.def.health * healthMult);
    this.health = this.maxHealth;
    this.damage = Math.round(this.def.damage * damageMult);
    this.alive = true;
    this.lastContactAt = 0;
    this.lastShotAt = 0;
    this.specialCooldown=2200; this.windup=0; this.chargeLeft=0;
    this.chargeWarning.clear();
    this.knockbackUntil = 0;

    this.sprite.setTexture(`enemy_${typeKey}`);
    this.sprite.setPosition(x, y);
    this.sprite.setCircle(this.def.radius);
    this.sprite.setVisible(true);
    this.sprite.setAlpha(1);
    this.sprite.setScale(1);
    this.sprite.setRotation(0);
    this.sprite.setVelocity(0, 0);
    this.sprite.body.enable = true;

    this.healthBarBg.setPosition(x, y - this.def.radius - 10);
    this.healthBarFg.setPosition(x, y - this.def.radius - 10);
    this.healthBarFg.width = 28;
    this.healthBarBg.setVisible(false);
    this.healthBarFg.setVisible(false);
  }

  update(player, delta) {
    if (!this.alive) return;
    const dx = player.x - this.sprite.x;
    const dy = player.y - this.sprite.y;
    const dist = Math.hypot(dx, dy) || 1;

    const knockedBack = this.scene.time.now < this.knockbackUntil;
    // Ranged enemies "engage" (kite/strafe/shoot) once inside their shoot
    // range; everyone else engages (breaks off the roads to chase directly)
    // once inside the global road-logic chase radius.
    const engageRange = this.def.preferredDistance ? this.def.shootRange : CONFIG.ROAD_LOGIC.chaseRadius;
    const engaging = dist <= engageRange && Roads.clear(this.sprite.x, this.sprite.y, player.x, player.y, this.def.radius + 2);

    if (!knockedBack) {
      if (engaging) {
        if (this.def.preferredDistance) {
          // Ranged enemy: keep distance, strafe, and shoot.
          let speedMult = 1;
          if (dist < this.def.preferredDistance - 40) speedMult = -1;
          else if (dist < this.def.preferredDistance + 40) speedMult = 0;
          this.sprite.setVelocity((dx / dist) * this.def.speed * speedMult, (dy / dist) * this.def.speed * speedMult);
        } else {
          // Close enough to break off the road network and chase directly.
          this.sprite.setVelocity((dx / dist) * this.def.speed, (dy / dist) * this.def.speed);
        }
      } else {
        // Still far from the player: stay on the roads and drive toward them.
        const wp = Roads.clear(this.sprite.x,this.sprite.y,player.x,player.y,this.def.radius+2) ? player : roadWaypoint(this.sprite.x, this.sprite.y, player.x, player.y);
        const wdx = wp.x - this.sprite.x, wdy = wp.y - this.sprite.y;
        const wdist = Math.hypot(wdx, wdy) || 1;
        this.sprite.setVelocity((wdx / wdist) * this.def.speed, (wdy / wdist) * this.def.speed);
      }
    }
    if (this.typeKey === "charger" && !knockedBack) this.updateCharge(player, delta);
    // While knocked back, the velocity set by takeDamage() is left alone
    // for a few frames so the hit reads as an actual shove.

    if (this.def.preferredDistance && !knockedBack && engaging) {
      if (this.scene.time.now - this.lastShotAt > this.def.shootCooldownMs) {
        this.lastShotAt = this.scene.time.now;
        this.shootAt(player);
      }
    }

    this.healthBarBg.setPosition(this.sprite.x, this.sprite.y - this.def.radius - 10);
    this.healthBarFg.setPosition(
      this.sprite.x - 14 + (14 * (this.health / this.maxHealth)),
      this.sprite.y - this.def.radius - 10
    );
    this.healthBarFg.width = 28 * Math.max(0, this.health / this.maxHealth);

    // Contact damage
    if (dist < this.def.radius + CONFIG.PLAYER_BASE.radius) {
      if (this.scene.time.now - this.lastContactAt > this.def.contactCooldownMs) {
        this.lastContactAt = this.scene.time.now;
        player.takeDamage(this.damage);
      }
    }
  }

  updateCharge(player, delta) {
    this.specialCooldown-=delta;
    if(this.windup>0) {
      this.windup-=delta; this.sprite.setVelocity(0,0);
      if(this.windup<=0) {this.chargeLeft=420;this.chargeWarning.clear();}
    } else if(this.chargeLeft>0) {
      this.chargeLeft-=delta;
      this.sprite.setVelocity(Math.cos(this.chargeAngle)*310,Math.sin(this.chargeAngle)*310);
    } else if(this.specialCooldown<=0 && Math.hypot(player.x-this.sprite.x,player.y-this.sprite.y)<330 && Roads.clear(this.sprite.x,this.sprite.y,player.x,player.y,this.def.radius+2)) {
      this.specialCooldown=3300;this.windup=650;
      this.chargeAngle=Math.atan2(player.y-this.sprite.y,player.x-this.sprite.x);
      this.chargeWarning.lineStyle(8,0xff9c57,0.28);
      this.chargeWarning.lineBetween(this.sprite.x,this.sprite.y,this.sprite.x+Math.cos(this.chargeAngle)*140,this.sprite.y+Math.sin(this.chargeAngle)*140);
    }
  }

  shootAt(player) {
    const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.x, player.y);
    const proj = this.scene.add.circle(this.sprite.x, this.sprite.y, 7, CONFIG.COLORS.projectileEnemy);
    proj.setDepth(29);
    this.scene.physics.add.existing(proj);
    proj.body.setCircle(7);
    proj.body.setVelocity(Math.cos(angle) * this.def.projectileSpeed, Math.sin(angle) * this.def.projectileSpeed);
    proj.damage = this.def.projectileDamage;
    this.scene.enemyManager.enemyProjectiles.add(proj);
    proj.lastX=this.sprite.x; proj.lastY=this.sprite.y;
    proj.body.setVelocity(Math.cos(angle) * this.def.projectileSpeed, Math.sin(angle) * this.def.projectileSpeed);
    Audio.weaponFire();
  }

  takeDamage(amount, isCrit, knockbackAngle) {
    if (!this.alive) return;
    this.health -= amount;
    this.healthBarBg.setVisible(true);
    this.healthBarFg.setVisible(true);
    this.scene.spawnDamageNumber(this.sprite.x, this.sprite.y - this.def.radius, amount, isCrit);
    this.scene.spawnHitEffect(this.sprite.x, this.sprite.y, this.def.color);
    Audio.enemyHit();

    if (knockbackAngle !== undefined) {
      const resist = this.def.knockbackResist !== undefined ? this.def.knockbackResist : 1;
      if (resist > 0) {
        this.knockbackUntil = this.scene.time.now + CONFIG.KNOCKBACK.durationMs;
        const speed = CONFIG.KNOCKBACK.baseSpeed * resist;
        this.sprite.setVelocity(Math.cos(knockbackAngle) * speed, Math.sin(knockbackAngle) * speed);
      }
    }

    if (this.health <= 0) this.die();
  }

  die() {
    this.alive = false;
    this.sprite.body.enable = false;
    this.healthBarBg.setVisible(false);
    this.healthBarFg.setVisible(false);
    this.scene.spawnDeathEffect(this.sprite.x, this.sprite.y, this.def.color);
    Audio.enemyDeath();
    this.scene.expManager.spawn(this.sprite.x, this.sprite.y, this.def.expValue);
    EventBus.emit('enemy-killed', { typeKey: this.typeKey, score: this.def.scoreValue, x:this.sprite.x, y:this.sprite.y });
    this.chargeWarning.clear();
    if(this.typeKey === 'brood') {
      for(let i=0;i<2;i++) if(this.scene.enemyManager.enemies.filter(e=>e.alive).length < CONFIG.PERFORMANCE.maxEnemies) this.scene.enemyManager.spawnAt('fast',this.sprite.x+(i?30:-30),this.sprite.y,0.8,0.8);
    }

    // Distinct death animation (separate from the particle burst above):
    // the body squashes, spins and fades before it's actually removed.
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.4,
      scaleY: 0.4,
      rotation: Phaser.Math.Between(-100, 100) / 100,
      alpha: 0,
      duration: 220,
      ease: 'Cubic.easeIn',
      onComplete: () => this.retire()
    });
  }

  /** Quietly removed for being left too far behind -- no effects, no reward. */
  despawn() {
    if (!this.alive) return;
    this.alive = false;
    this.retire();
  }

  /** Hides this instance and hands it back to EnemyManager's pool instead
   *  of destroying it, so the next spawn can reuse the sprite/health bar
   *  rather than allocating new ones. */
  retire() {
    this.chargeWarning.clear();
    this.sprite.setVisible(false);
    this.sprite.body.enable = false;
    this.sprite.setVelocity(0, 0);
    this.healthBarBg.setVisible(false);
    this.healthBarFg.setVisible(false);
    this.scene.enemyManager.pool.push(this);
  }
}

class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.pool = []; // retired Enemy instances, ready to be reset() and reused
    this.enemyProjectiles = scene.physics.add.group();
    this.spawnTimer = 0;
  }

  currentPhase(elapsedMs) {
    for (const phase of CONFIG.PHASES) {
      if (elapsedMs < phase.untilMs) return phase;
    }
    return CONFIG.PHASES[CONFIG.PHASES.length - 1];
  }

  pickType(typeWeights) {
    const entries = Object.entries(typeWeights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [key, w] of entries) {
      if (r < w) return key;
      r -= w;
    }
    return entries[0][0];
  }

  update(delta, elapsedMs, player) {
    // Boss fight stops normal wave spawning, but any enemies the boss
    // has summoned still need to move, attack and be updatable.
    if (!this.scene.bossActive) {
      const phase = this.currentPhase(elapsedMs);
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = phase.spawnIntervalMs;
        for (let i = 0; i < phase.spawnPerWave; i++) {
          if (this.enemies.length >= CONFIG.PERFORMANCE.maxEnemies) break;
          this.spawnOne(phase, player);
        }
      }
    }

    const despawnDist = CONFIG.PERFORMANCE.stragglerDespawnDistance;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      // Enemies that fell way behind (usually stuck on a long road detour
      // from way back) aren't a meaningful threat anymore -- recycle them
      // instead of letting the population grow without bound all run.
      const distToPlayer = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, player.x, player.y);
      if (distToPlayer > despawnDist) {
        enemy.despawn();
        continue;
      }
      enemy.update(player, delta);
    }
    this.enemies = this.enemies.filter(e => e.alive);

    // enemy projectiles vs player
    this.enemyProjectiles.getChildren().slice().forEach(proj => {
      if (!Roads.clear(proj.lastX ?? proj.x, proj.lastY ?? proj.y, proj.x, proj.y, 7)) { this.enemyProjectiles.remove(proj, true, true); return; }
      proj.lastX=proj.x; proj.lastY=proj.y;
      if (Phaser.Math.Distance.Between(proj.x, proj.y, player.x, player.y) < 18) {
        player.takeDamage(proj.damage);
        this.enemyProjectiles.remove(proj, true, true);
        return;
      }
      if (this.outOfWorld(proj)) this.enemyProjectiles.remove(proj, true, true);
    });
  }

  outOfWorld(obj) {
    return obj.x < -50 || obj.y < -50 || obj.x > CONFIG.WORLD.WIDTH + 50 || obj.y > CONFIG.WORLD.HEIGHT + 50;
  }

  /** Spawns (or revives a pooled instance as) one enemy of typeKey at x,y. */
  spawnAt(typeKey, x, y, healthMult, damageMult) {
    ({x,y} = Roads.snap(x,y));
    let enemy;
    if (this.pool.length > 0) {
      enemy = this.pool.pop();
      enemy.reset(typeKey, x, y, healthMult, damageMult);
      // A revived instance reuses the same object reference as its previous
      // life, so anything keying per-enemy state off that reference (e.g.
      // OrbitWeapon's per-target hit cooldown) needs clearing here or a
      // freshly-spawned enemy could inherit a stale cooldown from before.
      if (this.scene.orbitWeapon) this.scene.orbitWeapon.lastHit.delete(enemy);
    } else {
      enemy = new Enemy(this.scene, typeKey, x, y, healthMult, damageMult);
    }
    this.enemies.push(enemy);
    return enemy;
  }

  spawnOne(phase, player) {
    const typeKey = this.pickType(phase.types);
    const angle = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * 150;
    let x = player.x + Math.cos(angle) * dist;
    let y = player.y + Math.sin(angle) * dist;
    x = Phaser.Math.Clamp(x, 40, CONFIG.WORLD.WIDTH - 40);
    y = Phaser.Math.Clamp(y, 40, CONFIG.WORLD.HEIGHT - 40);

    return this.spawnAt(typeKey, x, y, phase.healthMult, phase.damageMult);
  }

  clearAll() {
    for (const e of this.enemies) e.despawn();
    this.enemies = [];
    this.enemyProjectiles.clear(true, true);
  }
}

// ---------------------------------------------------------------------------

class ExpManager {
  constructor(scene) {
    this.scene = scene;
    // Plain array (not a physics group): orbs only ever need their
    // x/y read and occasionally nudged toward the player, so a real
    // Arcade body would fight with that manual movement every frame.
    this.orbs = [];
  }

  spawn(x, y, value) {
    const orb = this.scene.add.circle(x, y, 6, CONFIG.COLORS.exp);
    orb.setDepth(20);
    orb.setStrokeStyle(2, 0xffffff, 0.4);
    orb.value = value;
    this.orbs.push(orb);
    this.scene.tweens.add({ targets: orb, scale: { from: 0, to: 1 }, duration: 150 });
  }

  update(player, pickupRadius = 42) {
    this.orbs = this.orbs.filter(orb => {
      const dist = Phaser.Math.Distance.Between(orb.x, orb.y, player.x, player.y);
      if (dist < pickupRadius && Roads.clear(player.x,player.y,orb.x,orb.y,2)) {
        EventBus.emit("salvage-collected", orb.value);
        player.gainExp(orb.value);
        Audio.expPickup();
        EventBus.emit('score-add', { amount: orb.value });
        orb.destroy();
        return false;
      }
      if (dist < Math.max(140,pickupRadius) && Roads.clear(player.x,player.y,orb.x,orb.y,2)) {
        // gentle magnet pull toward the player once nearby
        const angle = Phaser.Math.Angle.Between(orb.x, orb.y, player.x, player.y);
        orb.x += Math.cos(angle) * 6;
        orb.y += Math.sin(angle) * 6;
      }
      return true;
    });
  }

  clearAll() {
    this.orbs.forEach(o => o.destroy());
    this.orbs = [];
  }
}
