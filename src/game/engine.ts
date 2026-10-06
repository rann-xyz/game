// ── Main Game Engine ──
import { generateWorld, worldToTile } from './world'
import { findPath } from './pathfinding'
import { UNIT_STATS, BUILDING_STATS, BUILDING_PRODUCES, counterMultiplier, terrainSpeedMult, terrainVisionMult, terrainDefenseBonus } from './balance'
import type { Tile, Unit, Building, Projectile, Particle, Resources, Tech, Objective, Mission, Vec2, UnitType, BuildingType, FormationType, TacticalOrder, Team, Difficulty, Camera } from './types'
import { MAP_W, MAP_H, TILE, WORLD_W, WORLD_H } from './types'
import { TECHS } from './balance'

let uid=0
const nid=(p:string)=>`${p}_${++uid}_${Math.random().toString(36).slice(2,6)}`

export class GameEngine {
  tiles: Tile[][] = []
  units: Unit[] = []
  buildings: Building[] = []
  projectiles: Projectile[] = []
  particles: Particle[] = []
  resources: Resources = { gold:600, wood:400, stone:200, food:0 }
  pop=0; popCap=20
  techs: Tech[]=[]
  objectives: Objective[]=[]
  mission: Mission | null=null
  difficulty: Difficulty='normal'
  time=0
  camera: Camera = { x:WORLD_W/2-480, y:WORLD_H/2-320, zoom:1, targetX:WORLD_W/2-480, targetY:WORLD_H/2-320, shake:0 }
  selectedIds = new Set<string>()
  selectedBuildingId: string | null=null
  controlGroups = new Map<number,string[]>()
  formation: FormationType='line'
  order: TacticalOrder='none'
  minimapClick: Vec2|null=null
  fog: boolean[][] = [] // visible
  explored: boolean[][]=[]
  supplyTimer=0
  aiTimer=0
  stats={ kills:0, losses:0, buildingsDestroyed:0, buildingsLost:0, resourcesGathered:{gold:0,wood:0,stone:0,food:0} as Resources, startTime:Date.now()}
  paused=false
  victory=false; defeat=false
  notifications: {id:string;text:string;t:number}[]=[]
  seed=42
  // callbacks
  onUpdate: (()=>void)|null=null

  constructor(seed=42){
    this.seed=seed
    this.reset(seed)
  }

  reset(seed:number){
    this.seed=seed
    this.tiles=generateWorld(seed)
    this.units=[]; this.buildings=[]; this.projectiles=[]; this.particles=[]
    this.resources={gold:600,wood:400,stone:200,food:0}
    this.pop=0; this.popCap=20; this.time=0
    this.techs=TECHS.map(t=>({id:t.id,name:t.name,desc:t.desc,branch:t.branch,cost:t.cost as unknown as Resources,done:false,researching:false,progress:0,prereq:t.prereq}))
    this.objectives=[]; this.mission=null; this.difficulty='normal'
    this.selectedIds.clear(); this.selectedBuildingId=null
    this.fog=Array.from({length:MAP_H},()=>Array(MAP_W).fill(false))
    this.explored=Array.from({length:MAP_H},()=>Array(MAP_W).fill(false))
    this.victory=false; this.defeat=false; this.paused=false
    this.notifications=[]
    this.camera={x:WORLD_W/2-640,y:WORLD_H/2-400,zoom:1,targetX:WORLD_W/2-640,targetY:WORLD_H/2-400,shake:0}
    this.stats={kills:0,losses:0,buildingsDestroyed:0,buildingsLost:0,resourcesGathered:{gold:0,wood:0,stone:0,food:0},startTime:Date.now()}
    this.aiTimer=0; this.supplyTimer=0
    uid=0
  }

  startMission(m:Mission){
    this.mission=m; this.difficulty=m.difficulty; this.reset(m.mapSeed)
    this.mission=m
    this.objectives=m.objectives.map(o=>({...o}))
    // player start near 10,10
    this.spawnBuilding('commandCenter','player',10,10)
    this.spawnBuilding('barracks','player',10,14)
    this.spawnBuilding('farm','player',13,10)
    // initial workers + soldiers
    for(let i=0;i<4;i++) this.spawnUnit('worker','player', 11*TILE+ (i*20), 12*TILE)
    for(let i=0;i<3;i++) this.spawnUnit('swordsman','player', 12*TILE+ i*22, 15*TILE)
    this.spawnUnit('archer','player',12*TILE,16*TILE)
    this.spawnUnit('scout','player',13*TILE,16*TILE)
    // enemy base near 65,45
    this.spawnBuilding('commandCenter','enemy',65,45)
    this.spawnBuilding('barracks','enemy',65,49)
    this.spawnBuilding('archeryRange','enemy',62,45)
    this.spawnBuilding('watchtower','enemy',63,48)
    for(let i=0;i<4;i++) this.spawnUnit('worker','enemy',66*TILE,46*TILE + i*12)
    for(let i=0;i<5;i++) this.spawnUnit('swordsman','enemy',64*TILE+ i*18, 48*TILE)
    for(let i=0;i<2;i++) this.spawnUnit('archer','enemy',63*TILE+i*20,47*TILE)
    this.spawnUnit('lightCav','enemy',65*TILE,50*TILE)
    // neutral resources already on map via world gen; add extra
    this.notify(`Mission ${m.id}: ${m.title} — ${m.brief}`)
  }

  startSkirmish(seed:number,diff:Difficulty){
    const m:Mission={id:0,title:'Skirmish',brief:'Destroy the enemy Command Center',objectives:[{id:'o1',title:'Destroy Enemy Command Center',desc:'Eliminate all enemy Command Centers',type:'destroy',done:false,failed:false}],enemyCount:1,difficulty:diff,mapSeed:seed}
    this.startMission(m)
  }

