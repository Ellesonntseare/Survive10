/* Maze navigation and run rules, shared by the 3D game and regression tests. */
class MazeNavigation {
  constructor(horizontal,vertical,cell=4,thickness=0.16) {
    this.h=horizontal;this.v=vertical;this.cell=cell;this.rows=vertical.length;this.cols=horizontal[0].length;
    this.rects=[];this.cachedTarget=-1;
    for(let r=0;r<=this.rows;r++)for(let c=0;c<this.cols;c++)if(horizontal[r][c])
      this.rects.push({x:c*cell-thickness,z:r*cell-thickness,w:cell+2*thickness,d:2*thickness});
    for(let r=0;r<this.rows;r++)for(let c=0;c<=this.cols;c++)if(vertical[r][c])
      this.rects.push({x:c*cell-thickness,z:r*cell-thickness,w:2*thickness,d:cell+2*thickness});
  }
  id(x,z) {return Math.max(0,Math.min(this.rows-1,Math.floor(z/this.cell)))*this.cols+Math.max(0,Math.min(this.cols-1,Math.floor(x/this.cell)));}
  center(id) {return {x:(id%this.cols+0.5)*this.cell,z:(Math.floor(id/this.cols)+0.5)*this.cell};}
  neighbors(id) {
    const r=Math.floor(id/this.cols),c=id%this.cols,out=[];
    if(r>0&&!this.h[r][c])out.push(id-this.cols);
    if(r<this.rows-1&&!this.h[r+1][c])out.push(id+this.cols);
    if(c>0&&!this.v[r][c])out.push(id-1);
    if(c<this.cols-1&&!this.v[r][c+1])out.push(id+1);
    return out;
  }
  field(x,z) {
    const target=this.id(x,z);if(target===this.cachedTarget)return this.distances;
    this.cachedTarget=target;this.distances=Array(this.rows*this.cols).fill(Infinity);this.distances[target]=0;
    const queue=[target];
    for(let i=0;i<queue.length;i++)for(const n of this.neighbors(queue[i]))if(!Number.isFinite(this.distances[n])) {
      this.distances[n]=this.distances[queue[i]]+1;queue.push(n);
    }
    return this.distances;
  }
  clear(x,z,tx,tz,padding=0) {
    return !this.rects.some(r=>{
      let lo=0,hi=1;
      for(const [p,d,min,max] of [[x,tx-x,r.x-padding,r.x+r.w+padding],[z,tz-z,r.z-padding,r.z+r.d+padding]]) {
        if(Math.abs(d)<1e-8){if(p<min||p>max)return false;}
        else {const a=(min-p)/d,b=(max-p)/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi)return false;}
      }
      return true;
    });
  }
  waypoint(x,z,tx,tz,radius=0.3) {
    if(this.clear(x,z,tx,tz,radius))return {x:tx,z:tz};
    const distances=this.field(tx,tz),id=this.id(x,z);
    const next=this.neighbors(id).sort((a,b)=>distances[a]-distances[b])[0];
    if(next===undefined)return this.center(id);
    const point=this.center(next);
    return this.clear(x,z,point.x,point.z,radius)?point:this.center(id);
  }
}

class SurvivalProgress {
  constructor() {this.health=100;this.maxHealth=100;this.kills=0;this.salvage=0;this.time=0;this.score=0;this.xp=0;this.level=1;this.pendingLevels=0;this.buffs={shield:0,overdrive:0,magnet:0};this.missions=[false,false,false];}
  get nextLevel() {return 24+this.level*16;}
  gainXP(n) {this.xp+=n;this.salvage+=n;while(this.xp>=this.nextLevel){this.xp-=this.nextLevel;this.level++;this.pendingLevels++;}}
  tick(dt) {this.time+=dt;for(const k in this.buffs)this.buffs[k]=Math.max(0,this.buffs[k]-dt);}
  damage(n) {if(this.buffs.shield>0)return false;this.health=Math.max(0,this.health-n);return true;}
  pickup(kind) {
    if(kind==='medkit')this.health=Math.min(this.maxHealth,this.health+Math.round(this.maxHealth*0.35));
    else if(kind in this.buffs)this.buffs[kind]={overdrive:8,shield:6,magnet:10}[kind];
  }
  completedMissions() {
    const values=[this.kills,this.salvage,this.time],goals=[15,100,120],completed=[];
    values.forEach((v,i)=>{if(!this.missions[i]&&v>=goals[i]){this.missions[i]=true;completed.push(i);}});
    return completed;
  }
}
