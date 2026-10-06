// ── Canvas Renderer ──
import type { GameEngine } from './engine'
import { TILE, MAP_W, MAP_H, WORLD_W, WORLD_H } from './types'
import type { Unit, Building, Tile } from './types'

const COLORS: Record<string,string> = {
  plains:'#4a7c3f', forest:'#2d5a27', hill:'#6b7a5a', mountain:'#5a5a5a', water:'#2a5a8a', bridge:'#8a7a5a', road:'#7a6a4a', village:'#8a7a4a', ruins:'#6a6a6a',
}

function terrainColor(t:Tile){
  if(t.resource==='gold') return '#8a7a2a'
  if(t.resource==='stone') return '#6a6a6a'
  if(t.resource==='food') return '#5a8a3a'
  if(t.resource==='wood' && t.terrain==='forest') return '#1e4a18'
  return COLORS[t.terrain]||'#4a7c3f'
}

export function renderGame(ctx:CanvasRenderingContext2D, engine:GameEngine, canvas:HTMLCanvasElement){
  const cam=engine.camera
  const W=canvas.width, H=canvas.height
  ctx.save()
  ctx.scale(cam.zoom, cam.zoom)
  // shake
  if(cam.shake>0) ctx.translate((Math.random()-0.5)*cam.shake, (Math.random()-0.5)*cam.shake)
  const vx=cam.x, vy=cam.y
  const vw=W/cam.zoom, vh=H/cam.zoom
  // clear with dark
  ctx.fillStyle='#0f1a0f'
  ctx.fillRect(vx,vy,vw,vh)

  // tiles
  const x0=Math.max(0, (vx/TILE)|0), x1=Math.min(MAP_W-1, ((vx+vw)/TILE)|0+1)
  const y0=Math.max(0, (vy/TILE)|0), y1=Math.min(MAP_H-1, ((vy+vh)/TILE)|0+1)
  for(let ty=y0;ty<=y1;ty++) for(let tx=x0;tx<=x1;tx++){
    const t=engine.tiles[ty][tx]
    const explored=engine.explored[ty][tx]
    const visible=engine.fog[ty][tx]
    const x=tx*TILE, y=ty*TILE
    if(!explored){ ctx.fillStyle='#0a0a0a'; ctx.fillRect(x,y,TILE,TILE); continue }
    ctx.fillStyle= terrainColor(t)
    ctx.fillRect(x,y,TILE,TILE)
    if(!visible){ ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(x,y,TILE,TILE); continue }
    // height shading
    if(t.height>0){ ctx.fillStyle=`rgba(0,0,0,${0.08*t.height})`; ctx.fillRect(x,y,TILE,TILE)}
    // forest canopy
    if(t.terrain==='forest'){
      ctx.fillStyle='rgba(20,60,20,0.35)'; ctx.beginPath(); ctx.ellipse(x+TILE/2,y+TILE/2, TILE*0.42, TILE*0.36,0,0,Math.PI*2); ctx.fill()
      // trunks dots
      ctx.fillStyle='#2a1a0a'; ctx.fillRect(x+TILE/2-1,y+TILE/2-2,2,6)
    }
    if(t.terrain==='hill'){
      ctx.strokeStyle='rgba(90,80,50,0.4)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x+4,y+TILE-6); ctx.lineTo(x+TILE/2,y+6); ctx.lineTo(x+TILE-4,y+TILE-6); ctx.stroke()
    }
    if(t.terrain==='mountain'){
      ctx.fillStyle='#4a4a4a'; ctx.beginPath(); ctx.moveTo(x,y+TILE); ctx.lineTo(x+TILE/2,y+4); ctx.lineTo(x+TILE,y+TILE); ctx.fill()
      ctx.fillStyle='#e8e8e8'; ctx.beginPath(); ctx.moveTo(x+TILE/2,y+4); ctx.lineTo(x+TILE/2+6,y+14); ctx.lineTo(x+TILE/2-2,y+14); ctx.fill()
    }
    if(t.terrain==='water'){
      ctx.fillStyle=`rgba(40,90,140,${0.85 + Math.sin(engine.time*2 + tx*0.7)*0.08})`; ctx.fillRect(x,y,TILE,TILE)
      // wave lines
      ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1; ctx.beginPath(); const off=Math.sin(engine.time*1.5+ty)*4; ctx.moveTo(x+2+off,y+TILE/2); ctx.lineTo(x+TILE-2+off,y+TILE/2); ctx.stroke()
    }
    if(t.terrain==='road'||t.terrain==='bridge'){
      ctx.fillStyle= t.terrain==='bridge'? '#8a7a5a':'#6a5a3a'; ctx.fillRect(x,y,TILE,TILE)
      ctx.fillStyle='rgba(200,180,120,0.9)'; ctx.fillRect(x+TILE/2-1,y,2,TILE)
      if(t.terrain==='bridge'){ ctx.strokeStyle='#4a3a2a'; ctx.lineWidth=2; ctx.strokeRect(x+1,y+1,TILE-2,TILE-2)}
    }
    if(t.terrain==='village'){
      ctx.fillStyle='#7a5a3a'; ctx.fillRect(x+8,y+8,TILE-16,TILE-16); ctx.fillStyle='#8a6a4a'; ctx.fillRect(x+TILE/2-6,y+4,12,8)
    }
    if(t.resource){
      const cx=x+TILE/2, cy=y+TILE/2
      if(t.resource==='wood'){ ctx.fillStyle='#2a5a1a'; ctx.beginPath(); ctx.arc(cx,cy-6,7,0,Math.PI*2); ctx.fill()}
      else if(t.resource==='gold'){ ctx.fillStyle='#c8a820'; ctx.beginPath(); ctx.arc(cx,cy,6,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#ffe55a'; ctx.beginPath(); ctx.arc(cx-2,cy-2,2,0,Math.PI*2); ctx.fill()}
      else if(t.resource==='stone'){ ctx.fillStyle='#7a7a7a'; ctx.beginPath(); ctx.arc(cx,cy,6,0,Math.PI*2); ctx.fill()}
      else if(t.resource==='food'){ ctx.fillStyle='#6a8a2a'; ctx.fillRect(cx-7,cy-4,14,8)}
      // amount bar tiny
      const pct=Math.min(1,(t.resourceAmount||0)/1000)
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(x+4,y+TILE-4,TILE-8,3)
      ctx.fillStyle= t.resource==='gold'?'#ffd700': t.resource==='wood'?'#4a8a2a': t.resource==='stone'?'#aaa':'#7aca3a'
      ctx.fillRect(x+4,y+TILE-4,(TILE-8)*pct,3)
    }
    ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.lineWidth=0.5; ctx.strokeRect(x,y,TILE,TILE)
  }

  // capture points
  for(const cp of (engine as unknown as {capturePoints:{x:number;y:number;r:number;team:string;progress:number}[]}).capturePoints||[]){
    const vis = engine.explored[(cp.y/TILE)|0]?.[(cp.x/TILE)|0]
    if(!vis) continue
    const teamCol = cp.team==='player'? 'rgba(60,160,255,0.22)' : cp.team==='enemy'? 'rgba(255,60,60,0.22)':'rgba(180,160,60,0.18)'
    ctx.fillStyle=teamCol; ctx.beginPath(); ctx.arc(cp.x, cp.y, cp.r, 0, Math.PI*2); ctx.fill()
    ctx.strokeStyle= cp.team==='player'? '#5aa0ff' : cp.team==='enemy'? '#ff5a3a':'#c0b040'
    ctx.lineWidth=2; ctx.setLineDash([6,4]); ctx.beginPath(); ctx.arc(cp.x,cp.y,cp.r,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([])
    // progress ring when contested
    if(cp.team==='neutral' && cp.progress>0){
      ctx.strokeStyle='rgba(90,200,255,0.9)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(cp.x,cp.y,cp.r, -Math.PI/2, -Math.PI/2 + Math.PI*2*cp.progress/100); ctx.stroke()
    }
    // flag
    ctx.fillStyle= cp.team==='player'? '#2a7ae0': cp.team==='enemy'? '#c03018':'#8a7a20'
    ctx.fillRect(cp.x-1, cp.y-cp.r-14, 2, 18)
    ctx.fillStyle= cp.team==='player'? '#5aa0ff': cp.team==='enemy'? '#ff6a4a':'#d0c040'
    ctx.fillRect(cp.x+1, cp.y-cp.r-14, 14, 10)
  }
  // buildings
  for(const b of engine.buildings){
    const tx=b.x*TILE, ty=b.y*TILE, w=b.w*TILE, h=b.h*TILE
    const visible= isAreaVisible(engine,b.x,b.y,b.w,b.h)
    if(!engine.explored[b.y]?.[b.x]) continue
    if(!visible){ ctx.fillStyle='rgba(60,60,60,0.9)'; ctx.fillRect(tx,ty,w,h); continue }
    // shadow
    ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(tx+4,ty+h-6,w,6)
    // building body
    const isPlayer=b.team==='player'
    const hue = isPlayer? 210 : 8 // blue vs red
    ctx.fillStyle= b.progress<1? 'rgba(120,120,120,0.6)': `hsl(${hue} 38% ${b.type==='wall'?28:32}%)`
    // fortress/commandCenter taller
    const bh = b.type==='commandCenter'||b.type==='fortress'? h*0.85 : h*0.72
    ctx.fillRect(tx+2, ty+h-bh, w-4, bh)
    // roof
    ctx.fillStyle= isPlayer? 'hsl(210 45% 26%)':'hsl(8 55% 28%)'
    if(b.type==='commandCenter'||b.type==='fortress'){
      ctx.beginPath(); ctx.moveTo(tx+w/2, ty+2); ctx.lineTo(tx+w-4, ty+h-bh); ctx.lineTo(tx+4, ty+h-bh); ctx.fill()
    } else if(b.type==='wall'){
      ctx.fillRect(tx+1,ty+1,w-2,h-2); // wall thick
      ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fillRect(tx+1,ty+1,w-2,4)
    } else if(b.type==='watchtower'){
      ctx.fillRect(tx+2,ty+2,w-4,h*0.6); ctx.fillStyle='#4a3a2a'; ctx.fillRect(tx+w/2-2,ty+h*0.6,4,h*0.4)
    } else {
      ctx.fillRect(tx+4, ty+h-bh-6, w-8, 6)
    }
    // team stripe
    ctx.fillStyle= isPlayer? '#2a7ae0':'#c03020'; ctx.fillRect(tx+2, ty+h-bh, w-4, 3)
    // hp bar
    if(b.hp < b.maxHp){
      const pct=b.hp/b.maxHp
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(tx,ty-8,w,5)
      ctx.fillStyle= pct>0.5?'#3aca3a': pct>0.25?'#e0c030':'#e03030'; ctx.fillRect(tx+1,ty-7,(w-2)*pct,3)
    }
    // selection
    if(b.selected){ ctx.strokeStyle='#3ad0ff'; ctx.lineWidth=2; ctx.setLineDash([6,4]); ctx.strokeRect(tx-2,ty-2,w+4,h+4); ctx.setLineDash([])}
    // rally/queue indicator
    if(b.queue.length){ ctx.fillStyle='rgba(255,220,40,0.9)'; ctx.font='bold 10px monospace'; ctx.fillText(String(b.queue.length), tx+w-10, ty+12)}
    // construction progress
    if(b.progress<1){ ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(tx,ty+h-4,w,4); ctx.fillStyle='#4ac0ff'; ctx.fillRect(tx,ty+h-4,w*b.progress,4)}
  }

  // projectiles
  for(const p of engine.projectiles){
    ctx.fillStyle= p.type==='stone'?'#7a7a7a': p.type==='bolt'?'#c8c8a8':'#e8d8a0'
    ctx.beginPath(); ctx.arc(p.x,p.y, p.type==='stone'?4:2.5,0,Math.PI*2); ctx.fill()
    ctx.strokeStyle='rgba(255,200,40,0.6)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x - (p.tx-p.x)*0.06, p.y - (p.ty-p.y)*0.06); ctx.stroke()
  }

  // units
  for(const u of engine.units){
    if(u.state==='dead') continue
    const visible= engine.fog[ (u.y/TILE)|0 ]?.[ (u.x/TILE)|0 ] || u.team==='player'
    if(u.team==='enemy' && !visible) continue
    const isPlayer=u.team==='player'
    // shadow
    ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(u.x,u.y+8, 10,5,0,0,Math.PI*2); ctx.fill()
    // body
    const size = u.type==='heavy'||u.type==='heavyCav'?9 : u.type==='catapult'||u.type==='ram'?11 : u.type==='worker'?6:7.5
    // team color
    const base = isPlayer? '#2a6ae0':'#c03018'
    const accent = isPlayer? '#5aa0ff':'#ff5a3a'
    // facing dir indicator
    ctx.save(); ctx.translate(u.x,u.y)
    ctx.rotate(u.facing)
    // unit shape by type
    if(['lightCav','heavyCav'].includes(u.type)){
      // horse + rider
      ctx.fillStyle=base; ctx.beginPath(); ctx.ellipse(0,0, size+3, size*0.65,0,0,Math.PI*2); ctx.fill()
      ctx.fillStyle=accent; ctx.beginPath(); ctx.arc(5,0,3.5,0,Math.PI*2); ctx.fill() // rider
    } else if(['catapult','ballista','ram'].includes(u.type)){
      ctx.fillStyle='#5a4a2a'; ctx.fillRect(-size,-size/1.5,size*2,size*1.1)
      ctx.fillStyle='#7a6a3a'; ctx.fillRect(size-2,-2,8,4) // arm
    } else if(['archer','crossbow'].includes(u.type)){
      ctx.fillStyle=base; ctx.beginPath(); ctx.arc(0,0,size,0,Math.PI*2); ctx.fill()
      ctx.strokeStyle='#8a6a2a'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(0,0,size+1, -0.9,0.9); ctx.stroke() // bow
    } else {
      ctx.fillStyle=base; ctx.beginPath(); ctx.arc(0,0,size,0,Math.PI*2); ctx.fill()
      if(u.type==='spearman'){ ctx.fillStyle='#a0a0a0'; ctx.fillRect(size, -1, 10,2)}
      if(u.type==='heavy'){ ctx.strokeStyle='#c0c0c0'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(0,0,size,0,Math.PI*2); ctx.stroke()}
      if(u.type==='worker'){ ctx.fillStyle='#d0a040'; ctx.beginPath(); ctx.arc(0,0,size*0.6,0,Math.PI*2); ctx.fill()}
      if(u.type==='supplyWagon'){ ctx.fillStyle='#8a6a2a'; ctx.fillRect(-size,-size,size*2,size*2)}
      if(u.type==='scout'){ ctx.fillStyle=accent; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill()}
    }
    ctx.restore()
    // hp bar
    if(u.hp < u.maxHp || u.selected){
      const bw=22, bh=3, bx=u.x-bw/2, by=u.y - size -10
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(bx,by,bw,bh)
      ctx.fillStyle= u.hp/u.maxHp>0.5?'#3aca3a': u.hp/u.maxHp>0.25?'#e0c030':'#e03030'
      ctx.fillRect(bx+1,by+1,(bw-2)*Math.max(0,u.hp/u.maxHp),bh-2)
    }
    // morale/supply tiny dots
    if(u.supply<30){ ctx.fillStyle='#ff3a3a'; ctx.beginPath(); ctx.arc(u.x+size+2,u.y-2,2.5,0,Math.PI*2); ctx.fill()}
    else if(u.morale<35){ ctx.fillStyle='#ffaa20'; ctx.beginPath(); ctx.arc(u.x+size+2,u.y-2,2.2,0,Math.PI*2); ctx.fill()}
    // selection ring
    if(u.selected){
      ctx.strokeStyle='#3ad0ff'; ctx.lineWidth=1.6; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.arc(u.x,u.y,size+6,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([])
      // direction arrow
      ctx.strokeStyle='rgba(60,208,255,0.9)'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(u.x,u.y); ctx.lineTo(u.x+Math.cos(u.facing)*18, u.y+Math.sin(u.facing)*18); ctx.stroke()
    }
    // carry indicator
    if(u.carryAmount>0){
      ctx.fillStyle='#ffd700'; ctx.font='bold 8px monospace'; ctx.fillText(String(u.carryAmount), u.x-6, u.y+size+10)
    }
  }

  // particles
  for(const p of engine.particles){
    const alpha=1 - p.life/p.maxLife
    if(p.type==='smoke'){ ctx.fillStyle=`rgba(80,80,80,${alpha*0.5})`; ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(1+ p.life*1.5),0,Math.PI*2); ctx.fill()}
    else if(p.type==='fire'){ ctx.fillStyle=`rgba(255,${120+Math.random()*80|0},20,${alpha})`; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill()}
    else if(p.type==='blood'){ ctx.fillStyle=`rgba(180,20,20,${alpha})`; ctx.beginPath(); ctx.arc(p.x,p.y,p.size*0.7,0,Math.PI*2); ctx.fill()}
    else if(p.type==='dust'){ ctx.fillStyle=`rgba(160,140,100,${alpha*0.6})`; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill()}
    else { ctx.fillStyle=`rgba(100,100,100,${alpha})`; ctx.beginPath(); ctx.arc(p.x,p.y,p.size*0.6,0,Math.PI*2); ctx.fill()}
  }

  // selection rect & effects: drawn in screen space after restore? Do world-space dragging rect here
  ctx.restore()

  // screen-space overlay: selection drag, waypoints
  // (handled by React overlay)
}

function isAreaVisible(engine:GameEngine, tx:number,ty:number,w:number,h:number){
  for(let dy=0;dy<h;dy++) for(let dx=0;dx<w;dx++) if(engine.fog[ty+dy]?.[tx+dx]) return true
  return false
}
