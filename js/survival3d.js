function createSurvival3D(host) {
  const T=THREE,scene=host.scene,camera=host.camera;
  const layer=new T.Group();scene.add(layer);
  const ray=new T.Raycaster(),direction=new T.Vector3();
  const geometry={box:new T.BoxGeometry(1,1,1),sphere:new T.SphereGeometry(1,12,8),pod:new T.IcosahedronGeometry(1,1),ring:new T.TorusGeometry(1,.08,6,20)};
  const materials=new Map();
  const material=(color,glow=false)=>{
    const key=color+':'+glow;
    if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:glow?.3:.65,metalness:.35,emissive:glow?color:0,emissiveIntensity:glow?1.2:0}));
    return materials.get(key);
  };
  function part(parent,shape,color,x,y,z,sx,sy,sz,glow=false) {
    const m=new T.Mesh(geometry[shape],material(color,glow));m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
  }
  const types={
    shambler:{name:'REVENANT',color:0xa74656,hp:32,speed:1.25,damage:8,r:.32,xp:8},
    runner:{name:'STALKER',color:0x62c5bd,hp:23,speed:2.3,damage:6,r:.26,xp:9},
    charger:{name:'ROADBREAKER',color:0xe38b42,hp:76,speed:1.15,damage:15,r:.42,xp:15},
    brood:{name:'BROOD POD',color:0x9d65d6,hp:80,speed:.85,damage:10,r:.45,xp:18},
    spitter:{name:'SPITTER',color:0x9bbf4a,hp:50,speed:1.15,damage:8,r:.3,xp:12},
    tank:{name:'SENTINEL',color:0x536887,hp:210,speed:.8,damage:20,r:.56,xp:25},
    boss:{name:'THE OVERSEER',color:0x384657,hp:2200,speed:1.4,damage:26,r:.78,xp:100}
  };
  const weapons={blaster:{name:'SCRAP BLASTER',cooldown:.3,damage:18,range:36,color:0xffcf83},shotgun:{name:'SCATTERGUN',cooldown:.85,damage:12,range:17,color:0xffa05d},arc:{name:'ARC COIL',cooldown:.65,damage:27,range:23,color:0x79ddff}};
  const pickupInfo={medkit:['MEDKIT','+',0x72e0a5],overdrive:['OVERDRIVE','ϟ',0xffb854],shield:['SHIELD','⬡',0x7bcfff],magnet:['MAGNET','◎',0xc09aff]};
  let run,nav,enemies=[],drops=[],effects=[],bolts=[],gun,gunBarrel,flash,held=false,fireTimer=0,spawnTimer=0,hurtTimer=0,recoil=0,current='blaster',unlocked,stats,bossSpawned=false,ended=false,toastTime=0,hudTimer=0,missionCount=0;

  const ui=document.createElement('div');ui.id='survival-ui';ui.className='hidden';
  ui.innerHTML=`<div id="vitals"><span class="eyebrow">VITAL SIGNS</span><strong id="health-value">100</strong><div class="meter"><i id="health-fill"></i></div><div id="level-value"></div><div class="meter xp"><i id="xp-fill"></i></div></div>
    <div id="run-clock"><small>EXTRACTION IN</small><strong id="survival-timer">10:00</strong></div>
    <div id="field-orders"><div class="eyebrow">FIELD ORDERS</div><div id="mission-list"></div></div>
    <div id="weapon-strip"></div><div id="active-effects"></div><div id="run-toast" role="status"></div>
    <div id="combat-hint">WASD move · Mouse aim · Hold click / Space fire · 1–3 switch · Esc pause</div>
    <div id="boss-meter" class="hidden"><span>THE OVERSEER</span><div class="meter"><i></i></div></div><div id="damage-flash"></div>`;
  document.getElementById('app').append(ui);
  const upgrade=document.createElement('section');upgrade.className='overlay hidden';upgrade.id='upgrade-overlay';upgrade.innerHTML='<div class="eyebrow">FIELD ENGINEERING</div><h1>Choose an upgrade</h1><p>Build your loadout. Combat is paused.</p><div id="fps-upgrades"></div>';document.getElementById('app').append(upgrade);
  const result=document.createElement('section');result.className='overlay hidden';result.id='result-overlay';result.innerHTML='<div class="eyebrow">RUN COMPLETE</div><h1 id="result-title"></h1><p id="result-stats"></p><button class="startBtn" id="retry-survival">DEPLOY AGAIN</button>';document.getElementById('app').append(result);
  document.getElementById('retry-survival').onclick=()=>{result.classList.add('hidden');host.restart();};
  const start=document.getElementById('startOverlay');
  start.querySelector('h1').textContent='SURVIVE 10';
  start.querySelector('p').textContent='Lost inside the quarantine labyrinth. Survive ten minutes, then defeat the Overseer. Complete field missions, collect supplies, and build your arsenal.';
  const loadout=document.createElement('div');loadout.id='starting-loadout';loadout.innerHTML='<div class="eyebrow">STARTING WEAPON</div><label><input type="radio" name="fps-start" value="blaster" checked> SCRAP BLASTER <small>Fast, precise energy shots</small></label><label><input type="radio" name="fps-start" value="shotgun"> SCATTERGUN <small>Wide close-range spread</small></label><label><input type="radio" name="fps-start" value="arc"> ARC COIL <small>Lightning chains through crowds</small></label>';
  start.insertBefore(loadout,document.getElementById('startBtn'));
  document.getElementById('startBtn').textContent='ENTER THE LABYRINTH';
  document.getElementById('startBtn').addEventListener('click',()=>{
    current=document.querySelector('input[name=fps-start]:checked').value;unlocked.add(current);buildGun();ui.classList.remove('hidden');updateHUD();
  });
  host.canvas.addEventListener('pointerdown',e=>{if(e.button===0&&host.active())held=true;});
  window.addEventListener('pointerup',()=>held=false);window.addEventListener('blur',()=>held=false);
  document.addEventListener('pointerlockchange',()=>held=false);
  window.addEventListener('keydown',e=>{
    if(!host.active())return;
    const key={Digit1:'blaster',Digit2:'shotgun',Digit3:'arc'}[e.code];
    if(key&&unlocked.has(key)){current=key;buildGun();updateHUD();}
  });
  const touchFire=document.createElement('button');touchFire.id='touch-fire';touchFire.textContent='FIRE';touchFire.setAttribute('aria-label','Fire weapon');
  touchFire.onpointerdown=e=>{e.preventDefault();e.stopPropagation();if(host.active())held=true;};touchFire.onpointerup=()=>held=false;touchFire.onpointercancel=()=>held=false;document.getElementById('app').append(touchFire);

  function notify(text) {document.getElementById('run-toast').textContent=text;toastTime=4;}
  function buildGun() {
    if(gun)camera.remove(gun);
    gun=new T.Group();camera.add(gun);
    gun.position.set(.32,-.3,-.6);
    const color=weapons[current].color;
    part(gun,'box',0x263b49,0,0,0,.18,.2,.44);
    part(gun,'box',0x131e26,0,-.15,.13,.1,.22,.14);
    part(gun,'box',0x72959b,0,.12,0,.12,.06,.34);
    gunBarrel=part(gun,'box',0x1c2730,0,.015,-.29,current==='shotgun'?.24:.095,.09,.22);
    part(gun,'box',color,.095,.03,.04,.01,.045,.18,true);
    if(current==='arc')for(let i=0;i<3;i++){const ring=part(gun,'ring',color,0,.02,-.14-i*.065,.11,.11,.11,true);}
    if(current==='shotgun')part(gun,'box',0xa97948,0,-.04,-.12,.21,.12,.2);
    flash=part(gun,'sphere',color,0,.02,-.44,.12,.12,.08,true);flash.visible=false;
  }
  function makeEnemy(type,pos) {
    if(enemies.filter(e=>e.alive).length>=55)return;
    const def=types[type],g=new T.Group();layer.add(g);g.position.set(pos.x,0,pos.z);
    const level=1+Math.floor(run.time/120)*.22;
    const e={type,def,mesh:g,hp:def.hp*level,maxHP:def.hp*level,alive:true,attack:0,special:2+Math.random()*2,windup:0,charge:0,age:0,r:def.r};
    if(type==='brood') {
      part(g,'pod',def.color,0,.75,0,.65,.7,.65);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;part(g,'sphere',0xb3e8a4,Math.cos(a)*.45,.9,Math.sin(a)*.45,.18,.23,.18,true);const leg=part(g,'box',0x654c84,Math.cos(a)*.6,.3,Math.sin(a)*.6,.08,.55,.08);leg.rotation.z=Math.sin(a)*.7;}
    } else {
      const scale=type==='boss'?1.6:type==='tank'?1.3:type==='runner'?.8:1;
      part(g,'box',0x202c37,-.17,.3,0,.19,.6,.23);part(g,'box',0x202c37,.17,.3,0,.19,.6,.23);
      part(g,'box',def.color,0,.94,0,type==='tank'?.85:.55,.66,.34);
      part(g,'box',0x293b48,0,.97,-.19,.4,.4,.1);
      part(g,'box',def.color,0,1.48,0,.39,.39,.36);
      part(g,'box',type==='spitter'?0xb6ff60:0xffbc81,0,1.49,-.19,.29,.075,.035,true);
      part(g,'box',def.color,-.38,.9,0,.19,.56,.24);part(g,'box',def.color,.38,.9,0,.19,.56,.24);
      if(type==='charger'){part(g,'pod',0xd99c67,-.36,1.5,-.1,.14,.4,.16);part(g,'pod',0xd99c67,.36,1.5,-.1,.14,.4,.16);}
      if(type==='spitter')part(g,'sphere',0xa5e854,0,1.05,-.3,.2,.22,.3,true);
      if(type==='boss'){part(g,'sphere',0xff573d,0,1.05,-.3,.2,.2,.16,true);part(g,'box',0x8e604c,-.55,1.25,0,.4,.3,.5);part(g,'box',0x8e604c,.55,1.25,0,.4,.3,.5);}
      g.scale.setScalar(scale);
    }
    g.traverse(m=>{if(m.isMesh)m.userData.enemy=e;});
    enemies.push(e);return e;
  }
  function spawn(type) {
    const distances=nav.field(host.player.x,host.player.z);
    let cells=distances.map((d,i)=>({d,i})).filter(a=>a.d>=3&&a.d<=7);
    if(!cells.length)cells=distances.map((d,i)=>({d,i})).filter(a=>a.d>=2&&Number.isFinite(a.d));
    const cell=cells[Math.floor(Math.random()*cells.length)];if(cell)makeEnemy(type,nav.center(cell.i));
  }
  function dropAt(x,z,kind='xp',value=8) {
    if(drops.length>=100)return;
    const g=new T.Group();g.position.set(x,.4,z);layer.add(g);
    const color=kind==='xp'?0x6de3e7:pickupInfo[kind][2];
    part(g,kind==='xp'?'pod':'box',color,0,0,0,kind==='xp'?.12:.25,kind==='xp'?.18:.25,kind==='xp'?.12:.25,true);
    if(kind!=='xp'){const ring=part(g,'ring',color,0,-.27,0,.32,.32,.32,true);ring.rotation.x=Math.PI/2;}
    drops.push({mesh:g,kind,value,life:kind==='xp'?120:30});
  }
  function hurtEnemy(e,damage) {
    if(!e.alive)return;
    e.hp-=damage;
    if(e.hp>0){e.mesh.scale.multiplyScalar(1.012);return;}
    e.alive=false;layer.remove(e.mesh);run.kills++;run.score+=e.type==='boss'?1000:20;
    dropAt(e.mesh.position.x,e.mesh.position.z,'xp',e.def.xp);
    if(run.kills%5===0||Math.random()<.13){const keys=Object.keys(pickupInfo);dropAt(e.mesh.position.x+.25,e.mesh.position.z,keys[Math.floor(Math.random()*keys.length)]);}
    if(e.type==='brood')for(let i=0;i<2;i++)makeEnemy('runner',{x:e.mesh.position.x+(i?.25:-.25),z:e.mesh.position.z});
    if(e.type==='boss')finish(true);
  }
  function damagePlayer(n) {
    if(hurtTimer>0||ended)return;
    if(run.damage(n)){hurtTimer=.45;document.getElementById('damage-flash').style.opacity='.65';if(run.health<=0)finish(false);}
  }
  function tracer(from,to,color,duration=.09) {
    const geo=new T.BufferGeometry().setFromPoints([from,to]);const mat=new T.LineBasicMaterial({color,transparent:true,opacity:.9});const line=new T.Line(geo,mat);layer.add(line);effects.push({mesh:line,life:duration,total:duration});
  }
  function targetRay(dir,range) {
    ray.set(camera.position,dir);ray.far=range;
    const wall=ray.intersectObjects(host.walls(),false)[0];
    const hits=ray.intersectObjects(enemies.filter(e=>e.alive).map(e=>e.mesh),true);
    const hit=hits.find(h=>h.object.userData.enemy?.alive);
    if(hit&&(!wall||hit.distance<wall.distance))return {enemy:hit.object.userData.enemy,point:hit.point};
    return {enemy:null,point:wall?wall.point:camera.position.clone().addScaledVector(dir,range)};
  }
  function shoot() {
    if(fireTimer>0)return;
    const def=weapons[current];fireTimer=def.cooldown/stats.fireRate/(run.buffs.overdrive>0?1.7:1);recoil=.075;
    camera.getWorldDirection(direction);camera.updateMatrixWorld(true);
    const origin=new T.Vector3(0,.02,-.46);gun.localToWorld(origin);
    const pellets=current==='shotgun'?stats.pellets:1;let first=null;
    for(let i=0;i<pellets;i++) {
      const dir=direction.clone();
      if(current==='shotgun'&&i>0){const local=new T.Vector3((Math.random()-.5)*.12,(Math.random()-.5)*.10,0).applyQuaternion(camera.quaternion);dir.add(local).normalize();}
      const hit=targetRay(dir,def.range);tracer(origin,hit.point,def.color,current==='arc'?.16:.075);
      if(hit.enemy){hurtEnemy(hit.enemy,def.damage*stats.damage);if(!first)first=hit.enemy;}
    }
    if(current==='arc'&&first){
      const hitSet=new Set([first]);let previous=first;
      for(let i=1;i<stats.chains;i++) {
        const p=previous.mesh.position;
        const target=enemies.filter(e=>e.alive&&!hitSet.has(e)&&e.mesh.position.distanceTo(p)<7&&nav.clear(p.x,p.z,e.mesh.position.x,e.mesh.position.z,.05)).sort((a,b)=>a.mesh.position.distanceTo(p)-b.mesh.position.distanceTo(p))[0];
        if(!target)break;
        tracer(p.clone().add(new T.Vector3(0,1,0)),target.mesh.position.clone().add(new T.Vector3(0,1,0)),def.color,.2);
        hitSet.add(target);hurtEnemy(target,def.damage*stats.damage);previous=target;
      }
    }
  }
  function enemyShot(e) {
    const p=e.mesh.position.clone().add(new T.Vector3(0,1.2,0));const velocity=camera.position.clone().sub(p).normalize().multiplyScalar(7);
    const mesh=new T.Mesh(geometry.sphere,material(0xbce96f,true));mesh.scale.setScalar(.12);mesh.position.copy(p);layer.add(mesh);bolts.push({mesh,velocity,life:4});
  }
  const upgrades=[
    {name:'OVERCHARGED',detail:'All weapon damage +25%',apply:()=>stats.damage*=1.25},
    {name:'RAPID CYCLING',detail:'Fire rate +20%',apply:()=>stats.fireRate*=1.2},
    {name:'REINFORCED',detail:'+25 maximum health and heal 35',apply:()=>{run.maxHealth+=25;run.health=Math.min(run.maxHealth,run.health+35);}},
    {name:'FIELD MEDIC',detail:'Restore 50% of maximum health',available:()=>run.health<run.maxHealth,apply:()=>run.health=Math.min(run.maxHealth,run.health+run.maxHealth*.5)},
    {name:'LIGHT FOOTED',detail:'Movement speed +12% (maximum +60%)',available:()=>stats.speed<1.6,apply:()=>stats.speed=Math.min(1.6,stats.speed*1.12)},
    {name:'SCATTERGUN',detail:'Unlock the shotgun. Press 2 to equip.',available:()=>!unlocked.has('shotgun'),apply:()=>{unlocked.add('shotgun');current='shotgun';buildGun();}},
    {name:'ARC COIL',detail:'Unlock chain lightning. Press 3 to equip.',available:()=>!unlocked.has('arc'),apply:()=>{unlocked.add('arc');current='arc';buildGun();}},
    {name:'BUCKSHOT',detail:'+2 shotgun pellets (maximum 11)',available:()=>unlocked.has('shotgun')&&stats.pellets<11,apply:()=>stats.pellets+=2},
    {name:'CHAIN REACTION',detail:'Lightning hits one more enemy (maximum 7)',available:()=>unlocked.has('arc')&&stats.chains<7,apply:()=>stats.chains++},
    {name:'SALVAGE FIELD',detail:'Experience pickup radius +40%',apply:()=>stats.pickup=Math.min(4,stats.pickup*1.4)}
  ];
  function levelUp() {
    run.pendingLevels--;held=false;host.setPaused(true);upgrade.classList.remove('hidden');
    const pool=upgrades.filter(u=>!u.available||u.available()).sort(()=>Math.random()-.5);const picks=pool.slice(0,3);
    const weapon=pool.find(u=>['SCATTERGUN','ARC COIL'].includes(u.name));if(weapon&&!picks.includes(weapon))picks[2]=weapon;
    const target=document.getElementById('fps-upgrades');target.replaceChildren();
    picks.forEach((u,i)=>{const button=document.createElement('button');button.innerHTML='<span>0'+(i+1)+'</span><strong>'+u.name+'</strong><small>'+u.detail+'</small>';button.onclick=()=>{u.apply();upgrade.classList.add('hidden');host.setPaused(false);updateHUD();};target.append(button);});
  }
  function finish(won) {
    ended=true;held=false;host.finish();ui.classList.add('hidden');result.classList.remove('hidden');
    document.getElementById('result-title').textContent=won?'THE LABYRINTH IS CLEAR':'SIGNAL LOST';
    document.getElementById('result-stats').textContent=`${Math.floor(run.time/60)}:${String(Math.floor(run.time%60)).padStart(2,'0')} survived · ${run.kills} kills · Level ${run.level} · ${missionCount}/3 missions · ${run.score} score`;
  }
  function updateHUD() {
    document.getElementById('health-value').textContent=Math.ceil(run.health)+' / '+run.maxHealth;
    document.getElementById('health-fill').style.width=(run.health/run.maxHealth*100)+'%';
    document.getElementById('xp-fill').style.width=(run.xp/run.nextLevel*100)+'%';
    document.getElementById('level-value').textContent='LEVEL '+run.level+' · '+run.kills+' KILLS';
    const remaining=Math.max(0,600-Math.floor(run.time));document.getElementById('survival-timer').textContent=bossSpawned?'OVERSEER':Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
    const names=['CLEAR THE BLOCK','SALVAGE RUN','HOLD THE LINE'],counts=[run.kills,run.salvage,Math.floor(run.time)],goals=[15,100,120],rewards=['15 kills → heal & +15 max health','100 XP → weapon damage +20%','120 seconds → shield & 250 score'];
    document.getElementById('mission-list').innerHTML=names.map((n,i)=>'<div class="order '+(run.missions[i]?'done':'')+'"><b>'+ (run.missions[i]?'✓ ':'')+n+'</b><span>'+Math.min(counts[i],goals[i])+'/'+goals[i]+'</span><small>'+rewards[i]+'</small><progress value="'+Math.min(counts[i],goals[i])+'" max="'+goals[i]+'"></progress></div>').join('');
    document.getElementById('weapon-strip').innerHTML=Object.entries(weapons).map(([id,w],i)=>'<button data-weapon="'+id+'" class="'+(current===id?'equipped':'')+'" '+(!unlocked.has(id)?'disabled':'')+'><small>0'+(i+1)+'</small>'+w.name+(!unlocked.has(id)?'<em>LOCKED</em>':'')+'</button>').join('');
    document.querySelectorAll('[data-weapon]').forEach(b=>b.onclick=()=>{if(!host.active())return;current=b.dataset.weapon;buildGun();updateHUD();});
    document.getElementById('active-effects').textContent=Object.entries(run.buffs).filter(([,v])=>v>0).map(([k,v])=>pickupInfo[k][0]+' '+Math.ceil(v)+'s').join(' · ');
    const boss=enemies.find(e=>e.type==='boss'&&e.alive);document.getElementById('boss-meter').classList.toggle('hidden',!boss);
    if(boss)document.querySelector('#boss-meter i').style.width=Math.max(0,boss.hp/boss.maxHP*100)+'%';
  }
  function reset() {
    for(const fx of effects){fx.mesh.geometry.dispose();fx.mesh.material.dispose();}
    layer.clear();enemies=[];drops=[];effects=[];bolts=[];run=new SurvivalProgress();nav=new MazeNavigation(...host.grid());
    unlocked=new Set(['blaster']);current=document.querySelector('input[name=fps-start]:checked')?.value||'blaster';unlocked.add(current);
    stats={damage:1,fireRate:1,speed:1,pellets:5,chains:3,pickup:.9};
    held=false;fireTimer=0;spawnTimer=2;hurtTimer=0;recoil=0;bossSpawned=false;ended=false;missionCount=0;toastTime=0;
    upgrade.classList.add('hidden');result.classList.add('hidden');buildGun();updateHUD();document.getElementById('run-toast').textContent='';
    if(host.active())ui.classList.remove('hidden');
    const next=nav.neighbors(0)[0];if(next!==undefined){const c=nav.center(next);dropAt(c.x,c.z,'shield');}
  }
  function update(dt) {
    if(ended)return;run.tick(dt);fireTimer-=dt;hurtTimer=Math.max(0,hurtTimer-dt);toastTime-=dt;
    if(toastTime<=0)document.getElementById('run-toast').textContent='';
    document.getElementById('damage-flash').style.opacity=String(hurtTimer);
    recoil=Math.max(0,recoil-dt*.6);gun.position.z=-.6+recoil;flash.visible=recoil>.05;
    if(held||host.keys().Space)shoot();
    spawnTimer-=dt;
    if(spawnTimer<=0&&!bossSpawned){
      spawnTimer=Math.max(.9,3-run.time/220);
      const pool=run.time<25?['shambler','runner']:run.time<70?['shambler','runner','charger']:['shambler','runner','charger','brood','spitter','tank'];
      spawn(pool[Math.floor(Math.random()*pool.length)]);
    }
    if(run.time>=600&&!bossSpawned){bossSpawned=true;spawn('boss');notify('OVERSEER INBOUND · Defeat it to escape');}
    for(const e of enemies.slice()) {
      if(!e.alive)continue;e.attack-=dt;e.special-=dt;e.age+=dt;
      const p=e.mesh.position,player=host.player,dist=Math.hypot(player.x-p.x,player.z-p.z);
      let target=nav.waypoint(p.x,p.z,player.x,player.z,e.r+.02),speed=e.def.speed*(1+Math.min(.4,run.time/1500));
      const visible=nav.clear(p.x,p.z,player.x,player.z,e.r+.02);
      if((e.type==='spitter'||e.type==='boss')&&dist<13&&visible&&e.special<=0){enemyShot(e);e.special=e.type==='boss'?.85:2.3;}
      if(e.type==='spitter'&&dist<8&&visible)speed=0;
      if(e.type==='charger') {
        if(e.windup>0){e.windup-=dt;speed=0;e.mesh.rotation.z=Math.sin(e.age*40)*.035;if(e.windup<=0)e.charge=.6;}
        else if(e.charge>0){e.charge-=dt;speed=4.8;target={x:p.x+e.chargeX,z:p.z+e.chargeZ};e.mesh.rotation.z=0;}
        else if(e.special<=0&&dist<10&&visible){e.windup=.7;e.special=4;e.chargeX=(player.x-p.x)/Math.max(.1,dist);e.chargeZ=(player.z-p.z)/Math.max(.1,dist);}
      }
      const dx=target.x-p.x,dz=target.z-p.z,len=Math.hypot(dx,dz);
      if(len>.08){host.move(p,dx/len*speed*dt,dz/len*speed*dt,e.r);e.mesh.rotation.y=Math.atan2(player.x-p.x,player.z-p.z)+Math.PI;}
      e.mesh.position.y=Math.sin(e.age*(e.type==='runner'?12:6))*.025;
      if(dist<e.r+.65&&nav.clear(p.x,p.z,player.x,player.z,.05)&&e.attack<=0){damagePlayer(e.def.damage);e.attack=.9;}
    }
    enemies=enemies.filter(e=>e.alive);
    bolts=bolts.filter(b=>{const p=b.mesh.position,old=p.clone();p.addScaledVector(b.velocity,dt);b.life-=dt;const hit=p.distanceTo(camera.position)<.55;if(hit)damagePlayer(9);if(hit||b.life<=0||!nav.clear(old.x,old.z,p.x,p.z,.1)){layer.remove(b.mesh);return false;}return true;});
    drops=drops.filter(d=>{
      d.life-=dt;d.mesh.rotation.y+=dt;d.mesh.position.y=.45+Math.sin(run.time*3)*.08;
      const p=d.mesh.position,dist=Math.hypot(p.x-host.player.x,p.z-host.player.z);
      const radius=d.kind==='xp'?(run.buffs.magnet>0?8:stats.pickup):.9;
      if(dist<radius&&nav.clear(p.x,p.z,host.player.x,host.player.z,.05)){
        if(d.kind==='xp')run.gainXP(d.value);else{run.pickup(d.kind);notify(pickupInfo[d.kind][0]+' ACTIVATED');}
        layer.remove(d.mesh);return false;
      }
      if(d.life<=0){layer.remove(d.mesh);return false;}return true;
    });
    effects=effects.filter(f=>{f.life-=dt;f.mesh.material.opacity=Math.max(0,f.life/f.total);if(f.life<=0){layer.remove(f.mesh);f.mesh.geometry.dispose();f.mesh.material.dispose();return false;}return true;});
    for(const mission of run.completedMissions()) {
      missionCount++;
      if(mission===0){run.maxHealth+=15;run.health=Math.min(run.maxHealth,run.health+35);}
      if(mission===1)stats.damage*=1.2;
      if(mission===2){run.pickup('shield');run.score+=250;}
      notify('FIELD ORDER COMPLETE · Reward applied');
    }
    if(run.pendingLevels>0&&!ended)levelUp();
    hudTimer-=dt;if(hudTimer<=0){hudTimer=.2;updateHUD();}
  }
  return {reset,update,get moveSpeed(){return (stats?.speed||1)*(run?.buffs.overdrive>0?1.2:1);},gem(){run.gainXP(12);notify('SALVAGE +12 XP');},release(){held=false;}};
}
