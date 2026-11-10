/* Run content: enemies, companion weapons, missions and temporary pickups. */
Object.assign(CONFIG.COLORS, {charger:0xf08d52, brood:0xbb8bec});
Object.assign(CONFIG.ENEMY_TYPES, {
  charger:{key:'charger',label:'Roadbreaker',color:'charger',radius:21,speed:58,health:55,damage:12,expValue:14,scoreValue:30,contactCooldownMs:850,knockbackResist:0.4},
  brood:{key:'brood',label:'Brood pod',color:'brood',radius:24,speed:40,health:70,damage:9,expValue:16,scoreValue:35,contactCooldownMs:900,knockbackResist:0.6}
});
for (const key of ['charger','brood']) {
  const size=CONFIG.ENEMY_TYPES[key].radius*2;
  CONFIG.ASSETS.push({key:'enemy_'+key,path:'assets/enemies/'+key+'.png',width:size,height:size});
}
CONFIG.PHASES[0].types={basic:0.76,fast:0.12,charger:0.12};
CONFIG.PHASES[1].types={basic:0.4,fast:0.25,charger:0.2,brood:0.15};
for (let i=2;i<CONFIG.PHASES.length;i++) Object.assign(CONFIG.PHASES[i].types,{charger:0.18,brood:0.16});

const EXPANSION_STATS={shotgunUnlocked:false,shotgunPellets:5,shotgunDamage:0.65,arcUnlocked:false,arcJumps:3,arcDamage:1.7,pickupRadius:42};
const contentUpgrade=(id,name,format,field,apply,available,icon) => ({id,name,format,field,apply,available,icon,describe:v=>typeof v==='boolean'?(v?'Equipped':'Not equipped'):`${name}: ${Number(v.toFixed(2))}`});
UPGRADE_POOL.push(
  contentUpgrade('shotgunUnlock','SCATTERGUN','Add an automatic five-pellet shotgun. Mouse aiming also directs its spread.','shotgunUnlocked',s=>s.shotgunUnlocked=true,s=>!s.shotgunUnlocked,'⋔'),
  contentUpgrade('shotgunPellets','BUCKSHOT','Shotgun fires 2 extra pellets (maximum 11).','shotgunPellets',s=>s.shotgunPellets=Math.min(11,s.shotgunPellets+2),s=>s.shotgunUnlocked&&s.shotgunPellets<11,'⋔'),
  contentUpgrade('shotgunDamage','HOT SHELLS','Shotgun pellet damage +30%.','shotgunDamage',s=>s.shotgunDamage*=1.3,s=>s.shotgunUnlocked,'✦'),
  contentUpgrade('arcUnlock','ARC COIL','Add chain lightning that jumps between enemies in sight.','arcUnlocked',s=>s.arcUnlocked=true,s=>!s.arcUnlocked,'ϟ'),
  contentUpgrade('arcJumps','CHAIN REACTION','Lightning strikes one additional enemy (maximum 7).','arcJumps',s=>s.arcJumps=Math.min(7,s.arcJumps+1),s=>s.arcUnlocked&&s.arcJumps<7,'ϟ'),
  contentUpgrade('arcDamage','HIGH VOLTAGE','Chain lightning damage +30%.','arcDamage',s=>s.arcDamage*=1.3,s=>s.arcUnlocked,'✦'),
  contentUpgrade('pickupRadius','SALVAGE FIELD','Increase experience pickup radius by 20 (maximum 142).','pickupRadius',s=>s.pickupRadius=Math.min(142,s.pickupRadius+20),s=>s.pickupRadius<142,'◎')
);

