/* Procedural art: crisp silhouettes, rooftop detail and baked light pools. */
function createCityArt(scene, generators) {
  const actor = (key, radius, color, kind) => {
    const g = scene.add.graphics();
    const s = radius / 18;
    const rect = (x, y, w, h, c) => { g.fillStyle(c); g.fillRoundedRect(x*s, y*s, w*s, h*s, 2*s); };
    g.fillStyle(0x050a0e, 0.65); g.fillEllipse(18*s, 23*s, 34*s, 25*s);
    rect(8, 24, 7, 10, 0x17212a); rect(22, 24, 7, 10, 0x17212a);
    rect(kind === 'tank' ? 2 : 6, 12, kind === 'tank' ? 32 : 24, 16, color);
    rect(10, 14, 16, 12, 0x263741);
    rect(12, 3, 13, 14, color); rect(13, 7, 12, 5, 0x0b171e);
    rect(14, 8, 10, 2, kind === 'player' ? 0xc6fff2 : 0xffd5a0);
    if (kind === 'player') {
      rect(3, 16, 6, 12, 0x897556); rect(26, 19, 10, 5, 0xd8d9bd);
      rect(29, 20, 7, 2, 0x354650); rect(12, 20, 3, 5, 0xf1bb68);
    } else if (kind === 'fast') {
      rect(0, 18, 9, 4, 0xe9cd82); rect(27, 18, 9, 4, 0xe9cd82);
    } else if (kind === 'ranged') {
      g.lineStyle(2*s, 0x99e9dd); g.strokeCircle(18*s, 22*s, 5*s);
    } else if (kind === 'elite') {
      rect(4, 9, 5, 8, 0xffc17a); rect(28, 9, 5, 8, 0xffc17a);
    }
    g.generateTexture(key, radius*2, radius*2); g.destroy();
  };
  generators.player = () => actor('player', CONFIG.PLAYER_BASE.radius, 0x76c6ae, 'player');
  Object.entries(CONFIG.ENEMY_TYPES).forEach(([key, def]) => {
    generators['enemy_' + key] = () => actor('enemy_' + key, def.radius, CONFIG.COLORS[def.color], key);
  });
  generators.enemy_charger = () => {
    const g=scene.add.graphics();
    g.fillStyle(0x201917);g.fillRoundedRect(2,4,38,34,8);
    g.fillStyle(0xe98345);g.fillTriangle(21,1,40,32,2,32);
    g.fillStyle(0x47312b);g.fillRect(10,19,22,15);
    g.fillStyle(0xffe3aa);g.fillRect(12,14,18,4);
    g.lineStyle(3,0xffc57f);g.lineBetween(6,9,2,1);g.lineBetween(36,9,40,1);
    g.generateTexture('enemy_charger',42,42);g.destroy();
  };
  generators.enemy_brood = () => {
    const g=scene.add.graphics();
    g.lineStyle(4,0x8662a7);
    for(let i=0;i<8;i++) {const a=i*Math.PI/4;g.lineBetween(24,24,24+Math.cos(a)*23,24+Math.sin(a)*23);}
    g.fillStyle(0x573d71);g.fillEllipse(24,24,34,42);
    g.fillStyle(0xbc8fe5);g.fillEllipse(24,21,27,32);
    g.fillStyle(0xe4fca3);g.fillCircle(19,19,5);g.fillCircle(29,19,5);g.fillCircle(24,29,5);
    g.generateTexture('enemy_brood',48,48);g.destroy();
  };
  generators.env_building = () => {
    const g = scene.add.graphics();
    g.fillStyle(0x090f14); g.fillRect(0, 0, 220, 260);
    g.fillStyle(0x39464a); g.fillRect(3, 3, 210, 242);
    g.fillStyle(0x232f35); g.fillRect(12, 12, 192, 222);
    g.lineStyle(1, 0x566064, 0.4);
    for (let y = 20; y < 230; y += 22) g.lineBetween(13, y, 203, y);
    g.fillStyle(0x151f25); g.fillRect(30, 32, 70, 50); g.fillRect(125, 158, 52, 50);
    g.fillStyle(0x4c5b60); g.fillRect(28, 28, 66, 44); g.fillRect(122, 154, 48, 44);
    g.lineStyle(3, 0x26373c);
    for (let x = 34; x < 90; x += 9) g.lineBetween(x, 33, x, 65);
    g.fillStyle(0xa08856); g.fillRect(30, 248, 24, 4); g.fillRect(150, 248, 24, 4);
    g.generateTexture('env_building', 220, 260); g.destroy();
  };
  const glow = scene.textures.createCanvas('city_glow', 256, 256);
  const ctx = glow.context;
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,203,119,0.34)');
  gradient.addColorStop(0.25, 'rgba(245,174,76,0.12)');
  gradient.addColorStop(1, 'rgba(245,174,76,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256); glow.refresh();
}

function buildCityArena(scene, width, height, seed, quality) {
  const rand = new Phaser.Math.RandomDataGenerator([String(seed || 1)]);
  const low = quality === 'low';
  const props = scene.add.group();
  const ground = scene.add.graphics().setDepth(-100);
  ground.fillStyle(0x172329); ground.fillRect(0, 0, width, height);
  const spacing = CONFIG.WORLD.LANE_SPACING;
  for (let x = 0; x < width; x += spacing) {
    for (let y = 0; y < height; y += spacing) {
      ground.fillStyle(0x28363b); ground.fillRect(x+82, y+82, spacing-164, spacing-164);
      ground.lineStyle(2, 0x3d4a4d, 0.6); ground.strokeRect(x+85, y+85, spacing-170, spacing-170);
      // Place within blocks; road coordinates are never used as a skip test.
      if (x+spacing > width || y+spacing > height) continue;
      const cx = x+spacing/2, cy = y+spacing/2;
      if (!low || rand.frac() > 0.4) {
        props.add(scene.add.ellipse(cx+17, cy+23, 256, 276, 0x050b10, 0.4).setDepth(-30));
        props.add(scene.add.image(cx, cy, 'env_building').setAlpha(0.7).setDepth(-20));
      }
      props.add(scene.add.image(x+110, y+rand.between(130, 340), rand.frac() < 0.5 ? 'env_car' : 'env_carwreck').setAngle(90).setDepth(-20));
      if (!low) {
        props.add(scene.add.image(x+spacing-110, y+110, 'env_tree').setDepth(-20));
        props.add(scene.add.image(x+68, y+68, 'city_glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(-12));
        props.add(scene.add.image(x+68, y+90, 'env_streetlight').setScale(0.6).setDepth(-15));
      }
      ground.fillStyle(0xc6c2a4, 0.22);
      for (let i = -3; i <= 3; i++) {
        ground.fillRect(x-36, y+75+i*9, 72, 4);
        ground.fillRect(x+75+i*9, y-36, 4, 72);
      }
    }
  }
  ground.lineStyle(2, 0xb7a675, 0.22);
  for (let x = spacing; x < width; x += spacing)
    for (let y = 125; y < height; y += 36) ground.lineBetween(x, y, x, y+16);
  for (let y = spacing; y < height; y += spacing)
    for (let x = 125; x < width; x += 36) ground.lineBetween(x, y, x+16, y);
  for (let i = 0; i < (low ? 250 : 1500); i++) {
    const x = rand.between(0, width), y = rand.between(0, height);
    ground.lineStyle(1, rand.pick([0x87918a, 0x090f15]), 0.2);
    ground.lineBetween(x, y, x+rand.between(2, 15), y+rand.between(-3, 3));
  }
  return props;
}