  spawnUnit(type:UnitType, team:Team, x:number,y:number):Unit{
    const s=UNIT_STATS[type]
    const u:Unit={
      id:nid('u'), type, team, x,y, tx:x, ty:y,
      hp:s.maxHp, maxHp:s.maxHp, armor:s.armor, damage:s.damage,
      speed:s.speed, range:s.range, attackSpeed:s.attackSpeed, vision:s.vision,
      morale:s.morale, supply:100, facing:0, state:'idle',
      carryAmount:0, carryCap: type==='worker'?20:0,
      gatherCooldown:0, attackCooldown:0, path:[], order:'none', selected:false
    }
    // tech bonuses
    if(this.hasTech('inf1') && ['swordsman','spearman','heavy'].includes(type)) u.damage+=4
    if(this.hasTech('inf2') && ['swordsman','spearman','heavy'].includes(type)) u.armor+=3
    if(this.hasTech('rng1') && ['archer','crossbow','ballista'].includes(type)) u.range+=30
    if(this.hasTech('rng2') && ['archer','crossbow'].includes(type)) u.damage+=8
    if(this.hasTech('cav1') && ['lightCav','heavyCav'].includes(type)) u.speed*=1.15
    if(this.hasTech('cav2') && ['lightCav','heavyCav'].includes(type)) u.damage+=10
    if(this.hasTech('siege1') && ['catapult','ballista'].includes(type)) u.range+=40
    this.units.push(u)
    if(team==='player') this.pop++
    return u
  }

  spawnBuilding(type:BuildingType, team:Team, tx:number,ty:number):Building|null{
    const st=BUILDING_STATS[type]; if(!st) return null
    if(tx<0||ty<0||tx+st.w>MAP_W||ty+st.h>MAP_H) return null
    const b:Building={id:nid('b'),type,team,x:tx,y:ty,w:st.w,h:st.h,hp:st.hp,maxHp:st.hp,armor:st.armor,progress:1,queue:[],queueProgress:0,selected:false}
    if(this.hasTech('def1') && (type==='wall'||type==='gate')) b.hp+=200
    this.buildings.push(b)
    if(team==='player' && type==='commandCenter') this.popCap+=10
    if(team==='player' && type==='farm') this.popCap+=5
    return b
  }

  tryBuild(type:BuildingType, tx:number,ty:number){
    const st=BUILDING_STATS[type]; if(!st) return
    const cost=st.cost as Partial<Resources>
    if(!this.canAfford(cost)) { this.notify('Not enough resources'); return }
    // check collision
    for(const b of this.buildings){ if(!(tx+st.w<=b.x||tx>=b.x+b.w||ty+st.h<=b.y||ty>=b.y+b.h)) { this.notify('Blocked'); return }}
    // terrain block
    for(let dx=0;dx<st.w;dx++) for(let dy=0;dy<st.h;dy++){ const t=this.tiles[ty+dy]?.[tx+dx]; if(!t||t.terrain==='mountain'||t.terrain==='water'){ this.notify('Invalid terrain'); return }}
    this.pay(cost)
    const b=this.spawnBuilding(type,'player',tx,ty)!
    b.progress=0.99 // instant for UX — show building but done quickly
    setTimeout(()=>{ b.progress=1 }, 100)
    this.notify(`Building ${type}`)
  }

  tryTrain(buildingId:string, type:UnitType){
    const b=this.buildings.find(x=>x.id===buildingId); if(!b||b.team!=='player') return
    const prod=BUILDING_PRODUCES[b.type]; if(!prod||!prod.includes(type)){ this.notify('Cannot train here'); return }
    const s=UNIT_STATS[type]
    if(this.pop + s.pop > this.popCap){ this.notify('Population cap reached — build Farms'); return }
    if(!this.canAfford(s.cost as Partial<Resources>)){ this.notify('Not enough resources'); return }
    this.pay(s.cost as Partial<Resources>)
    b.queue.push(type)
  }

  canAfford(cost:Partial<Resources>){
    for(const k of ['gold','wood','stone','food'] as const) if((cost[k]||0) > this.resources[k]) return false
    return true
  }
  pay(cost:Partial<Resources>){ for(const k of ['gold','wood','stone','food'] as const) this.resources[k]-=(cost[k]||0) }

  hasTech(id:string){ return this.techs.find(t=>t.id===id)?.done||false }

  research(id:string){
    const tech=this.techs.find(t=>t.id===id); if(!tech||tech.done||tech.researching) return
    if(tech.prereq && !this.hasTech(tech.prereq)){ this.notify('Prerequisite required'); return }
    if(!this.canAfford(tech.cost as Partial<Resources>)){ this.notify('Not enough resources'); return }
    this.pay(tech.cost as Partial<Resources>)
    tech.researching=true; tech.progress=0
    this.notify(`Researching ${tech.name}`)
  }

  // ── Selection / Commands ──
  selectRect(x1:number,y1:number,x2:number,y2:number, additive:boolean){
    if(!additive){ this.selectedIds.clear(); this.buildings.forEach(b=>b.selected=false)}
    const minX=Math.min(x1,x2), maxX=Math.max(x1,x2), minY=Math.min(y1,y2), maxY=Math.max(y1,y2)
    for(const u of this.units){ if(u.team!=='player'||u.state==='dead') continue; if(u.x>=minX&&u.x<=maxX&&u.y>=minY&&u.y<=maxY){ this.selectedIds.add(u.id); u.selected=true }}
    for(const b of this.buildings){ if(b.team!=='player') continue; const bx=b.x*TILE, by=b.y*TILE, bw=b.w*TILE,bh=b.h*TILE; if(bx>=minX&&bx<=maxX&&by>=minY&&by<=maxY) b.selected=true }
    // if single building selected, track
    const selB=this.buildings.find(b=>b.selected)
    this.selectedBuildingId=selB?selB.id:null
  }
  selectAt(x:number,y:number, additive:boolean){
    // prioritize units
    let best:Unit|null=null, bestD=28
    for(const u of this.units){ if(u.team!=='player'||u.state==='dead') continue; const d=Math.hypot(u.x-x,u.y-y); if(d<bestD){bestD=d; best=u}}
    if(best){
      if(!additive){ this.selectedIds.clear(); this.units.forEach(u=>u.selected=false); this.buildings.forEach(b=>b.selected=false)}
      this.selectedIds.add(best.id); best.selected=true; this.selectedBuildingId=null; return
    }
    let bb:Building|null=null
    for(const b of this.buildings){ if(b.team!=='player') continue; const bx=b.x*TILE,by=b.y*TILE; if(x>=bx&&x<=bx+b.w*TILE&&y>=by&&y<=by+b.h*TILE) bb=b }
    if(bb){ if(!additive){ this.selectedIds.clear(); this.units.forEach(u=>u.selected=false); this.buildings.forEach(b=>b.selected=false)} bb.selected=true; this.selectedBuildingId=bb.id; return }
    if(!additive){ this.selectedIds.clear(); this.units.forEach(u=>u.selected=false); this.buildings.forEach(b=>b.selected=false); this.selectedBuildingId=null}
  }