class CompanionWeapons {
  constructor(scene) { this.scene=scene; this.shotTimer=0; this.arcTimer=0; }
  update(delta,player,manager,boss) {
    const scene=this.scene,s=player.stats;
    const targets=boss?.alive?[...manager.enemies,boss]:manager.enemies;
    this.shotTimer-=delta; this.arcTimer-=delta;
    const target=scene.weapon.findNearestEnemy(player,targets,s.attackRange);
    const pointer=scene.input.activePointer;
    const manual=pointer.isDown&&pointer.leftButtonDown();
    const aim=pointer.positionToCamera(scene.cameras.main);
    const angle=manual?Math.atan2(aim.y-player.y,aim.x-player.x):target?Math.atan2(target.sprite.y-player.y,target.sprite.x-player.x):0;
    const rate=Math.max(0.2,s.attackSpeed*scene.runContent.fireRate);
    if(s.shotgunUnlocked&&this.shotTimer<=0&&(target||manual)) {
      this.shotTimer=1800/rate;
      for(let i=0;i<s.shotgunPellets;i++) {
        const a=angle+(i-(s.shotgunPellets-1)/2)*0.12;
        scene.weapon.fireProjectile(player,a,{damage:s.damage*s.shotgunDamage,color:0xffd395,lifespan:650,size:4});
      }
      scene.weapon.muzzleFlash(player,angle); Audio.weaponFire();
    }
    if(s.arcUnlocked&&this.arcTimer<=0&&target) {
      this.arcTimer=2100/rate;
      const hit=new Set(); let from={x:player.x,y:player.y}; let next=target;
      const bolt=scene.add.graphics().setDepth(52);
      bolt.lineStyle(3,0x9deeff,1);
      for(let i=0;i<s.arcJumps&&next;i++) {
        const to={x:next.sprite.x,y:next.sprite.y};
        // Every segment is checked against walls, including chained targets.
        if(!Roads.clear(from.x,from.y,to.x,to.y,3)) break;
        bolt.lineBetween(from.x,from.y,(from.x+to.x)/2+5,(from.y+to.y)/2-5);
        bolt.lineBetween((from.x+to.x)/2+5,(from.y+to.y)/2-5,to.x,to.y);
        hit.add(next); next.takeDamage(s.damage*s.arcDamage,false); from=to;
        next=scene.weapon.findNearestEnemy(from,targets.filter(t=>!hit.has(t)),180);
      }
      scene.tweens.add({targets:bolt,alpha:0,duration:180,onComplete:()=>bolt.destroy()});
    }
  }
}

