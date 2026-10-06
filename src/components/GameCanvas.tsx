import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { renderGame } from '../game/renderer'
import { audio } from '../game/audio'
import { TILE, WORLD_W, WORLD_H } from '../game/types'

export function GameCanvas(){
  const engine=useGame(s=>s.engine)
  const tick=useGame(s=>s.tick)
  const placingBuilding=useGame(s=>s.placingBuilding)
  const bump=useGame(s=>s.bump)
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const [drag, setDrag]=useState<{x:number;y:number; x2:number;y2:number; active:boolean}|null>(null)
  const [placePos, setPlacePos]=useState<{tx:number;ty:number}|null>(null)

  // game loop
  useEffect(()=>{
    let raf=0, last=performance.now()
    const loop=(now:number)=>{
      const dt=Math.min(0.05,(now-last)/1000); last=now
      engine.update(dt)
      bump()
      // victory/defeat audio once
      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    return ()=> cancelAnimationFrame(raf)
  },[])

  // render
  useEffect(()=>{
    const c=canvasRef.current; if(!c) return
    const ctx=c.getContext('2d'); if(!ctx) return
    // set size
    const rect=c.getBoundingClientRect()
    c.width=rect.width*devicePixelRatio
    c.height=rect.height*devicePixelRatio
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)
    // logical size for renderer: use CSS pixels
    const tmp={ width: rect.width, height: rect.height } as unknown as HTMLCanvasElement
    // hack: override for renderer
    Object.defineProperty(c,'width',{value:rect.width*devicePixelRatio, writable:true})
    Object.defineProperty(c,'height',{value:rect.height*devicePixelRatio, writable:true})
    // we need to set canvas logical via style; renderer uses canvas.width/height so use CSS size
    // Instead: create a wrapper that renderer reads correctly
    // Simpler: set canvas width/height to CSS pixels* dpr handled via ctx scale above.
    // Renderer expects canvas.width = pixel width; we already set. But we scaled ctx so renderer should use CSS size.
    // We'll patch renderer by temporarily setting canvas.width to CSS width for its vw/vh compute, then restore
    const savedW=c.width, savedH=c.height
    // @ts-ignore
    c.width=rect.width; c.height=rect.height
    renderGame(ctx as unknown as CanvasRenderingContext2D, engine, c)
    // @ts-ignore
    c.width=savedW; c.height=savedH
    // selection rect in screen space
    if(drag?.active){
      const sctx=c.getContext('2d')!
      sctx.save(); sctx.setTransform(1,0,0,1,0,0)
      // drag in CSS pixels -> need to map world drag to screen
      const cam=engine.camera
      const sx1=(drag.x - cam.x)*cam.zoom, sy1=(drag.y - cam.y)*cam.zoom
      const sx2=(drag.x2 - cam.x)*cam.zoom, sy2=(drag.y2 - cam.y)*cam.zoom
      const rx=Math.min(sx1,sx2), ry=Math.min(sy1,sy2), rw=Math.abs(sx2-sx1), rh=Math.abs(sy2-sy1)
      sctx.strokeStyle='#3ad0ff'; sctx.lineWidth=1.5; sctx.setLineDash([6,4])
      sctx.strokeRect(rx*devicePixelRatio, ry*devicePixelRatio, rw*devicePixelRatio, rh*devicePixelRatio)
      sctx.fillStyle='rgba(60,208,255,0.12)'; sctx.fillRect(rx*devicePixelRatio, ry*devicePixelRatio, rw*devicePixelRatio, rh*devicePixelRatio)
      sctx.restore()
    }
    // placement ghost in screen
    if(placingBuilding && placePos){
      const sctx=c.getContext('2d')!
      sctx.save(); sctx.setTransform(1,0,0,1,0,0)
      const cam=engine.camera
      const sx=(placePos.tx*TILE - cam.x)*cam.zoom, sy=(placePos.ty*TILE - cam.y)*cam.zoom
      sctx.fillStyle='rgba(60,208,255,0.35)'; sctx.fillRect(sx*devicePixelRatio, sy*devicePixelRatio, TILE*devicePixelRatio, TILE*devicePixelRatio)
      sctx.strokeStyle='#3ad0ff'; sctx.strokeRect(sx*devicePixelRatio, sy*devicePixelRatio, TILE*devicePixelRatio, TILE*devicePixelRatio)
      sctx.restore()
    }
  })

  // ensure canvas resizes
  useEffect(()=>{
    const onResize=()=> bump()
    window.addEventListener('resize',onResize)
    return ()=> window.removeEventListener('resize',onResize)
  },[])

  function worldFromEvent(e:React.MouseEvent){
    const rect=(e.currentTarget as HTMLCanvasElement).getBoundingClientRect()
    const cam=engine.camera
    const x= cam.x + (e.clientX-rect.left)/cam.zoom
    const y= cam.y + (e.clientY-rect.top)/cam.zoom
    return {x,y}
  }

  const handleMouseDown=(e:React.MouseEvent)=>{
    const {x,y}=worldFromEvent(e)
    if(e.button===1 || e.button===2){
      // right/middle will be handled on up
      return
    }
    if(placingBuilding){
      // place
      const tx=(x/TILE)|0, ty=(y/TILE)|0
      // @ts-ignore
      engine.tryBuild(placingBuilding as unknown as string, tx,ty)
      audio.build()
      useGame.setState({ placingBuilding:null })
      return
    }
    // left drag start
    setDrag({x,y,x2:x,y2:y, active:true})
  }
  const handleMouseMove=(e:React.MouseEvent)=>{
    const {x,y}=worldFromEvent(e)
    if(placingBuilding){
      setPlacePos({tx:(x/TILE)|0, ty:(y/TILE)|0})
    }
    if(drag?.active){
      setDrag({...drag, x2:x,y2:y})
    }
    // edge scroll handled separately; also middle drag pan
    if(e.buttons===4){
      engine.pan(-e.movementX/engine.camera.zoom, -e.movementY/engine.camera.zoom)
    }
  }
  const handleMouseUp=(e:React.MouseEvent)=>{
    const {x,y}=worldFromEvent(e)
    if(e.button===2){
      // right click: move or attack
      // check if over enemy
      const enemy=engine.units.find(u=>u.team==='enemy'&&u.state!=='dead'&&Math.hypot(u.x-x,u.y-y)<18)
      const enemyB=engine.buildings.find(b=>b.team==='enemy'&& x>=b.x*TILE&&x<=b.x*TILE+b.w*TILE&& y>=b.y*TILE&&y<=b.y*TILE+b.h*TILE)
      if(enemy){ engine.issueAttack(enemy.id); audio.attack() }
      else if(enemyB){ // attack building via nearest unit
        const sel=engine.units.filter(u=>engine.selectedIds.has(u.id))
        for(const u of sel) { u.targetId=enemyB.id; /* attackBuilding will pick */ }
        // set direct path to building
        engine.issueMove(enemyB.x*TILE+enemyB.w*TILE/2, enemyB.y*TILE+enemyB.h*TILE/2, false)
        engine.units.filter(u=>engine.selectedIds.has(u.id)).forEach(u=>u.targetId=enemyB.id)
        audio.attack()
      }
      else {
        const attackMove=e.shiftKey
        engine.issueMove(x,y,attackMove); audio.move()
      }
      return
    }
    if(drag?.active){
      const dx=Math.abs(drag.x2-drag.x), dy=Math.abs(drag.y2-drag.y)
      if(dx<8 && dy<8){
        // click select
        engine.selectAt(x,y, e.shiftKey||e.ctrlKey)
        audio.select()
      } else {
        engine.selectRect(drag.x,drag.y,drag.x2,drag.y2, e.shiftKey||e.ctrlKey)
        audio.select()
      }
      setDrag(null)
    }
  }
  const handleWheel=(e:React.WheelEvent)=>{
    const rect=(e.currentTarget as HTMLCanvasElement).getBoundingClientRect()
    const mx=e.clientX-rect.left, my=e.clientY-rect.top
    engine.zoomAt(e.deltaY>0?-0.12:0.12, mx,my)
  }
  const handleDoubleClick=(e:React.MouseEvent)=>{
    const {x,y}=worldFromEvent(e)
    engine.doubleClickSelect(x,y)
    audio.select()
  }
  const handleContextMenu=(e:React.MouseEvent)=> e.preventDefault()

  // keyboard
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      const k=e.key.toLowerCase()
      if(k==='a'){ engine.setOrder('attack'); engine.issueMove(engine.camera.x+640, engine.camera.y+400,true) }
      else if(k==='s'){ engine.issueStop() }
      else if(k==='h'){ engine.issueHold() }
      else if(k==='g'){ engine.setOrder('guard')}
      else if(k==='r'){ engine.issueRetreat()}
      else if(k==='f'){ const f:Record<string,string>={line:'column',column:'wedge',wedge:'box',box:'circle',circle:'line'}; const cur=engine.formation; const nxt=(f[cur]||'line') as unknown as string; engine.setFormation(nxt as unknown as typeof engine.formation)}
      else if(k==='escape'){ if(placingBuilding) useGame.setState({placingBuilding:null}); else { engine.selectedIds.clear(); engine.units.forEach(u=>u.selected=false); useGame.setState({}) } }
      else if(k>='1'&&k<='9'){
        if(e.ctrlKey) engine.createGroup(Number(k))
        else engine.selectGroup(Number(k))
      }
      else if(k==='b'){ useGame.setState({showBuild: 'barracks' as unknown as string} as unknown as Record<string,unknown>)}
      // camera WASD
      if(['w','a','s','d'].includes(k)){
        const spd=32/engine.camera.zoom
        if(k==='w') engine.pan(0,-spd)
        if(k==='s') engine.pan(0,spd)
        if(k==='a') engine.pan(-spd,0)
        if(k==='d') engine.pan(spd,0)
      }
      if(k===' '){ engine.paused=!engine.paused }
    }
    window.addEventListener('keydown',h)
    return ()=> window.removeEventListener('keydown',h)
  },[placingBuilding])

  // edge scroll
  useEffect(()=>{
    let raf=0
    const loop=()=>{
      if(!drag?.active){
        // check mouse pos via last known? simple: not needed always
      }
      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    return ()=> cancelAnimationFrame(raf)
  },[drag])

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{width:'100%',height:'100%',display:'block',cursor: placingBuilding?'crosshair':'default'}}
    />
  )
}
