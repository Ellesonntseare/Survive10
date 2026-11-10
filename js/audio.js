/**
 * audio.js
 * --------
 * Every cue tries a real loaded audio file first (see CONFIG.SOUND_ASSETS
 * and BootScene in game.js, which loads them and calls registerLoadedSound()
 * for whichever ones actually loaded), and falls back to a synthesized
 * Web Audio cue for anything missing -- so the game sounds complete with
 * zero audio files, and any file you drop in just replaces that one cue.
 *
 * Volume is controlled by two 0-1 sliders (sfxVolume, musicVolume), set
 * from the Settings screen. A volume of 0 behaves like "off". Both paths
 * (real file and synthesized) respect the same two sliders.
 */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.musicNodes = null;        // synthesized music, when no real file loaded
    this.currentMusicSound = null; // Phaser Sound instance, when a real file loaded
    this.soundManager = null;      // Phaser's global sound manager, attached after boot
    this.loadedSoundKeys = new Set();
    this.sfxVolume = 1.0;
    this.musicVolume = 0.5;
    this._unlocked = false;
  }

  /** Called once from game.js after the Phaser.Game instance exists. */
  attachSoundManager(soundManager) { this.soundManager = soundManager; }

  /** Called from BootScene for each CONFIG.SOUND_ASSETS entry that actually loaded. */
  registerLoadedSound(key) { this.loadedSoundKeys.add(key); }

  /** Must be called after a user gesture (browsers block audio otherwise). */
  unlock() {
    if (this._unlocked) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    this._unlocked = true;
  }

  setSfxVolume(v) { this.sfxVolume = Phaser.Math.Clamp(v, 0, 1); }

  setMusicVolume(v) {
    this.musicVolume = Phaser.Math.Clamp(v, 0, 1);
    if (this.currentMusicSound) {
      this.currentMusicSound.setVolume(this.musicVolume);
    } else if (this.musicNodes) {
      // live-update the running synthesized loop instead of restarting it
      this.musicNodes.master.gain.setTargetAtTime(0.09 * this.musicVolume, this.ctx.currentTime, 0.05);
    } else if (this.musicVolume > 0) {
      this.startMusic();
    }
    if (this.musicVolume <= 0) this.stopMusic();
  }

  /** Plays a real loaded file for `key` if one exists, otherwise runs `synthFn`. */
  _play(key, synthFn) {
    if (this.sfxVolume <= 0) return;
    if (this.loadedSoundKeys.has(key) && this.soundManager) {
      this.soundManager.play(key, { volume: this.sfxVolume });
    } else {
      synthFn();
    }
  }

  _tone({ freq = 440, duration = 0.12, type = 'sine', volume = 0.2, slideTo = null, delay = 0 }) {
    if (this.sfxVolume <= 0 || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t0 + duration);
    }
    gain.gain.setValueAtTime(volume * this.sfxVolume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  _noiseBurst({ duration = 0.15, volume = 0.15, delay = 0 }) {
    if (this.sfxVolume <= 0 || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * this.sfxVolume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(gain).connect(this.ctx.destination);
    src.start(t0);
  }

  // ---- Public cue library -------------------------------------------------
  // Each one tries the matching real file first (same key as in
  // CONFIG.SOUND_ASSETS), falling back to its synthesized version.

  weaponFire() {
    this._play('weaponFire', () => this._tone({ freq: 880, slideTo: 440, duration: 0.06, type: 'square', volume: 0.08 }));
  }
  enemyHit() {
    this._play('enemyHit', () => this._tone({ freq: 320, slideTo: 120, duration: 0.08, type: 'sawtooth', volume: 0.1 }));
  }
  enemyDeath() {
    this._play('enemyDeath', () => {
      this._noiseBurst({ duration: 0.18, volume: 0.14 });
      this._tone({ freq: 200, slideTo: 60, duration: 0.2, type: 'triangle', volume: 0.1 });
    });
  }
  expPickup() {
    this._play('expPickup', () => this._tone({ freq: 700, slideTo: 1100, duration: 0.1, type: 'sine', volume: 0.09 }));
  }
  levelUp() {
    this._play('levelUp', () => {
      [523, 659, 784, 1047].forEach((f, i) => this._tone({ freq: f, duration: 0.18, type: 'triangle', volume: 0.14, delay: i * 0.08 }));
    });
  }
  upgradeSelect() {
    this._play('upgradeSelect', () => this._tone({ freq: 500, slideTo: 900, duration: 0.15, type: 'sine', volume: 0.12 }));
  }
  playerDamage() {
    this._play('playerDamage', () => {
      this._noiseBurst({ duration: 0.12, volume: 0.18 });
      this._tone({ freq: 150, slideTo: 60, duration: 0.15, type: 'sawtooth', volume: 0.12 });
    });
  }
  bossAppear() {
    this._play('bossAppear', () => {
      [110, 90, 70, 55].forEach((f, i) => this._tone({ freq: f, duration: 0.5, type: 'sawtooth', volume: 0.2, delay: i * 0.25 }));
      this._noiseBurst({ duration: 0.8, volume: 0.1, delay: 0.1 });
    });
  }
  bossAttack() {
    this._play('bossAttack', () => this._tone({ freq: 200, slideTo: 40, duration: 0.35, type: 'sawtooth', volume: 0.2 }));
  }
  victory() {
    this._play('victory', () => {
      [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone({ freq: f, duration: 0.3, type: 'triangle', volume: 0.16, delay: i * 0.15 }));
    });
  }
  gameOver() {
    this._play('gameOver', () => {
      [400, 320, 240, 160].forEach((f, i) => this._tone({ freq: f, duration: 0.4, type: 'sawtooth', volume: 0.15, delay: i * 0.18 }));
    });
  }
  uiClick() {
    this._play('uiClick', () => this._tone({ freq: 600, duration: 0.05, type: 'square', volume: 0.06 }));
  }

  // ---- Background music ---------------------------------------------------
  // Plays assets/audio/music_loop.mp3 on loop if it was provided, otherwise
  // falls back to a simple synthesized drone + arpeggio loop.

  startMusic() {
    if (this.musicVolume <= 0) return;

    if (this.loadedSoundKeys.has('musicLoop') && this.soundManager) {
      if (this.currentMusicSound) return;
      this.currentMusicSound = this.soundManager.add('musicLoop', { loop: true, volume: this.musicVolume });
      this.currentMusicSound.play();
      return;
    }

    if (!this.ctx || this.musicNodes) return;
    const master = this.ctx.createGain();
    master.gain.value = 0.09 * this.musicVolume;
    master.connect(this.ctx.destination);

    const drone = this.ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 55;
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.5;
    drone.connect(droneGain).connect(master);
    drone.start();

    const notes = [220, 261.6, 293.7, 261.6];
    let step = 0;
    const arpOsc = this.ctx.createOscillator();
    arpOsc.type = 'triangle';
    const arpGain = this.ctx.createGain();
    arpGain.gain.value = 0.0001;
    arpOsc.connect(arpGain).connect(master);
    arpOsc.start();

    const interval = setInterval(() => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const freq = notes[step % notes.length];
      arpOsc.frequency.setValueAtTime(freq, t);
      arpGain.gain.cancelScheduledValues(t);
      arpGain.gain.setValueAtTime(0.06, t);
      arpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      step++;
    }, 800);

    this.musicNodes = { master, drone, droneGain, arpOsc, arpGain, interval };
  }

  stopMusic() {
    if (this.currentMusicSound) {
      this.currentMusicSound.stop();
      this.currentMusicSound.destroy();
      this.currentMusicSound = null;
    }
    if (this.musicNodes) {
      clearInterval(this.musicNodes.interval);
      try {
        this.musicNodes.drone.stop();
        this.musicNodes.arpOsc.stop();
      } catch (e) { /* already stopped */ }
      this.musicNodes = null;
    }
  }
}

const Audio = new AudioManager();
