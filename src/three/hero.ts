// First-person / third-person hero proxy — the commanded avatar.
// Engine still owns all units; hero is a distinguished unit id.
import * as THREE from 'three'
import type { GameEngine } from '../game/engine'

export class HeroRig {
  group = new THREE.Group()
  heroId: string | null = null
  third = true // TPS behind hero; false = FPS inside head
  yaw = 0
  pitch = 0.12
  camDist = 7
  constructor(scene: THREE.Scene){
    scene.add(this.group)
  }
  bind(engine: GameEngine){
    // pick or spawn the player hero (heavy, distinguished)
    let hero: typeof engine.units[number] | null | undefined = engine.units.find(u=>u.team==='player' && (u as any).isHero)
    if(!hero){
      // promote first heavy/swordsman to hero, or spawn one near CC
      hero = engine.units.find(u=>u.team==='player'&&u.type==='heavy') || engine.units.find(u=>u.team==='player'&&u.type==='swordsman') || null
      if(hero) (hero as any).isHero=true
      else {
        const cc=engine.buildings.find(b=>b.team==='player'&&b.type==='commandCenter')
        hero=engine.spawnUnit('heavy','player', (cc?cc.x*32+48: 13*32), (cc?cc.y*32+48: 13*32))
        ;(hero as any).isHero=true; hero.maxHp*=1.6; hero.hp=hero.maxHp; hero.damage*=1.25
      }
    }
    this.heroId=hero.id
    return hero
  }
  getHero(engine: GameEngine){ return engine.units.find(u=>u.id===this.heroId) || null }
  // apply WASD + mouseLook (called from GameCanvas3D owner)
  // returns intended move vector in world pixels
  intent(engine: GameEngine, keys: Set<string>, mouseDX:number, mouseDY:number, dt:number){
    const hero=this.getHero(engine); if(!hero) return
    this.yaw -= mouseDX*0.0032
    this.pitch = Math.max(-0.6, Math.min(0.55, this.pitch - mouseDY*0.003))
    hero.facing = this.yaw // sync facing
    const fwd=new THREE.Vector2(Math.cos(this.yaw), Math.sin(this.yaw))
    const right=new THREE.Vector2(-fwd.y, fwd.x)
    const mv=new THREE.Vector2()
    if(keys.has('w')) mv.add(fwd)
    if(keys.has('s')) mv.sub(fwd)
    if(keys.has('a')) mv.sub(right)
    if(keys.has('d')) mv.add(right)
    if(mv.lengthSq()>0){ mv.normalize(); hero.tx = hero.x + mv.x*64; hero.ty = hero.y + mv.y*64; hero.state='moving'; hero.order='none' as any }
    // allies follow hero loosely: if hero moves, nearby selected-adjacent friendlies get a formation nudge
    if(mv.lengthSq()>0 && engine.selectedIds.size===0){
      for(const u of engine.units){ if(u.team!=='player'||u.id===hero.id||u.state==='dead') continue; if(Math.hypot(u.x-hero.x,u.y-hero.y)< 220){ u.tx = u.x + mv.x*28 + (Math.random()-.5)*18; u.ty = u.y + mv.y*28 + (Math.random()-.5)*18; u.state='moving' as any } }
    }
  }
}