  doubleClickSelect(x:number,y:number){
    const clicked=this.units.find(u=>u.team==='player'&&Math.hypot(u.x-x,u.y-y)<26)
    if(!clicked) return
    this.selectedIds.clear(); this.units.forEach(u=>u.selected=false)
    for(const u of this.units){ if(u.type===clicked.type&&u.team==='player'&&Math.hypot(u.x-x,u.y-y)<260){ this.selectedIds.add(u.id); u.selected=true }}
  }

  issueMove(x:number,y:number, attackMove:boolean){
    const selected=this.units.filter(u=>this.selectedIds.has(u.id) && u.state!=='dead')
    if(!selected.length) return
    // formation positions
    const positions=this.formationPositions(selected.length, x,y, this.formation)
    selected.forEach((u,i)=>{
      const p=positions[i]||{x,y}
      const tile=worldToTile(p.x,p.y,TILE)
      const from=worldToTile(u.x,u.y,TILE)
      u.path=findPath(this.tiles, this.buildings, from.tx,from.ty, tile.tx,tile.ty)
      if(u.path.length===0) u.path=[{x:p.x,y:p.y}]
      u.tx=p.x; u.ty=p.y; u.state='moving'; u.targetId=undefined
      if(attackMove) u.order='attackMove'
      u.facing=Math.atan2(p.y-u.y,p.x-u.x)
    })
  }

  issueAttack(targetId:string){
    const selected=this.units.filter(u=>this.selectedIds.has(u.id) && u.state!=='dead')
    selected.forEach(u=>{ u.targetId=targetId; u.state='attacking'; u.order='attack' })
  }

  issueStop(){ this.units.filter(u=>this.selectedIds.has(u.id)).forEach(u=>{u.state='idle'; u.path=[]; u.targetId=undefined; u.order='none'})}
  issueHold(){ this.units.filter(u=>this.selectedIds.has(u.id)).forEach(u=>{u.order='hold'; u.path=[]})}
  issueRetreat(){
    const cc=this.buildings.find(b=>b.type==='commandCenter'&&b.team==='player')
    if(!cc) return
    const cx=cc.x*TILE+cc.w*TILE/2, cy=cc.y*TILE+cc.h*TILE/2
    this.issueMove(cx,cy,false); this.units.filter(u=>this.selectedIds.has(u.id)).forEach(u=>u.order='retreat')
  }
  setFormation(f:FormationType){ this.formation=f; this.units.filter(u=>this.selectedIds.has(u.id)).forEach(u=>u.formation=f)}
  setOrder(o:TacticalOrder){ this.order=o; this.units.filter(u=>this.selectedIds.has(u.id)).forEach(u=>u.order=o)}
  createGroup(n:number){ this.controlGroups.set(n, [...this.selectedIds]) }
  selectGroup(n:number){
    const ids=this.controlGroups.get(n); if(!ids) return
    this.selectedIds=new Set(ids.filter(id=>this.units.some(u=>u.id===id&&u.state!=='dead')))
    this.units.forEach(u=>u.selected=this.selectedIds.has(u.id))
  }

  formationPositions(n:number, cx:number,cy:number, f:FormationType):Vec2[]{
    const out:Vec2[]=[]
    const spacing=32
    if(f==='line'||f==='none'){
      const cols=Math.ceil(Math.sqrt(n*1.6)), rows=Math.ceil(n/cols)
      for(let i=0;i<n;i++){ const r=(i/cols)|0, c=i%cols; out.push({x:cx+(c-(cols-1)/2)*spacing, y:cy+(r-(rows-1)/2)*spacing})}
    } else if(f==='column'){
      for(let i=0;i<n;i++) out.push({x:cx+(i%2?spacing/2:-spacing/2), y:cy+(i*spacing - n*spacing/2)})
    } else if(f==='wedge'){
      let idx=0; for(let row=0; idx<n; row++){ for(let k=-row;k<=row;k++){ if(idx>=n) break; out.push({x:cx+k*spacing, y:cy+row*spacing}); idx++ }}
    } else if(f==='box'){
      const per=Math.ceil(n/4)
      for(let i=0;i<n;i++){ const side=(i/per)|0, j=i%per; if(side===0) out.push({x:cx+(j-per/2)*spacing,y:cy-per*spacing/2}); else if(side===1) out.push({x:cx+per*spacing/2,y:cy+(j-per/2)*spacing}); else if(side===2) out.push({x:cx+(j-per/2)*spacing,y:cy+per*spacing/2}); else out.push({x:cx-per*spacing/2,y:cy+(j-per/2)*spacing})}
    } else if(f==='circle'){
      for(let i=0;i<n;i++){ const a=i/n*Math.PI*2; out.push({x:cx+Math.cos(a)*spacing*2, y:cy+Math.sin(a)*spacing*2})}
    }
    return out
  }

