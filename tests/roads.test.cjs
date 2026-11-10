const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const ctx = vm.createContext({console, Phaser:{Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}}, CONFIG:{WORLD:{WIDTH:3200,HEIGHT:3200,LANE_SPACING:480}}});
vm.runInContext(readFileSync(path.join(__dirname,'../js/roads.js'),'utf8')+'\nthis.Roads=Roads;',ctx);
const walls=[];
ctx.Roads.build({physics:{add:{staticGroup:()=>({add:w=>walls.push(w)}),existing:()=>{}}},add:{rectangle:()=>({setVisible(){return this;}})}});
assert(walls.length>0);
assert(ctx.Roads.clear(480,150,480,1100,26), 'vertical road is traversable');
assert(ctx.Roads.clear(150,480,1100,480,18), 'horizontal road is traversable');
assert(!ctx.Roads.clear(480,240,960,240,6), 'bullets cannot cross a city block');
assert(!ctx.Roads.clear(480,350,610,480,26), 'large actors cannot cut corners');
assert(!ctx.Roads.clear(0,240,1200,240,6), 'long-frame bullets still hit walls');
for(let x=0;x<=3200;x+=73) for(let y=0;y<=3200;y+=97) {
  const p=ctx.Roads.snap(x,y);
  assert(ctx.Roads.clear(p.x,p.y,p.x,p.y,26), `spawn inside block at ${p.x},${p.y}`);
}
vm.runInContext(readFileSync(path.join(__dirname,'../js/weapons.js'),'utf8')+'\nthis.Weapon=Weapon;',ctx);
let shot;
const scene={add:{circle:()=>shot={setDepth(){},body:{setCircle(){},setVelocity(x,y){this.vx=x;this.vy=y;}}}},physics:{add:{group:()=>({add:p=>p.body.setVelocity(0,0)}),existing:()=>{}}}};
ctx.CONFIG.COLORS={projectilePlayer:0};
const weapon=new ctx.Weapon(scene);
weapon.fireProjectile({x:480,y:480,stats:{projectileSize:1,projectileSpeed:480,critChance:0,damage:10}},0);
assert.equal(shot.body.vx,480,'group insertion must not stop shots');
assert.equal(shot.body.vy,0);
console.log('PASS: roads, corner clearance, blocked shots, spawn safety and projectile velocity');

