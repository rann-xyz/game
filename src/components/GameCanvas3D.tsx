import * as THREE from 'three'
import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { audio } from '../game/audio'
import '../design/luxe.css'
import { ThreeWorld } from '../three/world3d'
import { TILE, MAP_W, MAP_H } from '../game/types'
import { HeroRig } from '../three/hero'
import { FX } from '../three/fx'

export function GameCanvas3D(){
  const engine=useGame(s=>s.engine)
  const placingBuilding=useGame(s=>s.placingBuilding)
  const bump=useGame(s=>s.bump)
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const worldRef=useRef<ThreeWorld|null>(null)
  const heroMode=useGame(s=>s.heroMode)
  const heroFps=useGame(s=>s.heroFps)
  const [skillCd, setSkillCd]=useState<{slash:number;kaboom:number;rally:number}>({slash:0,kaboom:0,rally:0})
  const [drag, setDrag]=useState<{active:boolean; x:number;y:number; x2:number;y2:number}|null>(null)
  const dragRef=useRef<{active:boolean; x:number;y:number; x2:number;y2:number}|null>(null)
  const placeRef=useRef<{tx:number;ty:number}|null>(null)
  const heroRef=useRef<HeroRig|null>(null)
  const fxRef=useRef<FX|null>(null)
  const keysRef=useRef<Set<string>>(new Set())
  const mouseDXRef=useRef(0)
  const mouseDYRef=useRef(0)
  const pointerLockedRef=useRef(false)

  // init 3D world once
  useEffect(()=>{
    const c=canvasRef.current; if(!c) return
    const world=new ThreeWorld(c)
    world.attachEngine(engine)
    worldRef.current=world
    const fx=new FX(world.scene); fxRef.current=fx
    const hero=new HeroRig(world.scene); heroRef.current=hero; hero.bind(engine)
    // wire FX events from engine hero skills -> pretty slash/kaboom
    const onSlash=(e:any)=>{ const p=e.detail; const pos=new THREE.Vector3(p.x/TILE, .6, p.y/TILE); const dir=new THREE.Vector3(Math.cos(p.facing),0,Math.sin(p.facing)); fx.slash(pos, dir, 0xff4a8a); fx.hitRing(pos, 0xffcc66) }
    const onKaboom=(e:any)=>{ const p=e.detail; const pos=new THREE.Vector3(p.x/TILE,.4,p.y/TILE); fx.kaboom(pos, 2.6) }
    const onKaboomShake=()=>{ world.shake=7 }
    document.addEventListener('hero-slash', onSlash as any)
    document.addEventListener('hero-kaboom', onKaboom as any)
    document.addEventListener('kaboom', onKaboomShake as any)
    // rebind hero on seed change will be handled by rebuild effect
    const ro=new ResizeObserver(()=>{ world.resize() })
    ro.observe(c)
    world.resize()
    // wrap applyDamage for combat FX
    const origApply = engine.applyDamage.bind(engine)
    engine.applyDamage = (target:any, dmg:any, attacker:any)=>{
      const hp0=target.hp
      const res=origApply(target,dmg,attacker)
      const fx=fxRef.current; if(!fx) return res
      const pos=new THREE.Vector3(target.x/TILE, .7, target.y/TILE)
      fx.damageNumber(pos, dmg)
      if(dmg>22) fx.hitRing(new THREE.Vector3(target.x/TILE,.08,target.y/TILE), 0xff6a3a)
      void hp0
      return res
    }
    return ()=>{ ro.disconnect(); world.renderer.dispose(); engine.applyDamage=origApply as any; document.removeEventListener('hero-slash', (()=>{}) as any); document.removeEventListener('hero-kaboom', (()=>{}) as any) }
  },[])

  // rebuild when mission restarts (when engine seed changes)
  useEffect(()=>{
    if(!worldRef.current) return
    worldRef.current.attachEngine(engine)
    worldRef.current.rebuildFromTiles()
    heroRef.current?.bind(engine)
  }, [engine.seed])

  // game loop + sync + render
  useEffect(()=>{
    let raf=0, last=performance.now()
    const loop=(now:number)=>{
      const dt=Math.min(0.05,(now-last)/1000); last=now
      // hero intent when heroMode & pointer lock or joystick
      if(useGame.getState().heroMode){
        const hero=heroRef.current; const world=worldRef.current as any
        if(hero && world){
          hero.intent(engine, keysRef.current, mouseDXRef.current, mouseDYRef.current, dt)
          mouseDXRef.current*=0.92; mouseDYRef.current*=0.92
          // tether camera to hero
          const h=hero.getHero(engine)
          if(h){
            const tx=h.x/TILE, tz=h.y/TILE
            if(hero.third){
              // third-person chase behind hero
              hero.pitch = hero.pitch // keep
              const yaw=hero.yaw
              const dist=hero.camDist
              const behindX=tx - Math.cos(yaw)*dist*0.55
              const behindZ=tz - Math.sin(yaw)*dist*0.55
              world.camTarget.x += (behindX - world.camTarget.x)*Math.min(1,dt*4.5)
              world.camTarget.z += (behindZ - world.camTarget.z)*Math.min(1,dt*4.5)
              world.camYaw = yaw + Math.PI // look toward hero? instead orbit behind
              world.camPitch = 0.52
              world.camDist = hero.third? (heroFps? 3.5 : 11) : 9
              if(heroFps){ world.camTarget.set(tx, 1.05, tz); world.camYaw=yaw; world.camPitch=hero.pitch }
            }
          }
        }
        // tick skill cds
        setSkillCd(s=>({ slash: Math.max(0,s.slash-dt), kaboom: Math.max(0,s.kaboom-dt), rally: Math.max(0,s.rally-dt)}))
      }
      engine.update(dt)
      const world=worldRef.current
      if(world){
        // hit FX on applyDamage: monkey-patch once per frame? Instead sample hp drops
        ;(engine as any)._fxHook = fxRef.current
        world.sync(dt)
        world.render()
      }
      bump()
      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    return ()=> cancelAnimationFrame(raf)
  },[])

  function groundFromClient(clientX:number, clientY:number){
    const world=worldRef.current!; if(!world) return null
    const hit=world.screenToGround(clientX, clientY)
    // hit is in tile units; convert to world pixels for engine
    return { x: hit.x*TILE, y: hit.z*TILE, tx: Math.floor(hit.x), ty: Math.floor(hit.z) }
  }

  const handleMouseDown=(e:React.MouseEvent)=>{
    if(e.button===1 || e.button===2) return // handled on up
    const hit=groundFromClient(e.clientX,e.clientY)
    if(!hit) return
    if(placingBuilding){
      engine.tryBuild(placingBuilding as any, hit.tx, hit.ty)
      audio.build()
      useGame.setState({ placingBuilding:null })
      return
    }
    const d={active:true, x: hit.x, y: hit.y, x2: hit.x, y2: hit.y}
    dragRef.current=d; setDrag(d as any)
  }
  const handleMouseMove=(e:React.MouseEvent)=>{
    if(useGame.getState().heroMode && document.pointerLockElement){
      mouseDXRef.current += e.movementX; mouseDYRef.current += e.movementY
      return
    }
    const hit=groundFromClient(e.clientX,e.clientY)
    if(hit && placingBuilding){ placeRef.current={tx:hit.tx, ty:hit.ty} }
    if(dragRef.current?.active && hit){
      dragRef.current={...dragRef.current, x2: hit.x, y2: hit.y}
      setDrag({...dragRef.current})
    }
    if(e.buttons===4){
      // middle pan -> orbit target
      const world=worldRef.current!
      const dx=e.movementX * 0.02, dy=e.movementY * 0.02
      world.camTarget.x -= dx * (world.camDist*0.04)
      world.camTarget.z -= dy * (world.camDist*0.04)
      clampCamTarget(world)
    }
  }
  const handleMouseUp=(e:React.MouseEvent)=>{
    const hit=groundFromClient(e.clientX,e.clientY)
    if(e.button===2){
      if(!hit) return
      // right click: move or attack - use 3D hit point
      const worldHit={x:hit.x, y:hit.y}
      // check enemy near hit (in world pixels)
      const enemy=engine.units.find(u=>u.team==='enemy'&&u.state!=='dead'&&Math.hypot(u.x-worldHit.x,u.y-worldHit.y)< 28)
      const enemyB=engine.buildings.find(b=>b.team==='enemy'&& worldHit.x>=b.x*TILE&&worldHit.x<=b.x*TILE+b.w*TILE&& worldHit.y>=b.y*TILE&&worldHit.y<=b.y*TILE+b.h*TILE)
      if(enemy){ engine.issueAttack(enemy.id); audio.attack(); worldRef.current!.shake=0.45 }
      else if(enemyB){
        engine.issueMove(enemyB.x*TILE+enemyB.w*TILE/2, enemyB.y*TILE+enemyB.h*TILE/2, false)
        engine.units.filter(u=>engine.selectedIds.has(u.id)).forEach(u=>u.targetId=enemyB.id)
        audio.attack()
      } else {
        engine.issueMove(worldHit.x, worldHit.y, e.shiftKey); audio.move()
        // move marker
        if(worldRef.current) spawnMoveMarker(worldHit.x, worldHit.y)
      }
      return
    }
    const d=dragRef.current
    if(d?.active){
      const dx=Math.abs(d.x2-d.x), dy=Math.abs(d.y2-d.y)
      if(Math.hypot(dx,dy)< 18){
        engine.selectAt(d.x, d.y, e.shiftKey||e.ctrlKey); audio.select()
      } else {
        const minX=Math.min(d.x,d.x2), maxX=Math.max(d.x,d.x2), minY=Math.min(d.y,d.y2), maxY=Math.max(d.y,d.y2)
        engine.selectRect(minX,minY,maxX,maxY, e.shiftKey||e.ctrlKey); audio.select()
      }
      dragRef.current=null; setDrag(null)
    }
  }
  const handleWheel=(e:React.WheelEvent)=>{
    const world=worldRef.current!; if(!world) return
    // zoom = change camDist
    const delta=e.deltaY>0? 1.12 : 0.92
    world.camDist=Math.max(10, Math.min(62, world.camDist*delta))
  }
  const handleContextMenu=(e:React.MouseEvent)=> e.preventDefault()
  const handleDoubleClick=(e:React.MouseEvent)=>{
    const hit=groundFromClient(e.clientX,e.clientY); if(!hit) return
    engine.doubleClickSelect(hit.x, hit.y); audio.select()
  }

  // touch
  const handleTouchStart=(e:React.TouchEvent)=>{
    if(e.touches.length===1){
      const t=e.touches[0]; const hit=groundFromClient(t.clientX,t.clientY); if(!hit) return
      if(placingBuilding){ engine.tryBuild(placingBuilding as any, hit.tx, hit.ty); audio.build(); useGame.setState({placingBuilding:null}); return }
      const d={active:true, x:hit.x,y:hit.y,x2:hit.x,y2:hit.y}; dragRef.current=d; setDrag(d as any)
    }
  }
  const handleTouchMove=(e:React.TouchEvent)=>{
    if(e.touches.length===1 && dragRef.current?.active){
      const t=e.touches[0]; const hit=groundFromClient(t.clientX,t.clientY); if(!hit) return
      dragRef.current={...dragRef.current, x2:hit.x, y2:hit.y}; setDrag({...dragRef.current})
    } else if(e.touches.length===2){
      const world=worldRef.current!; if(!world) return
      // pinch zoom
      const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY
      const d=Math.hypot(dx,dy)
      ;(world as any)._lastPinch = (world as any)._lastPinch || d
      const ratio=d/(world as any)._lastPinch
      world.camDist=Math.max(10,Math.min(62, world.camDist/ratio))
      ;(world as any)._lastPinch=d
      // two-finger pan
      const mx=(e.touches[0].clientX+e.touches[1].clientX)/2, my=(e.touches[0].clientY+e.touches[1].clientY)/2
      const last=(world as any)._lastMid || {x:mx,y:my}
      world.camTarget.x -= (mx-last.x)*0.02*(world.camDist*0.04)
      world.camTarget.z -= (my-last.y)*0.02*(world.camDist*0.04)
      clampCamTarget(world)
      ;(world as any)._lastMid={x:mx,y:my}
    }
  }
  const handleTouchEnd=(e:React.TouchEvent)=>{
    if(e.touches.length===0 && dragRef.current?.active){
      const d=dragRef.current
      const dx=Math.abs(d.x2-d.x), dy=Math.abs(d.y2-d.y)
      if(Math.hypot(dx,dy)<18) engine.selectAt(d.x,d.y,false)
      else engine.selectRect(Math.min(d.x,d.x2), Math.min(d.y,d.y2), Math.max(d.x,d.x2), Math.max(d.y,d.y2), false)
      dragRef.current=null; setDrag(null)
    }
    if(e.touches.length<2){ const w=worldRef.current as any; if(w){ w._lastPinch=null; w._lastMid=null } }
  }

  // keyboard + hero keys tracking
  useEffect(()=>{
    const onKeyDown=(ev:KeyboardEvent)=>{ keysRef.current.add(ev.key.toLowerCase()) }
    const onKeyUp=(ev:KeyboardEvent)=>{ keysRef.current.delete(ev.key.toLowerCase()) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    const h=(ev:KeyboardEvent)=>{
      const world=worldRef.current; if(!world) return
      const k=ev.key.toLowerCase()
      if(k==='a'){ engine.setOrder('attack'); const cx=world.camTarget.x*TILE, cy=world.camTarget.z*TILE; engine.issueMove(cx+120, cy, true) }
      else if(k==='s'){ engine.issueStop() }
      else if(k==='h'){ engine.issueHold() }
      else if(k==='g'){ engine.setOrder('guard')}
      else if(k==='r'){ engine.issueRetreat()}
      else if(k==='f'){ const nxt:Record<string,string>={line:'column',column:'wedge',wedge:'box',box:'circle',circle:'line'}; engine.setFormation((nxt[engine.formation]||'line') as any)}
      else if(k==='escape'){ if(placingBuilding) useGame.setState({placingBuilding:null}); else { engine.selectedIds.clear(); engine.units.forEach(u=>u.selected=false) } }
      else if(k>='1'&&k<='9'){ if(ev.ctrlKey) engine.createGroup(Number(k)); else engine.selectGroup(Number(k)) }
      else if(k==='q'){ world.camYaw -= 0.18 }
      else if(k==='e'){ world.camYaw += 0.18 }
      if(['w','a','s','d'].includes(k)){
        const spd=0.55
        if(k==='w') world.camTarget.z -= spd
        if(k==='s') world.camTarget.z += spd
        if(k==='a') world.camTarget.x -= spd
        if(k==='d') world.camTarget.x += spd
        clampCamTarget(world)
      }
      if(k===' ') engine.paused=!engine.paused
    }
    const onJoy=(e:any)=>{ const {dx,dy}=e.detail; const set=keysRef.current; set.clear(); if(dy<-0.2) set.add('w'); if(dy>0.2) set.add('s'); if(dx<-0.2) set.add('a'); if(dx>0.2) set.add('d'); // diagonal via both
    }
    document.addEventListener('hero-joy', onJoy as any)
    window.addEventListener('keydown',h)
    return ()=>{ window.removeEventListener('keydown',h); document.removeEventListener('hero-joy', onJoy as any) }
  },[placingBuilding])

  // move marker (simple expanding ring in 3D via smoke group)
  function spawnMoveMarker(x:number,y:number){
    const world=worldRef.current; if(!world) return
    // expanding ring at move target
    // reuse select ring id
    const id='move_'+Date.now()
    const ring=world.ensureSelectRing(id, 0x7ae0ff)
    ring.position.set(x/TILE, 0.04, y/TILE)
    ring.visible=true
    ring.scale.setScalar(0.4)
    let s=0.4
    const iv=setInterval(()=>{ s+=0.06; ring.scale.setScalar(s); (ring.material as any).opacity= Math.max(0,0.9 - s*0.6); if(s>1.8){ clearInterval(iv); world.scene.remove(ring); world.selectRings.delete(id) } }, 16)
  }

  // Drag rectangle in screen space (project world drag corners to screen)
  

  // Instead render drag as world-space quad (plane) — add a mesh
  useEffect(()=>{
    const world=worldRef.current; if(!world) return
    if(!drag?.active){ // remove drag quad
      const old=world.scene.getObjectByName('dragQuad') as any
      if(old) world.scene.remove(old)
      return
    }
    let quad=world.scene.getObjectByName('dragQuad') as THREE.Mesh
    if(!quad){
      const geom=new THREE.PlaneGeometry(1,1)
      const material=new THREE.MeshBasicMaterial({ color:0x3ad0ff, transparent:true, opacity:0.12, side:THREE.DoubleSide, depthWrite:false })
      const wire=new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color:0x3ad0ff }))
      const mesh=new THREE.Mesh(geom, material); mesh.add(wire); mesh.rotation.x=-Math.PI/2; mesh.name='dragQuad'
      world.scene.add(mesh); quad=mesh
    }
    const minX=Math.min(drag.x,drag.x2)/TILE, maxX=Math.max(drag.x,drag.x2)/TILE
    const minZ=Math.min(drag.y,drag.y2)/TILE, maxZ=Math.max(drag.y,drag.y2)/TILE
    const cx=(minX+maxX)/2, cz=(minZ+maxZ)/2
    quad.position.set(cx, 0.06, cz)
    quad.scale.set(Math.max(0.2,maxX-minX), 1, Math.max(0.2,maxZ-minZ))
  }, [drag])

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{width:'100%',height:'100%',display:'block',touchAction:'none',cursor: placingBuilding?'crosshair':'default'}}
    />
  )
}

function clampCamTarget(world:any){
  world.camTarget.x=Math.max(6, Math.min(MAP_W-6, world.camTarget.x))
  world.camTarget.z=Math.max(6, Math.min(MAP_H-6, world.camTarget.z))
}