  // ── Update loop ──
  update(dt:number){
    if(this.paused||this.victory||this.defeat) return
    this.time+=dt
    this.camera.shake=Math.max(0,this.camera.shake - dt*3)
    // camera lerp
    this.camera.x += (this.camera.targetX - this.camera.x)* Math.min(1, dt*6)
    this.camera.y += (this.camera.targetY - this.camera.y)* Math.min(1, dt*6)
    this.camera.x=Math.max(0,Math.min(WORLD_W- 1280/this.camera.zoom, this.camera.x))
    this.camera.y=Math.max(0,Math.min(WORLD_H- 800/this.camera.zoom, this.camera.y))

    this.updateFog()
    this.updateUnits(dt)
    this.updateBuildings(dt)
    this.updateProjectiles(dt)
    this.updateParticles(dt)
    this.updateTech(dt)
    this.updateSupply(dt)
    this.updateAI(dt)
    this.checkVictory()
    // notifications timeout
    this.notifications=this.notifications.filter(n=>this.time - n.t < 4)
  }

  updateFog(){
    // reset visible
    for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++) this.fog[y][x]=false
    // player vision
    const sources: {x:number;y:number;v:number}[]=[]
    for(const u of this.units){ if(u.team==='player'&&u.state!=='dead') sources.push({x:u.x,y:u.y,v:u.vision}) }
    for(const b of this.buildings){ if(b.team==='player'&&b.progress>=1) sources.push({x:b.x*TILE+b.w*TILE/2,y:b.y*TILE+b.h*TILE/2,v: b.type==='watchtower'? 260: 140})}
    for(const s of sources){
      const r=s.v, tx0= Math.max(0, ((s.x - r)/TILE)|0), tx1=Math.min(MAP_W-1, ((s.x+r)/TILE)|0)
      const ty0= Math.max(0, ((s.y - r)/TILE)|0), ty1=Math.min(MAP_H-1, ((s.y+r)/TILE)|0)
      for(let ty=ty0;ty<=ty1;ty++) for(let tx=tx0;tx<=tx1;tx++){
        const cx=tx*TILE+TILE/2, cy=ty*TILE+TILE/2
        if(Math.hypot(cx-s.x, cy-s.y) <= r){ this.fog[ty][tx]=true; this.explored[ty][tx]=true }
      }
    }
  }

  updateUnits(dt:number){
    for(const u of this.units){
      if(u.state==='dead') continue
      // supply drain
      // terrain
      const tile=worldToTile(u.x,u.y,TILE)
      const terr=this.tiles[tile.ty]?.[tile.tx]?.terrain || 'plains'
      const speedMult = terrainSpeedMult(terr) * (u.supply<30?0.7:1) * (u.morale<30?0.85:1)
      // worker gathering logic
      if(u.type==='worker'){
        this.updateWorker(u, dt)
        continue
      }
      // cooldowns
      u.attackCooldown=Math.max(0,u.attackCooldown-dt)
      // movement via path
      if(u.path.length){
        const target=u.path[0]
        const dx=target.x-u.x, dy=target.y-u.y, d=Math.hypot(dx,dy)
        if(d<6){ u.path.shift(); if(!u.path.length){ u.state=u.order==='attackMove'?'idle':'idle'; u.tx=u.x; u.ty=u.y } }
        else {
          const mv= u.speed * speedMult * dt
          u.x += dx/d * mv; u.y+= dy/d * mv
          u.facing=Math.atan2(dy,dx)
          u.state='moving'
        }
      } else if(u.state==='moving'){
        const dx=u.tx-u.x, dy=u.ty-u.y, d=Math.hypot(dx,dy)
        if(d>4){ const mv=u.speed*speedMult*dt; u.x+= dx/d*mv; u.y+= dy/d*mv; u.facing=Math.atan2(dy,dx)}
        else u.state='idle'
      }
      // combat auto-acquire if attackMove or idle
      if(u.order==='hold'){
        // only attack if target in range
        if(u.targetId){ this.tryAttack(u) }
      } else {
        if(!u.targetId || !this.units.find(t=>t.id===u.targetId && t.state!=='dead')){
          // find nearest enemy within vision+range
          let best:Unit|null=null, bestD= 1e9
          const searchR = Math.max(u.range, u.vision)
          for(const e of this.units){ if(e.team===u.team||e.state==='dead') continue; const d=Math.hypot(e.x-u.x,e.y-u.y); if(d<searchR && d<bestD){ bestD=d; best=e }}
          // also buildings
          let bestB:Building|null=null, bestBD=1e9
          for(const b of this.buildings){ if(b.team===u.team) continue; const bx=b.x*TILE+b.w*TILE/2, by=b.y*TILE+b.h*TILE/2; const d=Math.hypot(bx-u.x,by-u.y); if(d<searchR&&d<bestBD){bestBD=d; bestB=b}}
          if(best && bestD < (bestB?bestBD:1e9)){ u.targetId=best.id }
          else if(bestB){ // attack building
            this.attackBuilding(u,bestB,dt)
            continue
          } else {
            if(u.order==='attackMove' && u.path.length===0){
              // patrol scan — stay idle until enemy appears
            }
          }
        }
        if(u.targetId) this.tryAttack(u)
      }
      // clamp world
      u.x=Math.max(8,Math.min(WORLD_W-8,u.x)); u.y=Math.max(8,Math.min(WORLD_H-8,u.y))
    }
    // remove dead after delay? keep for a tick to show
    this.units=this.units.filter(u=> !(u.state==='dead' && u.hp<=0 && Math.random()<0.02) || true) // keep dead visible for now; we set state dead but not removed immediately
    // actually remove dead that have been dead for a bit: use hp <=0 and state dead -> remove after particles
    // we mark dead hp<=0; keep in array until cleared next frame if hp<=0
    // To avoid immediate removal, keep them for visual but don't update
    // We'll filter strictly: if hp<=0 state dead -> will be removed after 1 sec via particle life; for now keep but skip logic already.
  }

  updateWorker(u:Unit, dt:number){
    u.gatherCooldown=Math.max(0,u.gatherCooldown-dt)
    u.attackCooldown=Math.max(0,u.attackCooldown-dt)
    const tile=worldToTile(u.x,u.y,TILE)
    // if carrying and near depot/CC, deposit
    if(u.carryAmount>0){
      const depot=this.nearestDepot(u.x,u.y, u.team)
      if(depot){
        const dx=depot.x - u.x, dy=depot.y - u.y, d=Math.hypot(dx,dy)
        if(d< 28){
          // deposit
          const amt=u.carryAmount
          this.resources[u.carryType!]+=amt
          if(u.team==='player') this.stats.resourcesGathered[u.carryType!]+=amt
          u.carryAmount=0; u.carryType=undefined
          u.gatherCooldown=0
          // find next resource
          const res=this.nearestResource(u.x,u.y)
          if(res){ const p=findPath(this.tiles,this.buildings,tile.tx,tile.ty,res.tx,res.ty); u.path=p.length?p:[{x:res.x,y:res.y}]; u.state='moving' }
          return
        } else {
          if(!u.path.length){
            const t=worldToTile(depot.x,depot.y,TILE)
            u.path=findPath(this.tiles,this.buildings,tile.tx,tile.ty,t.tx,t.ty)
          }
          this.moveAlongPath(u, dt)
          return
        }
      }
    }
    // if empty, go gather
    if(u.carryAmount===0){
      // if on resource tile, gather
      const t=this.tiles[tile.ty]?.[tile.tx]
      if(t?.resource && (t.resourceAmount||0)>0){
        if(u.gatherCooldown<=0){
          const gatherRate= this.hasTech('econ1')?13:10
          const amt=Math.min(gatherRate, t.resourceAmount!, u.carryCap - u.carryAmount)
          t.resourceAmount!-=amt; u.carryAmount+=amt; u.carryType=t.resource
          if(t.resourceAmount!<=0){ t.resource=undefined; t.resourceAmount=undefined }
          u.gatherCooldown=0.6
          u.state='gathering'
          // visual dust
          this.spawnParticles(u.x,u.y, 3,'dust')
        }
        if(u.carryAmount>=u.carryCap){
          // go return
          const depot=this.nearestDepot(u.x,u.y,u.team)
          if(depot){ const dtile=worldToTile(depot.x,depot.y,TILE); u.path=findPath(this.tiles,this.buildings,tile.tx,tile.ty,dtile.tx,dtile.ty); u.state='moving' }
        }
        return
      }
      // find nearest resource
      const res=this.nearestResource(u.x,u.y)
      if(res){
        if(!u.path.length){
          const rt=worldToTile(res.x,res.y,TILE)
          u.path=findPath(this.tiles,this.buildings,tile.tx,tile.ty,rt.tx,rt.ty)
          if(!u.path.length) u.path=[res]
        }
        this.moveAlongPath(u,dt)
        return
      }
      // no resource: idle wander near base
      if(!u.path.length){ u.state='idle'; }
      else this.moveAlongPath(u,dt)
      return
    }
    // movement fallback
    if(u.path.length) this.moveAlongPath(u,dt)
  }

  moveAlongPath(u:Unit, dt:number){
    if(!u.path.length) return
    const terr=this.tiles[worldToTile(u.x,u.y,TILE).ty]?.[worldToTile(u.x,u.y,TILE).tx]?.terrain || 'plains'
    const sm=terrainSpeedMult(terr)
    const target=u.path[0]
    const dx=target.x-u.x, dy=target.y-u.y, d=Math.hypot(dx,dy)
    if(d<6) u.path.shift()
    else { const mv=u.speed*sm*dt; u.x+=dx/d*mv; u.y+=dy/d*mv; u.facing=Math.atan2(dy,dx); u.state='moving' }
  }

  nearestDepot(x:number,y:number, team:Team){
    let best:{x:number;y:number;dist:number}|null=null
    for(const b of this.buildings){ if(b.team!==team||b.progress<1) continue; if(!['commandCenter','supplyDepot','lumberCamp','quarry','mine','farm'].includes(b.type)) continue; const bx=b.x*TILE+b.w*TILE/2, by=b.y*TILE+b.h*TILE/2; const d=Math.hypot(bx-x,by-y); if(!best||d<best.dist) best={x:bx,y:by,dist:d}}
    return best
  }
  nearestResource(x:number,y:number){
    let best:{x:number;y:number;tx:number;ty:number;dist:number}|null=null
    for(let ty=0;ty<MAP_H;ty++) for(let tx=0;tx<MAP_W;tx++){ const t=this.tiles[ty][tx]; if(!t.resource) continue; const cx=tx*TILE+TILE/2, cy=ty*TILE+TILE/2; const d=Math.hypot(cx-x,cy-y); if(!best||d<best.dist) best={x:cx,y:cy,tx,ty,dist:d}}
    return best
  }

  tryAttack(u:Unit){
    const target=this.units.find(t=>t.id===u.targetId && t.state!=='dead')
    if(!target) { u.targetId=undefined; return }
    const d=Math.hypot(target.x-u.x, target.y-u.y)
    u.facing=Math.atan2(target.y-u.y, target.x-u.x)
    if(d > u.range){
      // move towards
      if(u.order!=='hold' && u.path.length===0){
        const tt=worldToTile(target.x,target.y,TILE), ff=worldToTile(u.x,u.y,TILE)
        u.path=findPath(this.tiles,this.buildings,ff.tx,ff.ty,tt.tx,tt.ty)
        if(!u.path.length) u.path=[{x:target.x,y:target.y}]
      }
      if(u.path.length) this.moveAlongPath(u, 0.016) // will be called again in updateUnits but for ranged need to chase
      return
    }
    // in range — attack
    if(u.attackCooldown>0) return
    // ranged vs melee
    const isRanged = u.range > 40
    if(isRanged){
      // fire projectile
      this.projectiles.push({
        id:nid('p'), x:u.x, y:u.y, tx:target.x, ty:target.y, targetId:target.id,
        damage: this.computeDamage(u,target), speed: 380 + Math.random()*60, team:u.team,
        type: u.type==='catapult'?'stone': u.type==='ballista'?'bolt':'arrow', arc: isRanged? 18:0
      })
      u.attackCooldown= 1 / Math.max(0.2,u.attackSpeed)
      // muzzle smoke
      this.spawnParticles(u.x,u.y,2,'smoke')
    } else {
      // melee instant with hit effect
      const dmg=this.computeDamage(u,target)
      this.applyDamage(target, dmg, u)
      u.attackCooldown= 1/ Math.max(0.2,u.attackSpeed)
      this.spawnParticles(target.x,target.y,4,'blood')
      this.camera.shake = Math.min(6, this.camera.shake + 0.6)
    }
  }

  attackBuilding(u:Unit, b:Building, _dt:number){
    const bx=b.x*TILE+b.w*TILE/2, by=b.y*TILE+b.h*TILE/2
    const d=Math.hypot(bx-u.x, by-u.y)
    u.facing=Math.atan2(by-u.y,bx-u.x)
    if(d>u.range){
      if(u.path.length===0){ const tt={tx:b.x,ty:b.y}, ff=worldToTile(u.x,u.y,TILE); u.path=findPath(this.tiles,this.buildings,ff.tx,ff.ty,tt.tx,tt.ty)}
      if(u.path.length) this.moveAlongPath(u,0.016)
      return
    }
    if(u.attackCooldown>0) return
    const isRanged=u.range>40
    if(isRanged){
      this.projectiles.push({id:nid('p'),x:u.x,y:u.y,tx:bx,ty:by,targetId:b.id,damage:u.damage*1.5,speed:360,team:u.team,type:u.type==='catapult'?'stone':'bolt',arc:18})
      u.attackCooldown=1/Math.max(0.2,u.attackSpeed)
    } else {
      b.hp-= Math.max(1, u.damage - b.armor*0.5)
      u.attackCooldown=1/Math.max(0.2,u.attackSpeed)
      this.spawnParticles(bx,by,5,'debris')
      if(b.hp<=0) this.destroyBuilding(b)
    }
  }

  computeDamage(attacker:Unit, defender:Unit){
    let dmg=attacker.damage
    // counter
    dmg*= counterMultiplier(attacker.type, defender.type)
    // armor
    dmg=Math.max(2, dmg - defender.armor*0.7)
    // terrain defense
    const tile=worldToTile(defender.x,defender.y,TILE)
    dmg-= terrainDefenseBonus(this.tiles[tile.ty]?.[tile.tx]?.terrain||'plains')
    // directional: rear/side
    const toAttacker=Math.atan2(attacker.y-defender.y, attacker.x-defender.x)
    let diff=Math.abs(toAttacker - defender.facing); diff= Math.atan2(Math.sin(diff), Math.cos(diff)); diff=Math.abs(diff)
    if(diff > 2.2) dmg*=1.55 // rear ~126 deg behind
    else if(diff > 1.0) dmg*=1.18 // side
    // morale
    dmg*= 0.7 + attacker.morale/100*0.6
    dmg*= 1.1 - defender.morale/100*0.2
    // supply
    if(attacker.supply<30) dmg*=0.75
    // high ground
    const aH=this.tiles[worldToTile(attacker.x,attacker.y,TILE).ty]?.[worldToTile(attacker.x,attacker.y,TILE).tx]?.height||0
    const dH=this.tiles[worldToTile(defender.x,defender.y,TILE).ty]?.[worldToTile(defender.x,defender.y,TILE).tx]?.height||0
    if(aH>dH) dmg*=1.12
    return Math.max(1, dmg|0)
  }

  applyDamage(target:Unit, dmg:number, attacker:Unit){
    target.hp-=dmg
    // morale hit
    target.morale=Math.max(0,target.morale-6)
    attacker.morale=Math.min(100,attacker.morale+1.5)
    // flanking morale: if surrounded, bigger drop
    const nearbyEnemies=this.units.filter(u=>u.team!==target.team&&u.state!=='dead'&&Math.hypot(u.x-target.x,u.y-target.y)<90).length
    const nearbyAllies=this.units.filter(u=>u.team===target.team&&u.state!=='dead'&&Math.hypot(u.x-target.x,u.y-target.y)<90).length
    if(nearbyEnemies> nearbyAllies+1) target.morale=Math.max(0,target.morale-4)
    if(target.hp<=0){
      target.hp=0; target.state='dead'
      this.spawnParticles(target.x,target.y,8,'blood')
      this.spawnParticles(target.x,target.y,6,'dust')
      if(target.team==='enemy') this.stats.kills++
      else { this.stats.losses++; if(target.team==='player') this.notify(`${target.type} fallen`) }
      // morale ripple
      for(const u of this.units){ if(u.team===target.team&&u.state!=='dead'&&Math.hypot(u.x-target.x,u.y-target.y)<140) u.morale=Math.max(0,u.morale-5)}
    }
  }

  updateBuildings(dt:number){
    for(const b of this.buildings){
      if(b.progress<1){ b.progress=Math.min(1,b.progress+ dt*0.2); continue }
      if(b.queue.length){
        b.queueProgress+=dt
        const cur=b.queue[0]
        const need=UNIT_STATS[cur].buildTime * 0.5 // faster for gameplay
        if(b.queueProgress>=need){
          b.queueProgress=0; b.queue.shift()
          const sx=b.x*TILE+b.w*TILE/2 + (Math.random()-0.5)*30
          const sy=b.y*TILE+b.h*TILE/2 + b.h*TILE/2 + 20
          this.spawnUnit(cur,b.team,sx,sy)
          this.spawnParticles(sx,sy,6,'dust')
        }
      }
    }
  }

  updateProjectiles(dt:number){
    const next:Projectile[]=[]
    for(const p of this.projectiles){
      const target=this.units.find(u=>u.id===p.targetId && u.state!=='dead') || this.buildings.find(b=>b.id===p.targetId)
      let tx=p.tx, ty=p.ty
      if(target){ tx= (target as Unit).x ?? (target as Building).x*TILE; ty=(target as Unit).y ?? (target as Building).y*TILE}
      const dx=tx-p.x, dy=ty-p.y, d=Math.hypot(dx,dy)
      if(d<10){
        // hit
        if((target as Unit)?.hp!==undefined){
          const u=target as Unit
          // find attacker team? use p.team to find attacker for morale; use dummy
          const dummy={team:p.team, type:'archer' as UnitType, morale:70, damage:p.damage} as Unit
          // need real attacker stats — approximate with p.damage already computed with bonuses except directional? ok
          let dmg=p.damage
          // apply armor/directional for projectile
          dmg=Math.max(2, dmg - (u.armor*0.7))
          this.applyDamage(u,dmg, {team:p.team, morale:70} as Unit)
          this.spawnParticles(u.x,u.y,5, p.type==='stone'?'debris':'blood')
        } else if((target as Building)?.hp!==undefined){
          const b=target as Building; b.hp-= Math.max(1,p.damage - b.armor*0.5); this.spawnParticles(b.x*TILE,b.y*TILE,6,'debris'); if(b.hp<=0) this.destroyBuilding(b)
        } else {
          this.spawnParticles(tx,ty,4,'dust')
        }
        continue
      }
      const mv=p.speed*dt
      // arc
      const t = d/ (p.speed*0.5)
      const arcOff = p.arc * Math.sin(Math.min(1,t)*Math.PI) * 0.5
      p.x+= dx/d*mv
      p.y+= dy/d*mv - arcOff*dt*8
      next.push(p)
    }
    this.projectiles=next
  }

  destroyBuilding(b:Building){
    this.spawnParticles(b.x*TILE+b.w*TILE/2, b.y*TILE+b.h*TILE/2, 18,'debris')
    this.spawnParticles(b.x*TILE+b.w*TILE/2, b.y*TILE+b.h*TILE/2, 10,'smoke')
    this.spawnParticles(b.x*TILE+b.w*TILE/2, b.y*TILE+b.h*TILE/2, 8,'fire')
    this.camera.shake=8
    const wasPlayer=b.team==='player'
    this.buildings=this.buildings.filter(x=>x.id!==b.id)
    if(wasPlayer) this.stats.buildingsLost++; else this.stats.buildingsDestroyed++
    if(b.type==='commandCenter'){
      this.notify(wasPlayer? 'Command Center destroyed!':'Enemy Command Center destroyed!')
    }
  }

  spawnParticles(x:number,y:number,n:number,type:Particle['type']){
    for(let i=0;i<n;i++) this.particles.push({
      x:x+(Math.random()-0.5)*14, y:y+(Math.random()-0.5)*14,
      vx:(Math.random()-0.5)*120, vy:(Math.random()-0.5)*120 - (type==='smoke'?30:0),
      life:0, maxLife: 0.4+Math.random()*0.8, color:type, size: 2+Math.random()*4, type
    })
  }
  updateParticles(dt:number){
    for(const p of this.particles){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+= 60*dt; p.life+=dt }
    this.particles=this.particles.filter(p=>p.life<p.maxLife)
    if(this.particles.length>600) this.particles.splice(0, this.particles.length-600)
  }

  updateTech(dt:number){
    for(const t of this.techs){ if(t.researching){ t.progress+= dt*0.18; if(t.progress>=1){ t.researching=false; t.done=true; t.progress=1; this.notify(`Research complete: ${t.name}`) } } }
  }

  updateSupply(dt:number){
    this.supplyTimer+=dt
    if(this.supplyTimer<2) return
    this.supplyTimer=0
    for(const u of this.units){
      if(u.state==='dead') continue
      // distance to nearest depot/base
      const depot=this.nearestDepot(u.x,u.y,u.team)
      const dist=depot? Math.hypot(depot.x-u.x, depot.y-u.y): 9999
      const hasWagon=this.units.some(w=>w.type==='supplyWagon'&&w.team===u.team&&w.state!=='dead'&&Math.hypot(w.x-u.x,w.y-u.y)<180)
      if(hasWagon) { u.supply=Math.min(100,u.supply+8) }
      else if(dist> 420) u.supply=Math.max(0,u.supply-6)
      else if(dist> 300) u.supply=Math.max(0,u.supply-2)
      else u.supply=Math.min(100,u.supply+4)
      // supply wagon itself consumes slowly
      if(u.type==='supplyWagon') u.supply=Math.max(0,u.supply-1)
      // low supply morale
      if(u.supply<25) u.morale=Math.max(0,u.morale-1.5)
    }
  }

  updateAI(dt:number){
    this.aiTimer+=dt
    if(this.aiTimer<1.2) return
    this.aiTimer=0
    const diffMult = this.difficulty==='easy'?0.6 : this.difficulty==='hard'?1.2 : this.difficulty==='general'?1.5:1
    // AI economy: workers gather automatically already via updateWorker (same logic). Just ensure workers exist
    const enemyWorkers=this.units.filter(u=>u.team==='enemy'&&u.type==='worker'&&u.state!=='dead').length
    const enemyCC=this.buildings.find(b=>b.team==='enemy'&&b.type==='commandCenter')
    if(enemyWorkers<4 && enemyCC && Math.random()<0.5*diffMult){
      // train worker
      enemyCC.queue.push('worker')
    }
    // AI build
    if(Math.random()<0.18*diffMult){
      const opts:BuildingType[]=['barracks','archeryRange','stable','farm','supplyDepot','watchtower']
      const pick=opts[Math.random()*opts.length|0]
      const st=BUILDING_STATS[pick]
      const base=this.buildings.find(b=>b.team==='enemy'&&b.type==='commandCenter')
      if(base){
        const tx=base.x + (Math.random()*6|0)-3, ty=base.y + (Math.random()*6|0)-3
        // simple check: if not blocked, spawn
        let blocked=false
        for(const b of this.buildings) if(!(tx+st.w<=b.x||tx>=b.x+b.w||ty+st.h<=b.y||ty>=b.y+b.h)) blocked=true
        if(!blocked && tx>=0&&ty>=0&&tx+st.w<MAP_W&&ty+st.h<MAP_H){
          this.spawnBuilding(pick,'enemy',tx,ty)
        }
      }
    }
    // AI train units
    const barracks=this.buildings.filter(b=>b.team==='enemy'&&b.type==='barracks'&&b.progress>=1)
    const archery=this.buildings.filter(b=>b.team==='enemy'&&b.type==='archeryRange'&&b.progress>=1)
    const stable=this.buildings.filter(b=>b.team==='enemy'&&b.type==='stable'&&b.progress>=1)
    const enemyPop=this.units.filter(u=>u.team==='enemy'&&u.state!=='dead').length
    const cap=30
    if(enemyPop<cap){
      if(barracks.length && Math.random()<0.5*diffMult){
        const u:UnitType = Math.random()<0.5?'swordsman': Math.random()<0.5?'spearman':'heavy'
        barracks[0].queue.push(u)
      }
      if(archery.length && Math.random()<0.4*diffMult){
        archery[0].queue.push(Math.random()<0.6?'archer':'crossbow')
      }
      if(stable.length && Math.random()<0.3*diffMult){
        stable[0].queue.push(Math.random()<0.5?'lightCav':'heavyCav')
      }
      // siege
      const siege=this.buildings.find(b=>b.team==='enemy'&&b.type==='siegeWorkshop')
      if(!siege && Math.random()<0.08*diffMult && this.units.filter(u=>u.team==='enemy').length>10){
        const base=this.buildings.find(b=>b.team==='enemy'&&b.type==='commandCenter')
        if(base) this.spawnBuilding('siegeWorkshop','enemy',base.x+3,base.y)
      } else if(siege && Math.random()<0.15*diffMult){
        siege.queue.push(Math.random()<0.5?'catapult':'ballista')
      }
    }
    // AI attack: gather army near enemy CC then attack player CC
    const playerCC=this.buildings.find(b=>b.team==='player'&&b.type==='commandCenter')
    const enemyUnits=this.units.filter(u=>u.team==='enemy'&&u.state!=='dead'&&u.type!=='worker')
    if(playerCC && enemyUnits.length>6 && Math.random()<0.35*diffMult){
      // issue attack move to player CC
      const tx=playerCC.x*TILE+playerCC.w*TILE/2 + (Math.random()-0.5)*80
      const ty=playerCC.y*TILE+playerCC.h*TILE/2 + (Math.random()-0.5)*80
      // 60% of army attacks, rest holds
      const attackers=enemyUnits.filter((_,i)=> i%2===0 || Math.random()<0.6)
      for(const u of attackers){
        if(u.order==='hold') continue
        const from=worldToTile(u.x,u.y,TILE), to=worldToTile(tx,ty,TILE)
        u.path=findPath(this.tiles,this.buildings,from.tx,from.ty,to.tx,to.ty)
        if(!u.path.length) u.path=[{x:tx,y:ty}]
        u.tx=tx; u.ty=ty; u.order='attackMove'
      }
    }
    // AI scout harassment: scouts go to player
    for(const s of this.units.filter(u=>u.team==='enemy'&&u.type==='scout'&&u.state!=='dead'&&!u.path.length&&Math.random()<0.3)){
      if(playerCC){ const tx=playerCC.x*TILE, ty=playerCC.y*TILE; const ff=worldToTile(s.x,s.y,TILE), tt=worldToTile(tx,ty,TILE); s.path=findPath(this.tiles,this.buildings,ff.tx,ff.ty,tt.tx,tt.ty)}
    }
  }

  checkVictory(){
    const playerCC=this.buildings.filter(b=>b.team==='player'&&b.type==='commandCenter').length
    const enemyCC=this.buildings.filter(b=>b.team==='enemy'&&b.type==='commandCenter').length
    if(playerCC===0){ this.defeat=true; this.paused=true; this.notify('DEFEAT — Command Center lost') }
    else if(enemyCC===0){ this.victory=true; this.paused=true; this.notify('VICTORY — Enemy Command Center destroyed!') }
    else {
      // objective check
      for(const o of this.objectives){
        if(o.done||o.failed) continue
        if(o.type==='destroy'){
          const t=this.buildings.find(b=>b.id===o.targetId) || this.units.find(u=>u.id===o.targetId)
          if(!t) o.done=true
        } else if(o.type==='capture'){
          // capture if player unit near target
          if(o.targetX!==undefined){ const near=this.units.some(u=>u.team==='player'&&u.state!=='dead'&&Math.hypot(u.x-o.targetX!,u.y-o.targetY!)<60); if(near) o.done=true }
        }
      }
      if(this.objectives.length && this.objectives.every(o=>o.done)){ this.victory=true; this.paused=true }
    }
  }

  notify(text:string){ this.notifications.push({id:nid('n'),text,t: this.time}) }

  // ── Camera ──
  pan(dx:number,dy:number){ this.camera.targetX+=dx; this.camera.targetY+=dy }
  zoomAt(delta:number, mx:number,my:number){
    const old=this.camera.zoom
    this.camera.zoom=Math.max(0.55,Math.min(1.8,this.camera.zoom + delta))
    // keep mouse world pos stable
    const wx=this.camera.x + mx/old
    const wx2=this.camera.x + mx/this.camera.zoom
    this.camera.targetX += wx - wx2
    const wy=this.camera.y + my/old
    const wy2=this.camera.y + my/this.camera.zoom
    this.camera.targetY += wy - wy2
  }
  focusOn(x:number,y:number){ this.camera.targetX=x-640/this.camera.zoom; this.camera.targetY=y-400/this.camera.zoom }

  // save
  serialize(){
    return JSON.stringify({seed:this.seed, resources:this.resources, pop:this.pop, popCap:this.popCap, units:this.units, buildings:this.buildings, time:this.time, difficulty:this.difficulty, techs:this.techs, objectives:this.objectives })
  }
  deserialize(s:string){
    try{ const d=JSON.parse(s); this.resources=d.resources; this.pop=d.pop; this.popCap=d.popCap; this.units=d.units; this.buildings=d.buildings; this.time=d.time; this.difficulty=d.difficulty; this.techs=d.techs; this.objectives=d.objectives; this.notify('Game loaded')}catch{}
  }
}
