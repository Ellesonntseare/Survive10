/**
 * game.js
 * -------
 * Boots Phaser, generates all placeholder textures procedurally (no
 * binary asset files needed to run the game), and defines the two
 * scenes: MenuScene (idle animated backdrop behind the DOM main menu)
 * and GameScene (the actual 10-minute survival run).
 *
 * DOM <-> Phaser communication happens entirely through EventBus
 * (see config.js), so ui.js never touches a Phaser object directly.
 */

// ---------------------------------------------------------------------------
// Small mixin so every scene can register EventBus listeners and have them
// automatically cleaned up when the scene shuts down (avoids duplicate
// handlers piling up across restarts).
// ---------------------------------------------------------------------------
function busListenable(scene) {
  scene._busListeners = [];
  scene.busOn = (event, fn) => {
    EventBus.on(event, fn);
    scene._busListeners.push([event, fn]);
  };
  scene.events.once('shutdown', () => {
    scene._busListeners.forEach(([event, fn]) => EventBus.off(event, fn));
    scene._busListeners = [];
  });
}

// ---------------------------------------------------------------------------
// BootScene -- tries to load real art for every entry in CONFIG.ASSETS;
// anything missing (or that fails to load) falls back to a procedurally
// generated placeholder texture, so the game always runs. Real art gets
// "baked" into a texture of the exact size the rest of the game expects
// via a RenderTexture, so a source file of any resolution or aspect ratio
// just works -- nothing else in the codebase needs to know or care.
// ---------------------------------------------------------------------------
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    this.failedAssetKeys = new Set();
    this.load.on('loaderror', (file) => {
      // Image keys are loaded under `${assetKey}__raw`; sound keys are
      // loaded under their real key directly (no baking needed for audio).
      this.failedAssetKeys.add(file.key.replace(/__raw$/, ''));
    });
    CONFIG.ASSETS.forEach(asset => this.load.image(`${asset.key}__raw`, asset.path));
    CONFIG.SOUND_ASSETS.forEach(sound => this.load.audio(sound.key, sound.path));
  }

  create() {
    const g = this.add.graphics();
    const C = CONFIG.COLORS;

    const circleTex = (key, radius, color, outline) => {
      g.clear();
      g.fillStyle(color, 1);
      g.fillCircle(radius, radius, radius);
      if (outline !== undefined) {
        g.lineStyle(3, outline, 1);
        g.strokeCircle(radius, radius, radius - 1);
      }
      g.generateTexture(key, radius * 2, radius * 2);
    };

    // One placeholder-drawing function per asset key. These only ever run
    // for keys whose real art failed to load (or was never provided).
    const generators = {
      player: () => circleTex('player', CONFIG.PLAYER_BASE.radius, C.player, C.playerOutline),

      enemy_basic: () => circleTex('enemy_basic', CONFIG.ENEMY_TYPES.basic.radius, C.basic, 0x2a1512),

      enemy_fast: () => {
        const r = CONFIG.ENEMY_TYPES.fast.radius;
        g.clear();
        g.fillStyle(C.fast, 1);
        g.beginPath();
        g.moveTo(r, 0); g.lineTo(r * 2, r); g.lineTo(r, r * 2); g.lineTo(0, r);
        g.closePath();
        g.fillPath();
        g.generateTexture('enemy_fast', r * 2, r * 2);
      },

      enemy_tank: () => {
        const r = CONFIG.ENEMY_TYPES.tank.radius;
        g.clear();
        g.fillStyle(C.tank, 1);
        g.fillRect(0, 0, r * 2, r * 2);
        g.lineStyle(4, 0x2a2050, 1);
        g.strokeRect(2, 2, r * 2 - 4, r * 2 - 4);
        g.generateTexture('enemy_tank', r * 2, r * 2);
      },

      enemy_ranged: () => {
        const r = CONFIG.ENEMY_TYPES.ranged.radius;
        g.clear();
        g.fillStyle(C.ranged, 1);
        g.fillCircle(r, r, r);
        g.lineStyle(3, 0x0d3a45, 1);
        g.strokeCircle(r, r, r * 0.55);
        g.generateTexture('enemy_ranged', r * 2, r * 2);
      },

      enemy_elite: () => {
        const r = CONFIG.ENEMY_TYPES.elite.radius;
        g.clear();
        g.fillStyle(C.elite, 1);
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          const px = r + Math.cos(a) * r;
          const py = r + Math.sin(a) * r;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
        g.fillPath();
        g.lineStyle(3, 0x5c2f10, 1);
        g.strokePath();
        g.generateTexture('enemy_elite', r * 2, r * 2);
      },

      boss: () => {
        const r = CONFIG.BOSS.radius;
        g.clear();
        g.fillStyle(0x3a1414, 1);
        for (let i = 0; i < 12; i++) {
          const a = (Math.PI * 2 * i) / 12;
          g.beginPath();
          g.moveTo(r, r);
          g.lineTo(r + Math.cos(a) * r * 1.25, r + Math.sin(a) * r * 1.25);
          g.lineTo(r + Math.cos(a + 0.25) * r * 0.9, r + Math.sin(a + 0.25) * r * 0.9);
          g.closePath();
          g.fillPath();
        }
        g.fillStyle(C.boss, 1);
        g.fillCircle(r, r, r * 0.85);
        g.lineStyle(4, 0x5c1414, 1);
        g.strokeCircle(r, r, r * 0.85);
        g.generateTexture('boss', r * 2.5, r * 2.5);
      },

      env_building: () => {
        const w = 220, h = 260;
        g.clear();
        g.fillStyle(C.building, 1);
        g.fillRect(0, 0, w, h);
        g.fillStyle(C.buildingDark, 1);
        for (let y = 16; y < h - 10; y += 34) {
          for (let x = 14; x < w - 10; x += 36) {
            g.fillRect(x, y, 20, 22);
          }
        }
        g.generateTexture('env_building', w, h);
      },

      env_car: () => {
        const w = 70, h = 34;
        g.clear();
        g.fillStyle(C.carBody, 1);
        g.fillRoundedRect(0, 0, w, h, 8);
        g.fillStyle(0x2c3438, 1);
        g.fillRoundedRect(14, 4, w - 28, h - 18, 4);
        g.generateTexture('env_car', w, h);
      },

      env_carwreck: () => {
        const w = 74, h = 36;
        g.clear();
        g.fillStyle(C.carWreck, 1);
        g.fillRoundedRect(0, 4, w, h - 8, 6);
        g.fillStyle(0x1c1210, 1);
        g.fillRect(10, 10, 18, 10);
        g.fillRect(40, 8, 14, 12);
        g.generateTexture('env_carwreck', w, h);
      },

      env_tree: () => {
        const w = 64, h = 84;
        g.clear();
        g.fillStyle(C.treeTrunk, 1);
        g.fillRect(w / 2 - 6, h - 28, 12, 28);
        g.fillStyle(C.treeCanopy, 1);
        g.fillCircle(w / 2, h / 2 - 4, 30);
        g.generateTexture('env_tree', w, h);
      },

      env_streetlight: () => {
        const w = 16, h = 90;
        g.clear();
        g.fillStyle(0x2a2f32, 1);
        g.fillRect(w / 2 - 3, 10, 6, h - 10);
        g.fillStyle(C.streetLight, 1);
        g.fillCircle(w / 2, 8, 8);
        g.generateTexture('env_streetlight', w, h);
      },

      env_debris: () => {
        const s = 20;
        g.clear();
        g.fillStyle(0x33393c, 1);
        g.fillRect(0, 0, s, s * 0.6);
        g.generateTexture('env_debris', s, s * 0.6);
      },

      blade: () => {
        const r = 11;
        g.clear();
        g.fillStyle(C.hazardAmber, 1);
        g.beginPath();
        g.moveTo(r * 2, r);
        g.lineTo(r * 1.3, r * 0.55);
        g.lineTo(r * 1.3, r * 1.45);
        g.closePath();
        g.fillPath();
        g.fillStyle(0x8a5a12, 1);
        g.fillCircle(r * 0.65, r, r * 0.55);
        g.generateTexture('blade', r * 2, r * 2);
      }
    };

    createCityArt(this, generators);

    // For every manifest entry: if the real file loaded, bake it (whatever
    // its native resolution) into a texture of the exact logical size the
    // game expects; otherwise draw the placeholder at that same size.
    CONFIG.ASSETS.forEach(asset => {
      const rawKey = `${asset.key}__raw`;
      const loadedOk = this.textures.exists(rawKey) && !this.failedAssetKeys.has(asset.key);

      if (loadedOk) {
        const rt = this.make.renderTexture({ width: asset.width, height: asset.height }, false);
        const tempImg = this.make.image({ key: rawKey }, false).setOrigin(0, 0);
        tempImg.setDisplaySize(asset.width, asset.height);
        rt.draw(tempImg, 0, 0);
        rt.saveTexture(asset.key);
        tempImg.destroy();
        rt.destroy();
      } else {
        const gen = generators[asset.key];
        if (gen) gen();
      }

      if (this.textures.exists(rawKey)) this.textures.remove(rawKey);
    });

    // Small generic particle used by the particle-emitter-based hit/death
    // effects -- not a "model", always generated.
    circleTex('particle', 4, 0xffffff);

    g.destroy();

    // Register whichever real sound files actually loaded; everything
    // else keeps using its synthesized fallback (see audio.js).
    CONFIG.SOUND_ASSETS.forEach(sound => {
      if (this.cache.audio.exists(sound.key) && !this.failedAssetKeys.has(sound.key)) {
        Audio.registerLoadedSound(sound.key);
      }
    });

    this.scene.start('MenuScene');
  }
}