const PICKUPS={
  medkit:{name:'MEDKIT',icon:'+',color:0x8de3b3,description:'Restored 35% health'},
  overdrive:{name:'OVERDRIVE',icon:'ϟ',color:0xffc16b,description:'Faster shots and movement · 8s'},
  shield:{name:'SHIELD',icon:'⬡',color:0x8fd9ff,description:'Damage immunity · 6s'},
  magnet:{name:'MAGNET',icon:'◎',color:0xc9a1ff,description:'Wide salvage field · 10s'}
};
class RunContent {
  constructor(scene) {
    this.scene=scene; this.pickups=[]; this.collected=0; this.kills=0;
    this.buffs={overdrive:0,shield:0,magnet:0}; this.toast=''; this.toastUntil=0; this.lastHud='';
    this.missions=[
      {name:'CLEAR THE BLOCK',detail:'Defeat 15 enemies',goal:15,kind:'kills',reward:'+15 max health & heal 25',done:false},
      {name:'SALVAGE RUN',detail:'Collect 100 experience',goal:100,kind:'xp',reward:'Companion weapon upgrade',done:false},
      {name:'HOLD THE LINE',detail:'Survive 2 minutes',goal:120,kind:'time',reward:'Shield & 250 score',done:false}
    ];
    this.aura=scene.add.circle(0,0,27,0x8fd9ff,0).setStrokeStyle(2,0x8fd9ff,0.85).setDepth(49).setVisible(false);
    scene.cameras.main.ignore([]);
    scene.busOn('enemy-killed',e=>this.onKill(e));
    scene.busOn('salvage-collected',n=>{this.collected+=n;});
  }
  get fireRate() { return this.buffs.overdrive>0?1.75:1; }
  get moveRate() { return this.buffs.overdrive>0?1.2:1; }
  notify(text) { this.toast=text;this.toastUntil=this.scene.elapsedMs+4000; }
  onKill(e) {
    this.kills++;
    if(this.pickups.length<8&&(this.kills%6===0||Math.random()<0.12)) {
      const kinds=Object.keys(PICKUPS); this.spawn(e.x,e.y,kinds[Math.floor(Math.random()*kinds.length)]);
    }
  }
  spawn(x,y,kind) {
    if(!Number.isFinite(x)||!Number.isFinite(y)) return;
    const def=PICKUPS[kind],scene=this.scene;
    const ring=scene.add.circle(0,0,15,0x0c1b25,0.95).setStrokeStyle(2,def.color);
    const label=scene.add.text(0,0,def.icon,{fontFamily:'sans-serif',fontSize:'22px',color:'#'+def.color.toString(16)}).setOrigin(0.5);
    const tag=scene.add.text(0,22,def.name,{fontFamily:'monospace',fontSize:'9px',color:'#dce7e6'}).setOrigin(0.5);
    const sprite=scene.add.container(x,y,[ring,label,tag]).setDepth(23);
    this.pickups.push({sprite,kind,remaining:20000});
  }
  collect(kind) {
    const p=this.scene.player;
    if(kind==='medkit') p.heal(Math.round(p.stats.maxHealth*0.35));
    else this.buffs[kind]={overdrive:8000,shield:6000,magnet:10000}[kind];
    Audio.expPickup(); this.notify(PICKUPS[kind].description);
  }
  update(delta) {
    const scene=this.scene,p=scene.player;
    for(const key of Object.keys(this.buffs)) this.buffs[key]=Math.max(0,this.buffs[key]-delta);
    this.aura.setPosition(p.x,p.y).setVisible(this.buffs.shield>0);
    this.pickups=this.pickups.filter(drop=>{
      drop.remaining-=delta;
      drop.sprite.setAlpha(drop.remaining<4000?0.5+0.5*Math.sin(drop.remaining/140):1);
      const distance=Math.hypot(drop.sprite.x-p.x,drop.sprite.y-p.y);
      if(distance<38&&Roads.clear(p.x,p.y,drop.sprite.x,drop.sprite.y,3)) {
        this.collect(drop.kind); drop.sprite.destroy();return false;
      }
      if(drop.remaining<=0) {drop.sprite.destroy();return false;} return true;
    });
    const values={kills:this.kills,xp:this.collected,time:Math.floor(scene.elapsedMs/1000)};
    for(const m of this.missions) {
      if(!m.done&&values[m.kind]>=m.goal) {
        m.done=true;
        if(m.kind==='kills') {p.stats.maxHealth+=15;p.heal(25);}
        if(m.kind==='xp') {
          if(p.stats.shotgunUnlocked) p.stats.shotgunPellets=Math.min(11,p.stats.shotgunPellets+1);
          else p.stats.arcJumps=Math.min(7,p.stats.arcJumps+1);
        }
        if(m.kind==='time') {this.collect('shield');scene.score+=250;scene.pushHudStats();}
        Audio.upgradeSelect();this.notify('MISSION COMPLETE · '+m.name+' · '+m.reward); scene.pushWeaponHud();
      }
    }
    const payload={missions:this.missions.map(m=>({...m,value:Math.min(m.goal,values[m.kind])})),
      buffs:Object.entries(this.buffs).filter(([,v])=>v>0).map(([k,v])=>PICKUPS[k].name+' '+Math.ceil(v/1000)+'s'),
      toast:scene.elapsedMs<this.toastUntil?this.toast:''};
    const signature=JSON.stringify(payload);
    if(signature!==this.lastHud) {EventBus.emit('hud-content',payload);this.lastHud=signature;}
  }
}
