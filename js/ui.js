/**
 * ui.js
 * -----
 * Everything DOM-related lives here. This file never touches Phaser
 * objects directly -- it only listens to EventBus events emitted by
 * the game systems, and emits its own EventBus events (e.g.
 * 'request-play') that game.js listens for. That keeps the DOM layer
 * and the Phaser layer decoupled.
 */

const UI = {
  screens: {},
  el: {},
  settingsReturnScreen: 'menu', // where BACK on Settings should go: 'menu' or 'pause'

  init() {
    this.cacheElements();
    this.renderCharacterCards();
    this.bindButtons();
    this.bindEventBus();
    this.applySavedSettings();
    this.showScreen('menu');
  },

  cacheElements() {
    this.screens = {
      menu: document.getElementById('screen-menu'),
      howto: document.getElementById('screen-howto'),
      select: document.getElementById('screen-select'),
      settings: document.getElementById('screen-settings'),
      levelup: document.getElementById('screen-levelup'),
      pause: document.getElementById('screen-pause'),
      gameover: document.getElementById('screen-gameover'),
      victory: document.getElementById('screen-victory')
    };
    this.el = {
      hud: document.getElementById('hud'),
      hudLevel: document.getElementById('hud-level'),
      hudHealthFill: document.getElementById('hud-health-fill'),
      hudHealthText: document.getElementById('hud-health-text'),
      hudExpFill: document.getElementById('hud-exp-fill'),
      hudTimer: document.getElementById('hud-timer'),
      hudKills: document.getElementById('hud-kills'),
      hudScore: document.getElementById('hud-score'),
      hudWeaponName: document.getElementById('hud-weapon-name'),
      hudWeaponDetail: document.getElementById('hud-weapon-detail'),
      bossBanner: document.getElementById('boss-banner'),
      bossBannerName: document.getElementById('boss-banner-name'),
      bossHealthbar: document.getElementById('boss-healthbar'),
      bossHbFill: document.getElementById('boss-hb-fill'),
      upgradeCards: document.getElementById('upgrade-cards'),
      characterCards: document.getElementById('character-cards'),
      menuBestRun: document.getElementById('menu-best-run'),
      gameoverStats: document.getElementById('gameover-stats'),
      victoryStats: document.getElementById('victory-stats'),
      sliderSfx: document.getElementById('slider-sfx'),
      sliderMusic: document.getElementById('slider-music'),
      toggleGraphics: document.getElementById('toggle-graphics')
    };
  },

  renderCharacterCards() {
    this.el.characterCards.innerHTML = '';
    CONFIG.CHARACTERS.forEach(char => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'character-card';
      card.innerHTML = `
        <div class="character-name">${char.name}</div>
        <div class="character-tagline">${char.tagline}</div>
        <div class="character-summary">${char.summary}</div>`;
      card.addEventListener('click', () => {
        Audio.uiClick();
        this.hideAllScreens();
        this.showHud();
        EventBus.emit('request-play', { character: char.id, companion: document.querySelector('input[name=companion]:checked').value });
      });
      this.el.characterCards.appendChild(card);
    });
  },

  bindButtons() {
    const click = (id, fn) => document.getElementById(id).addEventListener('click', () => { Audio.uiClick(); fn(); });

    click('btn-play', () => this.showScreen('select'));
    click('btn-select-back', () => this.showScreen('menu'));
    click('btn-howto', () => this.showScreen('howto'));
    click('btn-howto-back', () => this.showScreen('menu'));

    click('btn-settings', () => { this.settingsReturnScreen = 'menu'; this.showScreen('settings'); });
    click('btn-settings-pause', () => { this.settingsReturnScreen = 'pause'; this.showScreen('settings'); });
    click('btn-settings-back', () => this.showScreen(this.settingsReturnScreen));

    click('btn-resume', () => { this.showScreen(null); this.showHud(); EventBus.emit('request-resume'); });
    click('btn-restart-pause', () => { this.hideAllScreens(); this.showHud(); EventBus.emit('request-restart'); });
    click('btn-menu-pause', () => { this.hideAllScreens(); this.hideHud(); EventBus.emit('request-menu'); });

    click('btn-tryagain', () => { this.hideAllScreens(); this.showHud(); EventBus.emit('request-restart'); });
    click('btn-menu-gameover', () => { this.hideAllScreens(); this.hideHud(); EventBus.emit('request-menu'); });

    click('btn-playagain', () => { this.hideAllScreens(); this.showHud(); EventBus.emit('request-restart'); });
    click('btn-menu-victory', () => { this.hideAllScreens(); this.hideHud(); EventBus.emit('request-menu'); });

    this.el.sliderSfx.addEventListener('input', (e) => {
      const v = Number(e.target.value) / 100;
      Audio.setSfxVolume(v);
      SaveManager.setSfxVolume(v);
    });
    this.el.sliderMusic.addEventListener('input', (e) => {
      const v = Number(e.target.value) / 100;
      Audio.setMusicVolume(v);
      SaveManager.setMusicVolume(v);
    });
    this.el.toggleGraphics.addEventListener('change', (e) => {
      const quality = e.target.checked ? 'low' : 'high';
      SaveManager.setGraphicsQuality(quality);
      EventBus.emit('graphics-quality-changed', quality);
    });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') EventBus.emit('escape-pressed');
    });
  },

  applySavedSettings() {
    const data = SaveManager.load();
    this.el.sliderSfx.value = Math.round(data.sfxVolume * 100);
    this.el.sliderMusic.value = Math.round(data.musicVolume * 100);
    this.el.toggleGraphics.checked = data.graphicsQuality === 'low';
    Audio.setSfxVolume(data.sfxVolume);
    Audio.setMusicVolume(data.musicVolume);

    const best = data.bestRun;
    if (best) {
      this.el.menuBestRun.innerHTML =
        `BEST RUN &nbsp; SCORE ${best.score} &nbsp;·&nbsp; LV ${best.level} &nbsp;·&nbsp; ${this.formatTime(best.survivalMs)}` +
        (best.bossDefeated ? ' &nbsp;·&nbsp; BOSS DEFEATED' : '');
    } else {
      this.el.menuBestRun.innerHTML = 'No runs yet. The city is waiting.';
    }
  },

  bindEventBus() {
    EventBus.on('player-damaged', ({ health, maxHealth }) => {
      const pct = Math.max(0, health / maxHealth) * 100;
      this.el.hudHealthFill.style.width = `${pct}%`;
      this.el.hudHealthText.textContent = `${Math.max(0, Math.round(health))} / ${Math.round(maxHealth)}`;
    });

    EventBus.on('exp-changed', ({ exp, expToNext, level }) => {
      this.el.hudExpFill.style.width = `${Math.min(100, (exp / expToNext) * 100)}%`;
      this.el.hudLevel.textContent = level;
    });

    EventBus.on('hud-timer', (text) => { this.el.hudTimer.textContent = text; });

    EventBus.on('hud-stats', ({ kills, score }) => {
      this.el.hudKills.textContent = kills;
      this.el.hudScore.textContent = score;
    });

    EventBus.on('hud-weapon', ({ name, damage, attackSpeed, orbitUnlocked, orbitCount, orbitDamage, shotgun, arc }) => {
      this.el.hudWeaponName.textContent = name;
      let detail = `DMG ${Math.round(damage)} · SPD ${attackSpeed.toFixed(2)}/s`;
      if (orbitUnlocked) {
        detail += ` · Blades x${Math.round(orbitCount)} (${Math.round(orbitDamage)} dmg)`;
      }
      if (shotgun) detail += ` · Scattergun ${shotgun} pellets`;
      if (arc) detail += ` · Arc ${arc} targets`;
      this.el.hudWeaponDetail.textContent = detail;
    });

    EventBus.on('hud-content', ({missions,buffs,toast}) => {
      document.getElementById('mission-hud').innerHTML='<div class="mission-title">FIELD MISSIONS</div>'+missions.map(m=>'<div class="mission '+(m.done?'complete':'')+'"><span>'+ (m.done?'✓ ': '')+m.name+'</span><b>'+m.value+'/'+m.goal+'</b><small>'+m.detail+' · '+m.reward+'</small><progress value="'+m.value+'" max="'+m.goal+'"></progress></div>').join('');
      document.getElementById('buff-hud').textContent=buffs.join(' · ');
      document.getElementById('content-toast').textContent=toast;
    });
    EventBus.on('show-levelup', (stats) => this.showLevelUp(stats));

    EventBus.on('boss-incoming', ({ name }) => {
      this.el.bossBannerName.textContent = `${name} HAS ARRIVED`;
      this.el.bossBanner.classList.remove('hidden');
      this.el.bossHealthbar.classList.remove('hidden');
      document.getElementById('boss-hb-label').textContent = name;
      setTimeout(() => this.el.bossBanner.classList.add('hidden'), 2600);
    });

    EventBus.on('boss-health', ({ health, maxHealth }) => {
      this.el.bossHbFill.style.width = `${Math.max(0, (health / maxHealth) * 100)}%`;
    });

    EventBus.on('boss-defeated', () => this.el.bossHealthbar.classList.add('hidden'));

    EventBus.on('show-pause', () => this.showScreen('pause'));
    EventBus.on('show-gameover', (stats) => this.showGameOver(stats));
    EventBus.on('show-victory', (stats) => this.showVictory(stats));
    EventBus.on('show-menu', () => { this.hideHud(); this.applySavedSettings(); this.showScreen('menu'); });
  },

  formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  },

  showScreen(name) {
    Object.values(this.screens).forEach(s => s.classList.remove('active'));
    if (name && this.screens[name]) this.screens[name].classList.add('active');
  },

  hideAllScreens() { this.showScreen(null); },
  showHud() { this.el.hud.classList.remove('hidden'); },
  hideHud() { this.el.hud.classList.add('hidden'); },

  showLevelUp(stats) {
    const choices = UpgradeSystem.rollThree(stats);
    this.el.upgradeCards.innerHTML = '';
    choices.forEach(choice => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'upgrade-card';
      card.innerHTML = `
        <div class="upgrade-icon" aria-hidden="true">${choice.icon || "✦"}</div><div class="upgrade-name">${choice.name}</div>
        <div class="upgrade-desc">${choice.format}</div>
        <div class="upgrade-values">
          <span>${choice.currentValueLabel}</span>
          <span class="to-value">${choice.newValueLabel}</span>
        </div>`;
      card.addEventListener('click', () => {
        Audio.upgradeSelect();
        EventBus.emit('upgrade-chosen', choice);
        this.showScreen(null);
      });
      this.el.upgradeCards.appendChild(card);
    });
    this.showScreen('levelup');
  },

  statRow(label, value) {
    return `<span class="r-label">${label}</span><span class="r-value">${value}</span>`;
  },

  showGameOver(stats) {
    this.el.gameoverStats.innerHTML =
      this.statRow('SURVIVAL TIME', this.formatTime(stats.survivalMs)) +
      this.statRow('ENEMIES DEFEATED', stats.enemiesDefeated) +
      this.statRow('LEVEL REACHED', stats.level) +
      this.statRow('FINAL SCORE', stats.score) +
      this.statRow('BEST SURVIVAL TIME', this.formatTime(Math.max(stats.survivalMs, stats.longestSurvivalMs)));
    this.hideHud();
    this.showScreen('gameover');
  },

  showVictory(stats) {
    this.el.victoryStats.innerHTML =
      this.statRow('SURVIVAL TIME', this.formatTime(stats.survivalMs)) +
      this.statRow('ENEMIES DEFEATED', stats.enemiesDefeated) +
      this.statRow('BOSS DEFEATED', 'YES') +
      this.statRow('LEVEL', stats.level) +
      this.statRow('FINAL SCORE', stats.score);
    this.hideHud();
    this.showScreen('victory');
  }
};