// ---------------------------------------------------------------------------
// Shared arena builder -- used by both the menu backdrop and the real game,
// so the "subtle animated background" on the main menu is the same visual
// world the player will actually survive in.
// ---------------------------------------------------------------------------
function buildArena(scene, width, height, seed, quality) {
  return buildCityArena(scene, width, height, seed, quality);
}

// ---------------------------------------------------------------------------
// MenuScene -- idle animated backdrop for the DOM main menu.
// ---------------------------------------------------------------------------
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    busListenable(this);
    const w = 1800, h = 1800;
    const quality = SaveManager.load().graphicsQuality;
    buildArena(this, w, h, 42, quality);
    this.cameras.main.setBounds(0, 0, w, h);
    this.cameras.main.centerOn(w / 2, h / 2);
    this.cameras.main.setZoom(0.9);

    this.driftAngle = 0;
    this.driftCenter = { x: w / 2, y: h / 2 };

    this.busOn('request-play', (payload) => {
      Audio.unlock();
      Audio.startMusic();
      this.scene.start('GameScene', payload || {});
    });
  }

  update(time, delta) {
    this.driftAngle += delta * 0.00006;
    const radius = 260;
    this.cameras.main.centerOn(
      this.driftCenter.x + Math.cos(this.driftAngle) * radius,
      this.driftCenter.y + Math.sin(this.driftAngle) * radius
    );
  }
}

