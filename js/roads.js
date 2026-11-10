// Shared road geometry for movement, spawning and shooting.
const Roads = {
  half: 82,
  blocks: [],
  build(scene) {
    this.blocks = [];
    scene.roadWalls = scene.physics.add.staticGroup();
    const s = CONFIG.WORLD.LANE_SPACING;
    for (let x = 0; x < CONFIG.WORLD.WIDTH; x += s) {
      for (let y = 0; y < CONFIG.WORLD.HEIGHT; y += s) {
        const r = {x:x+this.half, y:y+this.half,
          w:Math.min(s-this.half*2, CONFIG.WORLD.WIDTH-x-this.half),
          h:Math.min(s-this.half*2, CONFIG.WORLD.HEIGHT-y-this.half)};
        if(r.w <= 0 || r.h <= 0) continue;
        this.blocks.push(r);
        const wall = scene.add.rectangle(r.x+r.w/2,r.y+r.h/2,r.w,r.h).setVisible(false);
        scene.physics.add.existing(wall,true); scene.roadWalls.add(wall);
      }
    }
  },
  snap(x,y) {
    const s = CONFIG.WORLD.LANE_SPACING;
    const rx = Math.max(s, Math.min(Math.round(x/s)*s, Math.floor(CONFIG.WORLD.WIDTH/s)*s));
    const ry = Math.max(s, Math.min(Math.round(y/s)*s, Math.floor(CONFIG.WORLD.HEIGHT/s)*s));
    if(Math.abs(x-rx) < Math.abs(y-ry)) x=rx; else y=ry;
    return {x:Phaser.Math.Clamp(x,65,CONFIG.WORLD.WIDTH-65),y:Phaser.Math.Clamp(y,65,CONFIG.WORLD.HEIGHT-65)};
  },
  clear(x1,y1,x2,y2,padding=0) {
    // Segment vs expanded rectangles, including long frames and fast bullets.
    return !this.blocks.some(r => {
      let lo=0, hi=1;
      for(const [p,d,min,max] of [[x1,x2-x1,r.x-padding,r.x+r.w+padding],[y1,y2-y1,r.y-padding,r.y+r.h+padding]]) {
        if(Math.abs(d)<0.0001) { if(p<min || p>max) return false; }
        else { const a=(min-p)/d,b=(max-p)/d; lo=Math.max(lo,Math.min(a,b)); hi=Math.min(hi,Math.max(a,b)); if(lo>hi)return false; }
      }
      return true;
    });
  }
};
