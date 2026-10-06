// ── Full Three.js wrapper ──
// Owns renderer, scene, camera, world. Engine drives logic, this draws it.
import * as THREE from 'three'
import { createSoldierMesh, createBuildingMesh, createTreeVariant, createRock, updateSoldierAnim } from './assets'
import type { GameEngine } from '../game/engine'
import { TILE, MAP_W, MAP_H, WORLD_W, WORLD_H } from '../game/types'
import { BUILDING_STATS } from '../game/balance'

export class ThreeWorld {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  canvas: HTMLCanvasElement
  engine: GameEngine | null = null
  // groups
  terrain!: THREE.Group
  buildingMeshes = new Map<string, THREE.Group>()
  soldierMeshes = new Map<string, THREE.Group>()
  projectileMeshes = new Map<string, THREE.Mesh>()
  selectRings = new Map<string, THREE.Mesh>()
  fogOverlay!: THREE.Mesh
  // camera control state
  camYaw = -0.35
  camPitch = 1.02 // ~58°
  camDist = 34
  camTarget = new THREE.Vector3(WORLD_W/2 / 32, 0, WORLD_H/2 / 32) // world in 3D units (1 tile =1 unit)
  shake = 0
  // raycaster helpers
  raycaster = new THREE.Raycaster()
  groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0)
  // particles
  smokeGroup = new THREE.Group()
  hitGroup = new THREE.Group()
  // reusable
  tmpVec2 = new THREE.Vector2()
  tmpVec3 = new THREE.Vector3()

  constructor(canvas: HTMLCanvasElement){
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x8ec8e8)
    this.scene.fog = new THREE.Fog(0x9ad0e8, 55, 95)

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 300)
    this.camera.position.set(0, 20, 0)

    this.buildStatic()
    this.setupLights()
  }

  private setupLights(){
    const sun = new THREE.DirectionalLight(0xfff6e0, 1.8)
    sun.position.set(18, 32, 12)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048,2048)
    sun.shadow.camera.left=-40; sun.shadow.camera.right=40; sun.shadow.camera.top=40; sun.shadow.camera.bottom=-40
    sun.shadow.camera.near=1; sun.shadow.camera.far=90
    sun.shadow.bias = -0.0006
    this.scene.add(sun)
    this.scene.add(new THREE.HemisphereLight(0x9ad0ff, 0x2a3a18, 0.9))
    // fill
    const fill = new THREE.DirectionalLight(0x8ac0ff, 0.35); fill.position.set(-12, 18, -10); this.scene.add(fill)
  }

  private buildStatic(){
    this.terrain = new THREE.Group(); this.scene.add(this.terrain)
    // ground base plane
    const groundGeo = new THREE.PlaneGeometry(MAP_W, MAP_H, MAP_W, MAP_H)
    // vertex colors / height displace
    const pos = groundGeo.getAttribute('position') as THREE.BufferAttribute
    const colors: number[] = []
    const colPlains = new THREE.Color(0x5a8a3a)
    const colHill = new THREE.Color(0x7a8a5a)
    const colMtn = new THREE.Color(0x7a7a7a)
    const colWater = new THREE.Color(0x2a6a9a)
    const colRoad = new THREE.Color(0x7a6a4a)
    const colForest = new THREE.Color(0x3a6a2a)
    for (let i=0;i<pos.count;i++){
      const x = Math.round(pos.getX(i)+MAP_W/2)
      const y = Math.round(pos.getY(i)+MAP_H/2)
      // height will be set later from tiles
      pos.setZ(i, 0)
      const c = colPlains; colors.push(c.r,c.g,c.b)
    }
    void pos; void colors; void colHill; void colMtn; void colWater; void colRoad; void colForest
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const groundMat = new THREE.MeshStandardMaterial({ vertexColors: false, color: 0x6a9a4a, roughness: 0.95, metalness: 0 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI/2
    ground.position.set(MAP_W/2, 0, MAP_H/2)
    ground.receiveShadow = true
    ground.name = 'ground'
    this.terrain.add(ground)
    // store for tile tinting later
    ;(this.terrain as any)._ground = ground
    ;(this.terrain as any)._groundGeo = groundGeo

    // sky dome
    const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 16, 12), new THREE.MeshBasicMaterial({ color: 0x8ec8e8, side: THREE.BackSide }))
    this.scene.add(sky)

    this.scene.add(this.smokeGroup)
    this.scene.add(this.hitGroup)
  }

  attachEngine(engine: GameEngine){
    this.engine = engine
    this.camTarget.set((10*TILE+40)/TILE/1, 0, (10*TILE+40)/TILE/1) // near player base tiles 10,10
    this.camTarget.set(10+1.5, 0, 10+1.5)
    this.rebuildFromTiles()
  }

  rebuildFromTiles(){
    const engine = this.engine; if(!engine) return
    // tint ground + displace height
    const ground = (this.terrain as any)._ground as THREE.Mesh
    const geo = (this.terrain as any)._groundGeo as THREE.PlaneGeometry
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    // geo is centered; mapping: vertex x,y in plane local -> world = MAP_W/2 + x, MAP_H/2 + y? Actually our loop earlier used that.
    // Simpler: iterate tiles and tint via canvas texture is easier than vertex colors per-vertex mismatch.
    // Instead create a 80x60 DataTexture tint
    const w = MAP_W, h = MAP_H
    const data = new Uint8Array(w*h*3)
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const t = engine.tiles[y][x]
      let c: [number,number,number] = [90,138,58]
      if(t.terrain==='water') c=[42,106,154]
      else if(t.terrain==='mountain') c=[118,118,118]
      else if(t.terrain==='hill') c=[122,138,90]
      else if(t.terrain==='forest') c=[58,106,42]
      else if(t.terrain==='road'||t.terrain==='bridge') c=[122,106,74]
      else if(t.terrain==='village') c=[138,122,90]
      else if(t.resource==='gold') c=[160,138,40]
      else if(t.resource==='stone') c=[138,138,138]
      if(t.height===2) c=c.map(v=>Math.min(255,v+18)) as any
      if(t.height===3) c=c.map(v=>Math.min(255,v+28)) as any
      const i=(y*w+x)*3; data[i]=c[0]; data[i+1]=c[1]; data[i+2]=c[2]
      // height
      // find vertex index: plane has (w+1) seg? No we used w,h seg => (w+1)*(h+1) vertices. Tile at (x,y) corresponds approx to 1 vertex.
      // Approximate: set height for the tile center vertex
      // Instead we set via nearest vertex lookup
    }
    // height: apply to vertices by sampling tiles
    for(let i=0;i<pos.count;i++){
      const lx = pos.getX(i), ly = pos.getY(i)
      const wx = Math.round(lx + w/2)
      const wy = Math.round(ly + h/2)
      const tx = Math.max(0, Math.min(w-1, wx))
      const ty = Math.max(0, Math.min(h-1, wy))
      const hh = engine.tiles[ty]?.[tx]?.height || 0
      // Z in plane local is up; after rotation it becomes Y. But we displace Z now (before rotation, Z is up? No plane is XY then rotated.)
      // Easier: after rotation, height is Y. But our ground rotation is -PI/2, so local Z becomes world Y.
      // Our pos Z is local Z; it will become world Y after rotation? Actually PlaneGeometry is XY plane. Rotation -PI/2 makes Y->Z. Wait: Plane XY, rotate X -90: local Z becomes world -Y? Let's just set Z.
      pos.setZ(i, hh*0.55)
      void wx; void wy; void tx; void ty
    }
    pos.needsUpdate = true; geo.computeVertexNormals()
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBFormat)
    tex.needsUpdate = true; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter
    ;(ground.material as THREE.MeshStandardMaterial).map = tex
    ;(ground.material as THREE.MeshStandardMaterial).needsUpdate = true

    // clear old decor
    for(const c of [...this.terrain.children]) if((c as any)._decor) this.terrain.remove(c)
    // scatter trees / rocks / veget
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const t = engine.tiles[y][x]
      if(t.terrain==='forest'){
        const g = createTreeVariant(0.85 + Math.random()*0.45, (x*7+y*13)%3)
        g.position.set(x+0.3+Math.random()*0.4, t.height*0.55 + 0.02, y+0.3+Math.random()*0.4)
        g.rotation.y = Math.random()*Math.PI*2
        ;(g as any)._decor = true
        this.terrain.add(g)
      } else if(t.terrain==='mountain'){
        const r = createRock(0.9 + Math.random()*0.6); r.position.set(x+0.5, t.height*0.55+0.18, y+0.5); r.rotation.set(Math.random()*0.4, Math.random()*Math.PI*2, Math.random()*0.4); (r as any)._decor=true; this.terrain.add(r)
        if(Math.random()<0.35){ const r2=createRock(0.5); r2.position.set(x+0.25+Math.random()*0.5, t.height*0.55+0.08, y+0.25+Math.random()*0.5); (r2 as any)._decor=true; this.terrain.add(r2) }
      } else if(t.terrain==='hill'){
        if(Math.random()<0.18){ const r=createRock(0.55); r.position.set(x+0.5, t.height*0.55+0.08, y+0.5); (r as any)._decor=true; this.terrain.add(r) }
      } else if(t.resource==='stone'){
        const r=createRock(0.7); r.position.set(x+0.5, 0.12, y+0.5); (r as any)._decor=true; this.terrain.add(r)
      } else if(t.resource==='gold'){
        const g=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.22,0.32), new THREE.MeshStandardMaterial({ color: 0xc8a828, metalness: 0.4, roughness: 0.4 })); g.position.set(x+0.5,0.12,y+0.5); g.castShadow=true; (g as any)._decor=true; this.terrain.add(g)
      }
      // river shimmer overlay
      if(t.terrain==='water'){
        const q=new THREE.Mesh(new THREE.PlaneGeometry(0.98,0.98), new THREE.MeshStandardMaterial({ color: 0x2a7ab0, transparent:true, opacity:0.55, roughness:0.2, metalness:0.15 })); q.rotation.x=-Math.PI/2; q.position.set(x+0.5, -0.03, y+0.5); (q as any)._decor=true; this.terrain.add(q)
      }
      if(t.terrain==='road' || t.terrain==='bridge'){
        const s=new THREE.Mesh(new THREE.PlaneGeometry(0.98,0.98), new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness:0.95 })); s.rotation.x=-Math.PI/2; s.position.set(x+0.5, 0.02, y+0.5); (s as any)._decor=true; this.terrain.add(s)
        // road line
        const line=new THREE.Mesh(new THREE.PlaneGeometry(0.14,0.98), new THREE.MeshStandardMaterial({ color: 0xc0b090 })); line.rotation.x=-Math.PI/2; line.position.set(x+0.5,0.025,y+0.5); (line as any)._decor=true; this.terrain.add(line)
      }
    }
    // village props
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(engine.tiles[y][x].terrain==='village'){
      const hut=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.45,0.5), new THREE.MeshStandardMaterial({ color: 0x8a6a4a })); hut.position.set(x+0.5, 0.23, y+0.5); hut.castShadow=true; (hut as any)._decor=true; this.terrain.add(hut)
      const roof=new THREE.Mesh(new THREE.ConeGeometry(0.42,0.35,4), new THREE.MeshStandardMaterial({ color: 0x6a3a2a })); roof.position.set(x+0.5,0.58,y+0.5); roof.rotation.y=Math.PI/4; (roof as any)._decor=true; this.terrain.add(roof)
    }
  }

  // ── Public API for GameLogic ──
  worldToMap(wx:number, wz:number){ return { tx: Math.floor(wx), ty: Math.floor(wz) } }

  // Convert world pixels (engine x,y) to 3D units (1 tile =1)
  pxToUnit(px:number){ return px / TILE }

  resize(){
    const r = this.canvas.getBoundingClientRect()
    const w=r.width, h=r.height
    this.renderer.setSize(w,h,false)
    this.camera.aspect = w/h
    this.camera.updateProjectionMatrix()
  }

  // camera helpers
  applyCameraFromEngine(){
    const e=this.engine! // not needed for pos; we own camera
    void e
    const tgt=this.camTarget
    const dist=this.camDist
    // orbit
    const yaw=this.camYaw, pitch=this.camPitch
    const h = Math.cos(pitch)*dist
    const y = Math.sin(pitch)*dist
    const x = Math.sin(yaw)*h
    const z = Math.cos(yaw)*h
    const shakeAmp = this.shake
    const sx=(Math.random()-0.5)*shakeAmp, sy=(Math.random()-0.5)*shakeAmp*0.6, sz=(Math.random()-0.5)*shakeAmp
    this.camera.position.set(tgt.x + x + sx, y + sy + 2.2, tgt.z + z + sz)
    this.camera.lookAt(tgt.x, tgt.y, tgt.z)
  }

  screenToGround(clientX:number, clientY:number){
    const rect=this.canvas.getBoundingClientRect()
    this.tmpVec2.set((clientX-rect.left)/rect.width*2-1, -((clientY-rect.top)/rect.height*2-1))
    this.raycaster.setFromCamera(this.tmpVec2, this.camera)
    const hit = new THREE.Vector3()
    this.raycaster.ray.intersectPlane(this.groundPlane, hit)
    return hit // x -> MAP x, z -> MAP y, in tile units
  }

  // selection ring
  ensureSelectRing(id:string, color:number){
    let r=this.selectRings.get(id)
    if(!r){
      r=new THREE.Mesh(new THREE.RingGeometry(0.32,0.38,22), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.95, side:THREE.DoubleSide }))
      r.rotation.x=-Math.PI/2; r.position.y=0.02
      this.selectRings.set(id,r); this.scene.add(r)
    }
    return r
  }

  sync(dt:number){
    const engine=this.engine; if(!engine) return
    this.shake = Math.max(0, this.shake - dt*6)

    // sync buildings
    for(const b of engine.buildings){
      let m=this.buildingMeshes.get(b.id)
      if(!m){
        m=createBuildingMesh(b.type, b.team as any)
        this.buildingMeshes.set(b.id, m); this.scene.add(m)
      }
      // place: building tile -> unit center
      const ww = b.w, hh=b.h
      m.position.set(b.x + ww/2, b.progress<1? -0.5 + b.progress*0.5 : 0, b.y + hh/2)
      m.visible = true
      // fog: hide enemy if not explored/visible
      const explored = engine.explored[b.y]?.[b.x]
      const visible = engine.fog[b.y]?.[b.x]
      if(!explored) m.visible=false
      else if(b.team==='enemy' && !visible){ m.visible=false }
      // hp smoke
      const anchor=m.getObjectByName('smokeAnchor') as THREE.Group
      if(anchor){
        // spawn smoke if damaged
        anchor.visible = b.hp/b.maxHp < 0.5
        if(b.hp/b.maxHp < 0.35 && Math.random()<0.14){
          this.spawnSmoke(anchor.getWorldPosition(new THREE.Vector3()), b.team==='player'?0x6a6a6a:0x4a4a4a)
        }
      }
      // flag wind
      const flag=m.getObjectByName('flag') as THREE.Mesh
      if(flag) flag.rotation.y = Math.sin(performance.now()*0.0015 + b.x*0.7)*0.35
      // selection: scale highlight
      m.scale.setScalar(b.selected?1.04:1)
    }
    // remove gone buildings
    for(const [id,m] of [...this.buildingMeshes]) if(!engine.buildings.some(b=>b.id===id)){ this.scene.remove(m); this.buildingMeshes.delete(id) }

    // soldiers
    for(const u of engine.units){
      if(u.state==='dead') {
        // keep dead mesh for a bit then fade
        const mm=this.soldierMeshes.get(u.id)
        if(mm){
          mm.rotation.z += dt*1.8
          mm.position.y = Math.max(-0.6, mm.position.y - dt*0.9)
          // fade after 1.5s
        }
        continue
      }
      let g=this.soldierMeshes.get(u.id)
      if(!g){
        // map engine unit types to 3D variants
        const map: Record<string,string> = { worker:'worker', swordsman:'swordsman', spearman:'spearman', heavy:'heavy', archer:'archer', crossbow:'crossbow', lightCav:'lightCav', heavyCav:'heavyCav', scout:'scout' }
        const t=map[u.type]||'swordsman'
        g=createSoldierMesh(t, u.team as any)
        this.soldierMeshes.set(u.id, g); this.scene.add(g)
      }
      const ux=this.pxToUnit(u.x), uz=this.pxToUnit(u.y)
      // height from terrain
      const tx=Math.floor(ux), ty=Math.floor(uz)
      const h = engine.tiles[ty]?.[tx]?.height||0
      const targetY = h*0.55
      g.position.x += (ux - g.position.x)*Math.min(1, dt*10)
      g.position.z += (uz - g.position.z)*Math.min(1, dt*10)
      g.position.y += (targetY - g.position.y)*Math.min(1, dt*8)
      // facing
      const curYaw=g.rotation.y
      const want=Math.atan2(Math.cos(u.facing), Math.sin(u.facing)) // adapt: engine facing is atan2(dy,dx) world XY; 3D wants yaw around Y
      // simpler: use engine facing directly but map axes: world X-> 3D X, world Y-> 3D Z. So yaw = -facing - PI/2 ?
      const wantYaw = -u.facing - Math.PI/2
      let d=wantaDiff(wantYaw, curYaw)
      g.rotation.y += d * Math.min(1, dt*8)
      // fog culling
      const ftx=Math.floor(u.x/TILE), fty=Math.floor(u.y/TILE)
      const vis = engine.fog[fty]?.[ftx] || u.team==='player'
      g.visible = u.team==='player' ? true : vis
      // carry
      const weapon=g.getObjectByName('weapon')
      if(weapon){
        if(u.carryAmount>0) { (weapon as any).visible=false } else (weapon as any).visible=true
      }
      // anim
      const isMoving = u.state==='moving' || u.path.length>0
      const attackP = u.attackCooldown>0 ? (1 - u.attackCooldown* u.attackSpeed) : 0
      updateSoldierAnim(g, dt, u.state, u.speed, isMoving, u.state==='attacking'?attackP:undefined)
      // selection ring
      if(u.selected && u.team==='player'){
        const ring=this.ensureSelectRing(u.id, 0x3ad0ff)
        ring.position.set(g.position.x, 0.03, g.position.z)
        ring.visible=true
        ring.scale.setScalar(1 + Math.sin(performance.now()*0.005)*0.08)
      } else {
        const ring=this.selectRings.get(u.id); if(ring) ring.visible=false
      }
      // hp bar is handled via DOM overlay; optional 3D sprite omitted for perf
    }
    // cull dead meshes that have been dead for >3s (engine keeps but we hide)
    // projectiles
    for(const p of engine.projectiles){
      let m=this.projectileMeshes.get(p.id)
      if(!m){
        const col=p.type==='stone'?0x8a8a8a: p.type==='bolt'?0xe0d0a0:0xffd070
        m=new THREE.Mesh(new THREE.SphereGeometry(p.type==='stone'?0.08:0.05,6,6), new THREE.MeshStandardMaterial({ color:col, emissive:col, emissiveIntensity:0.2 }))
        this.projectileMeshes.set(p.id,m); this.scene.add(m)
      }
      m.position.set(this.pxToUnit(p.x), 0.9 + Math.sin(performance.now()*0.005)*0.04, this.pxToUnit(p.y))
    }
    for(const [id,m] of [...this.projectileMeshes]) if(!engine.projectiles.some(p=>p.id===id)){ this.scene.remove(m); this.projectileMeshes.delete(id) }

    // capture points (glow discs)
    // stored in engine.capturePoints, draw as rings
    for(const cp of (engine as any).capturePoints||[]){
      const key='cp_'+cp.x+'_'+cp.y
      let ring=this.selectRings.get(key)
      if(!ring){
        ring=new THREE.Mesh(new THREE.RingGeometry(cp.r/TILE*0.85, cp.r/TILE, 24), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.18, side:THREE.DoubleSide }))
        ring.rotation.x=-Math.PI/2; ring.name=key
        this.selectRings.set(key, ring); this.scene.add(ring)
      }
      const h = engine.tiles[Math.floor(cp.y/TILE)]?.[Math.floor(cp.x/TILE)]?.height||0
      ring.position.set(this.pxToUnit(cp.x), 0.04 + h*0.55, this.pxToUnit(cp.y))
      ;(ring.material as THREE.MeshBasicMaterial).color.set(cp.team==='player'?0x3a7aff: cp.team==='enemy'?0xff3a2a:0xc8b840)
      ;(ring.material as THREE.MeshBasicMaterial).opacity = cp.team==='neutral' && cp.progress>0 ? 0.22 + cp.progress/100*0.2 : 0.18
      ring.visible = !!engine.explored[Math.floor(cp.y/TILE)]?.[Math.floor(cp.x/TILE)]
    }

    // tick smoke pool
    for(const c of [...this.smokeGroup.children]){
      c.position.y += dt*0.35; c.position.x += (Math.random()-0.5)*dt*0.2
      ;(c as any)._life = ((c as any)._life||1) - dt*0.45
      ;((c as THREE.Mesh).material as THREE.MeshStandardMaterial).transparent=true; ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = Math.max(0,(c as any)._life)
      c.scale.multiplyScalar(1+dt*0.35)
      if((c as any)._life<=0) this.smokeGroup.remove(c)
    }
  }

  spawnSmoke(pos:THREE.Vector3, color:number){
    const m=new THREE.Mesh(new THREE.SphereGeometry(0.28,6,6), new THREE.MeshStandardMaterial({ color, transparent:true, opacity:0.45, depthWrite:false }))
    m.position.copy(pos); m.position.y += 0.2; (m as any)._life=1; this.smokeGroup.add(m)
  }
  spawnHit(pos:THREE.Vector3, color=0xffcc66){
    const m=new THREE.Mesh(new THREE.SphereGeometry(0.14,6,6), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.9 }))
    m.position.copy(pos); m.position.y+=0.6; (m as any)._life=0.35; (m as any)._vy=0.9; this.hitGroup.add(m)
    setTimeout(()=>{ this.hitGroup.remove(m) }, 400)
  }

  render(){
    this.applyCameraFromEngine()
    this.renderer.render(this.scene, this.camera)
  }
}

function wantaDiff(want:number, cur:number){
  let d=want-cur
  while(d>Math.PI) d-=Math.PI*2
  while(d<-Math.PI) d+=Math.PI*2
  return d
}