// ---------------------------------------------------------------------------
// GameScene -- the real 10-minute run.
// ---------------------------------------------------------------------------
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.characterId = (data && data.character) || CONFIG.CHARACTERS[0].id;
    this.companionId = data?.companion || "shotgun";
  }

  create() {
    busListenable(this);

    const savedSettings = SaveManager.load();
    this.lowGraphics = savedSettings.graphicsQuality === 'low';

    const W = CONFIG.WORLD.WIDTH, H = CONFIG.WORLD.HEIGHT;
    this.physics.world.setBounds(0, 0, W, H);
    const props = buildArena(this, W, H, Date.now() % 1000, savedSettings.graphicsQuality);

    Roads.build(this);
    const spawn = Roads.snap(W/2,H/2);
    this.player = new Player(this, spawn.x, spawn.y);
    const character = CONFIG.CHARACTERS.find(c => c.id === this.characterId) || CONFIG.CHARACTERS[0];
    this.player.applyLoadout(character.mods);
    this.player.stats[this.companionId === "arc" ? "arcUnlocked" : "shotgunUnlocked"] = true;
    this.player.weaponName = `${character.name} · Scrap Blaster`;

    this.weapon = new Weapon(this);
    this.orbitWeapon = new OrbitWeapon(this);
    this.enemyManager = new EnemyManager(this);
    this.expManager = new ExpManager(this);
    this.runContent = new RunContent(this);
    this.companions = new CompanionWeapons(this);

    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.startFollow(this.player.sprite, true, 0.09, 0.09);
    this.cameras.main.setZoom(1);

    this.setupMinimap(props);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.manualFireCooldown = 0;

    this.elapsedMs = 0;
    this.lastSecondScored = -1;
    this.score = 0;
    this.kills = 0;
    this.paused = false;
    this.bossActive = false;
    this.bossDefeated = false;
    this.boss = null;

    this.longestSurvivalMs = savedSettings.longestSurvivalMs;

    // --- EventBus wiring for this run ---
    this.busOn('player-died', () => this.handleGameOver());
    this.busOn('level-up', () => this.handleLevelUp());
    this.busOn('upgrade-chosen', (choice) => this.handleUpgradeChosen(choice));
    this.busOn('enemy-killed', ({ score }) => {
      this.kills += 1;
      this.score += score;
      this.pushHudStats();
    });
    this.busOn('score-add', ({ amount }) => { this.score += Math.round(amount); this.pushHudStats(); });
    this.busOn('boss-defeated', ({ score }) => {
      this.score += score;
      this.bossDefeated = true;
      this.handleVictory();
    });

    this.busOn('request-resume', () => this.resumeGame());
    this.busOn('request-restart', () => { Audio.stopMusic(); this.scene.restart({ character: this.characterId, companion: this.companionId }); });
    this.busOn('request-menu', () => { Audio.stopMusic(); this.scene.start('MenuScene'); EventBus.emit('show-menu'); });
    this.busOn('escape-pressed', () => this.togglePause());
    this.busOn('graphics-quality-changed', (quality) => { this.lowGraphics = quality === 'low'; });

    // Initial HUD push
    EventBus.emit('player-damaged', { health: this.player.stats.health, maxHealth: this.player.stats.maxHealth });
    EventBus.emit('exp-changed', { exp: this.player.exp, expToNext: this.player.expToNext, level: this.player.level });
    this.pushHudStats();
    this.pushWeaponHud();
    document.getElementById('boss-healthbar').classList.add('hidden');

    Audio.unlock();
    Audio.startMusic();
  }

  /** Respects the Performance Mode setting so heavy shakes can be skipped. */
  shakeCamera(duration, intensity) {
    if (this.lowGraphics) return;
    this.cameras.main.shake(duration, intensity);
  }

  /**
   * A small static overview map in the corner, showing the whole world at
   * once via a second Phaser camera rather than a separately-drawn canvas
   * -- it's the same scene, just a different viewport, so it can never
   * drift out of sync with actual enemy/player positions.
   */
  setupMinimap(props) {
    const W = CONFIG.WORLD.WIDTH, H = CONFIG.WORLD.HEIGHT;
    const mmW = 160, mmH = 160;
    const mmX = 1280 - mmW - 16;
    const mmY = 720 - mmH - 56;

    this.minimapCamera = this.cameras.add(mmX, mmY, mmW, mmH);
    this.minimapCamera.setName('minimap');
    this.minimapCamera.setZoom(mmW / W);
    this.minimapCamera.centerOn(W / 2, H / 2);
    this.minimapCamera.setBackgroundColor(0x0c0f10);

    // Decorative buildings/cars/trees/etc. would just be visual noise at
    // this scale -- the point of the map is the road network enemies
    // actually navigate, plus where you and the boss are.
    this.minimapCamera.ignore(props.getChildren());

    // A thin frame around the map on the main view so it reads as a
    // distinct UI element rather than a stray extra viewport.
    const frame = this.add.rectangle(mmX + mmW / 2, mmY + mmH / 2, mmW + 4, mmH + 4, 0x000000, 0);
    frame.setStrokeStyle(2, CONFIG.COLORS.hazardAmber, 0.9);
    frame.setScrollFactor(0);
    frame.setDepth(1000);
    this.minimapCamera.ignore(frame);

    const label = this.add.text(mmX, mmY - 16, 'MAP', {
      fontFamily: 'Oswald, sans-serif', fontSize: '13px', color: '#f2a93b'
    }).setScrollFactor(0).setDepth(1000);
    this.minimapCamera.ignore(label);

    // Oversized markers so the player and boss actually read as dots at
    // this zoom level -- real sprites are only a pixel or two here.
    // Hidden from the main camera so they don't show up as giant blobs
    // over the actual gameplay view.
    this.minimapPlayerDot = this.add.circle(this.player.x, this.player.y, 55, CONFIG.COLORS.player).setDepth(999);
    this.cameras.main.ignore(this.minimapPlayerDot);

    this.minimapBossDot = this.add.circle(0, 0, 90, CONFIG.COLORS.boss).setDepth(998).setVisible(false);
    this.cameras.main.ignore(this.minimapBossDot);
  }

  updateMinimap() {
    if (!this.minimapPlayerDot) return;
    this.minimapPlayerDot.setPosition(this.player.x, this.player.y);
    if (this.boss && this.boss.alive) {
      this.minimapBossDot.setPosition(this.boss.sprite.x, this.boss.sprite.y).setVisible(true);
    } else {
      this.minimapBossDot.setVisible(false);
    }
  }

  pushHudStats() {
    EventBus.emit('hud-stats', { kills: this.kills, score: this.score });
  }

  pushWeaponHud() {
    EventBus.emit('hud-weapon', {
      name: this.player.weaponName,
      damage: this.player.stats.damage,
      attackSpeed: this.player.stats.attackSpeed,
      orbitUnlocked: this.player.stats.orbitUnlocked,
      orbitCount: this.player.stats.orbitCount,
      orbitDamage: this.player.stats.orbitDamage,
      shotgun: this.player.stats.shotgunUnlocked ? this.player.stats.shotgunPellets : 0,
      arc: this.player.stats.arcUnlocked ? this.player.stats.arcJumps : 0
    });
  }

  getInputState() {
    return {
      left: this.cursors.left.isDown || this.keys.A.isDown,
      right: this.cursors.right.isDown || this.keys.D.isDown,
      up: this.cursors.up.isDown || this.keys.W.isDown,
      down: this.cursors.down.isDown || this.keys.S.isDown
    };
  }

  /** Space bar: an immediate bonus shot on top of the weapon's normal auto-fire. */
  handleManualFire(delta) {
    this.manualFireCooldown -= delta;
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this.manualFireCooldown <= 0) {
      this.manualFireCooldown = CONFIG.MANUAL_FIRE_COOLDOWN_MS;
      this.weapon.manualFire(this.player, this.enemyManager, this.boss);
    }
  }

  update(time, delta) {
    if (this.paused) { this.physics.world.pause(); return; }
    this.physics.world.resume();

    this.elapsedMs += delta;
    this.updateTimerHud();

    const currentSecondScore = Math.floor(this.elapsedMs / 1000);
    if (currentSecondScore > this.lastSecondScored) {
      this.lastSecondScored = currentSecondScore;
      this.score += 1;
      this.pushHudStats();
    }

    this.runContent.update(delta);
    this.player.update(delta, this.getInputState());
    this.weapon.update(delta, this.player, this.enemyManager, this.boss);
    this.orbitWeapon.update(delta, this.player, this.enemyManager, this.boss);
    this.companions.update(delta, this.player, this.enemyManager, this.boss);
    this.handleManualFire(delta);
    this.enemyManager.update(delta, this.elapsedMs, this.player);
    this.expManager.update(this.player, this.runContent.buffs.magnet > 0 ? 350 : this.player.stats.pickupRadius);
    this.handleProjectileHits();
    this.updateMinimap();

    if (this.boss && this.boss.alive) {
      this.boss.update(delta, this.player, this.enemyManager);
    }

    if (!this.bossActive && this.elapsedMs >= CONFIG.RUN_DURATION_MS) {
      this.spawnBoss();
    }

    // clean up expired player projectiles
    this.weapon.projectiles.getChildren().slice().forEach(proj => {
      proj.lifespan -= delta;
      if (proj.lifespan <= 0 || this.enemyManager.outOfWorld(proj)) {
        this.weapon.cleanupProjectile(proj);
      }
    });
  }

  updateTimerHud() {
    if (this.bossActive) {
      EventBus.emit('hud-timer', 'BOSS');
      return;
    }
    const remaining = Math.max(0, CONFIG.RUN_DURATION_MS - this.elapsedMs);
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    EventBus.emit('hud-timer', `${m}:${s.toString().padStart(2, '0')}`);
  }

  handleProjectileHits() {
    const targets = this.boss && this.boss.alive ? [...this.enemyManager.enemies, this.boss] : this.enemyManager.enemies;
    this.weapon.projectiles.getChildren().slice().forEach(proj => {
      if (!Roads.clear(proj.lastX ?? proj.x, proj.lastY ?? proj.y, proj.x, proj.y, 6)) { this.weapon.cleanupProjectile(proj); return; }
      proj.lastX=proj.x; proj.lastY=proj.y;
      for (const target of targets) {
        if (!target.alive) continue;
        const radius = target.def ? target.def.radius : CONFIG.BOSS.radius;
        const dist = Phaser.Math.Distance.Between(proj.x, proj.y, target.sprite.x, target.sprite.y);
        if (dist < radius + (proj.hitRadius || 6)) {
          const knockbackAngle = Phaser.Math.Angle.Between(proj.x, proj.y, target.sprite.x, target.sprite.y);
          target.takeDamage(proj.damage, proj.isCrit, knockbackAngle);
          this.weapon.cleanupProjectile(proj);
          break;
        }
      }
    });
  }

  // ---- Level up / pause flow ----

  handleLevelUp() {
    this.paused = true;
    Audio.levelUp();
    EventBus.emit('show-levelup', this.player.stats);
  }

  handleUpgradeChosen(choice) {
    this.player.applyUpgrade(choice);
    this.pushWeaponHud();
    this.paused = false;
  }

  togglePause() {
    if (this.bossIntroLock) return;
    if (document.getElementById('screen-levelup').classList.contains('active')) return;
    if (document.getElementById('screen-gameover').classList.contains('active')) return;
    if (document.getElementById('screen-victory').classList.contains('active')) return;

    if (this.paused) {
      this.resumeGame();
    } else {
      this.paused = true;
      EventBus.emit('show-pause');
    }
  }

  resumeGame() {
    this.paused = false;
  }

  // ---- Boss sequence ----

  spawnBoss() {
    this.bossActive = true;
    this.enemyManager.clearAll();
    this.paused = true;
    this.bossIntroLock = true;

    Audio.bossAppear();
    EventBus.emit('boss-incoming', { name: CONFIG.BOSS.label });
    this.shakeCamera(400, 0.008);

    this.time.delayedCall(1800, () => {
      const angle = Math.random() * Math.PI * 2;
      const bx = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * 500, 100, CONFIG.WORLD.WIDTH - 100);
      const by = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * 500, 100, CONFIG.WORLD.HEIGHT - 100);
      this.boss = new Boss(this, bx, by);
      document.getElementById('boss-healthbar').classList.remove('hidden');
      EventBus.emit('boss-health', { health: this.boss.health, maxHealth: this.boss.maxHealth });
      this.paused = false;
      this.bossIntroLock = false;
    });
  }

  // ---- End states ----

  buildResultStats() {
    return {
      survivalMs: this.elapsedMs,
      enemiesDefeated: this.kills,
      level: this.player.level,
      score: this.score,
      longestSurvivalMs: this.longestSurvivalMs,
      bossDefeated: this.bossDefeated
    };
  }

  handleGameOver() {
    this.paused = true;
    Audio.gameOver();
    Audio.stopMusic();
    const stats = this.buildResultStats();
    SaveManager.recordRun(stats);
    EventBus.emit('show-gameover', stats);
  }

  handleVictory() {
    this.paused = true;
    Audio.stopMusic();
    Audio.victory();
    const stats = this.buildResultStats();
    SaveManager.recordRun(stats);
    EventBus.emit('show-victory', stats);
  }

  // ---- Visual effect helpers (called by Player / Enemy / Boss) ----

  spawnDamageNumber(x, y, amount, isCrit) {
    const text = this.add.text(x, y, Math.round(amount).toString(), {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: isCrit ? '20px' : '14px',
      color: isCrit ? '#f2a93b' : '#e9edee'
    }).setDepth(60).setOrigin(0.5);
    this.tweens.add({
      targets: text,
      y: y - 36,
      alpha: 0,
      duration: 550,
      onComplete: () => text.destroy()
    });
  }

  spawnHitEffect(x, y, colorKey) {
    const color = CONFIG.COLORS[colorKey] || 0xffffff;
    const quantity = this.lowGraphics ? 3 : 6;
    const emitter = this.add.particles(x, y, 'particle', {
      tint: color,
      speed: { min: 60, max: 140 },
      lifespan: 200,
      scale: { start: 1, end: 0 },
      quantity,
      emitting: false
    });
    emitter.setDepth(45);
    emitter.explode(quantity);
    this.time.delayedCall(260, () => emitter.destroy());
  }

  spawnDeathEffect(x, y, colorKey, big) {
    const color = CONFIG.COLORS[colorKey] || 0xffffff;
    const fullQuantity = big ? 28 : 10;
    const quantity = this.lowGraphics ? Math.ceil(fullQuantity / 2) : fullQuantity;
    const emitter = this.add.particles(x, y, 'particle', {
      tint: color,
      speed: big ? { min: 120, max: 320 } : { min: 70, max: 180 },
      lifespan: big ? 550 : 320,
      scale: { start: big ? 2.2 : 1.3, end: 0 },
      quantity,
      emitting: false
    });
    emitter.setDepth(45);
    emitter.explode(quantity);
    this.time.delayedCall(big ? 650 : 400, () => emitter.destroy());
    if (big) this.shakeCamera(300, 0.01);
  }
}

// ---------------------------------------------------------------------------
// Boot Phaser
// ---------------------------------------------------------------------------
const phaserConfig = {
  type: Phaser.AUTO,
  parent: 'phaser-container',
  width: 1280,
  height: 720,
  backgroundColor: '#14181a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: [BootScene, MenuScene, GameScene]
};

const game = new Phaser.Game(phaserConfig);
Audio.attachSoundManager(game.sound);

UI.init();
