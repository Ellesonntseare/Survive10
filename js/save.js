/**
 * save.js
 * -------
 * Thin wrapper around localStorage. Nothing here should know anything
 * about Phaser -- it just reads and writes plain JSON.
 */

const SaveManager = {
  defaults() {
    return {
      highScore: 0,
      highestLevel: 1,
      longestSurvivalMs: 0,
      totalEnemiesDefeated: 0,
      bestRun: null, // { score, level, survivalMs, enemiesDefeated, bossDefeated }
      sfxVolume: 1.0,
      musicVolume: 0.5,
      graphicsQuality: 'high' // 'high' | 'low'
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(CONFIG.SAVE_KEY);
      if (!raw) return this.defaults();
      const parsed = JSON.parse(raw);
      return Object.assign(this.defaults(), parsed);
    } catch (e) {
      console.warn('Save data corrupt, resetting.', e);
      return this.defaults();
    }
  },

  save(data) {
    try {
      localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not persist save data.', e);
    }
  },

  /**
   * Merge the results of a finished run into the persisted save data.
   * Returns the updated save object.
   */
  recordRun(result) {
    const data = this.load();
    data.totalEnemiesDefeated += result.enemiesDefeated;
    data.highScore = Math.max(data.highScore, result.score);
    data.highestLevel = Math.max(data.highestLevel, result.level);
    data.longestSurvivalMs = Math.max(data.longestSurvivalMs, result.survivalMs);

    const isBest = !data.bestRun || result.score > data.bestRun.score;
    if (isBest) {
      data.bestRun = {
        score: result.score,
        level: result.level,
        survivalMs: result.survivalMs,
        enemiesDefeated: result.enemiesDefeated,
        bossDefeated: !!result.bossDefeated
      };
    }
    this.save(data);
    return data;
  },

  setSfxVolume(v) {
    const data = this.load();
    data.sfxVolume = v;
    this.save(data);
  },

  setMusicVolume(v) {
    const data = this.load();
    data.musicVolume = v;
    this.save(data);
  },

  setGraphicsQuality(q) {
    const data = this.load();
    data.graphicsQuality = q;
    this.save(data);
  }
};
