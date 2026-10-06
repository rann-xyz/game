import { useGame } from '../game/store'
import { MAP_W, MAP_H, TILE, WORLD_W, WORLD_H } from '../game/types'
import { useRef, useEffect } from 'react'

export function Minimap(){
  const engine=useGame(s=>s.engine)
  const tick=useGame(s=>s.tick); void tick
  const ref=useRef<HTMLCanvasElement>(null)
  useEffect(()=>{
    const c=ref.current; if(!c) return
    const ctx=c.getContext('2d'); if(!ctx) return
    const W=c.width, H=c.height
    const sx=W/MAP_W, sy=H/MAP_H
    ctx.clearRect(0,0,W,H)
    for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++){
      const t=engine.tiles[y][x]
      const explored=engine.explored[y][x]
      if(!explored){ ctx.fillStyle='#0a0a0a'; ctx.fillRect(x*sx,y*sy,sx,sy); continue }
      const vis=engine.fog[y][x]
      let col='#4a7c3f'
      if(t.terrain==='water') col='#2a5a8a'
      else if(t.terrain==='mountain') col='#5a5a5a'
      else if(t.terrain==='forest') col='#2d5a27'
      else if(t.terrain==='hill') col='#6b7a5a'
      else if(t.terrain==='road'||t.terrain==='bridge') col='#7a6a4a'
      if(!vis) col=shade(col,0.45)
      ctx.fillStyle=col; ctx.fillRect(x*sx,y*sy,sx,sy)
    }
    // buildings
    for(const b of engine.buildings){
      if(!engine.explored[b.y]?.[b.x]) continue
      const vis=engine.fog[b.y]?.[b.x]
      if(b.team==='enemy' && !vis) continue
      ctx.fillStyle= b.team==='player'?'#3a8aef':'#e03020'
      ctx.fillRect(b.x*sx, b.y*sy, Math.max(2,b.w*sx), Math.max(2,b.h*sy))
    }
    // units
    for(const u of engine.units){
      if(u.state==='dead') continue
      if(u.team==='enemy'){
        const tx=(u.x/TILE)|0, ty=(u.y/TILE)|0
        if(!engine.fog[ty]?.[tx]) continue
      }
      ctx.fillStyle= u.team==='player'? (u.selected?'#7ad0ff':'#2a7ae0') : '#ff3a2a'
      const px=(u.x/WORLD_W)*W, py=(u.y/WORLD_H)*H
      ctx.beginPath(); ctx.arc(px,py, u.team==='player'?2.2:1.8,0,Math.PI*2); ctx.fill()
    }
    // capture points
    for(const cp of (engine as unknown as {capturePoints:{x:number;y:number;team:string}[]}).capturePoints||[]){
      const px=(cp.x/WORLD_W)*W, py=(cp.y/WORLD_H)*H
      ctx.fillStyle= cp.team==='player'? '#5aa0ff' : cp.team==='enemy'? '#ff3a2a':'#c0b040'
      ctx.beginPath(); ctx.arc(px,py,3.5,0,Math.PI*2); ctx.fill()
      ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(px,py,6,0,Math.PI*2); ctx.stroke()
    }
    // camera rect
    const cam=engine.camera
    const rx=(cam.x/WORLD_W)*W, ry=(cam.y/WORLD_H)*H, rw=( (W / cam.zoom)/ (WORLD_W) *W) , rh=( (H/ cam.zoom)/ (WORLD_H)*H)
    // Actually vw = canvas CSS width / zoom. For minimap we want world viewport; approximate with 800x600 viewport
    const vw= (1280/ cam.zoom)/WORLD_W *W, vh=(800/ cam.zoom)/WORLD_H *H
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=1; ctx.strokeRect(rx,ry,vw,vh)
  })
  const onClick=(e:React.MouseEvent)=>{
    const rect=(e.currentTarget as HTMLCanvasElement).getBoundingClientRect()
    const x=(e.clientX-rect.left)/rect.width
    const y=(e.clientY-rect.top)/rect.height
    engine.focusOn(x*WORLD_W, y*WORLD_H)
  }
  return <canvas ref={ref} width={180} height={135} onClick={onClick} style={{width:180,height:135, border:'1px solid #333', cursor:'crosshair', background:'#0a0a0a'}} />
}

function shade(hex:string, f:number){
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16)
  return `rgb(${r*f|0},${g*f|0},${b*f|0})`
}
