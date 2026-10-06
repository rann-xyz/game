// ── Pathfinding (A* on tile grid) ──
import type { Vec2 } from './types'
import { MAP_W, MAP_H, TILE } from './types'

export function findPath(
  grid: {terrain:string}[][],
  buildings: {x:number;y:number;w:number;h:number}[],
  sx:number, sy:number, tx:number, ty:number
): Vec2[] {
  if(sx===tx && sy===ty) return []
  if(tx<0||tx>=MAP_W||ty<0||ty>=MAP_H) return []
  // clamp goal off blocked terrain: search nearest free tile
  function isBlockedRaw(x:number,y:number, blocked:Set<string>){
    if(x<0||x>=MAP_W||y<0||y>=MAP_H) return true
    if(blocked.has(`${x},${y}`)) return true
    const t=grid[y][x].terrain
    if(t==='mountain'||t==='water') return true
    return false
  }
  const blocked = new Set<string>()
  for(const b of buildings){
    for(let dx=0;dx<b.w;dx++) for(let dy=0;dy<b.h;dy++) blocked.add(`${b.x+dx},${b.y+dy}`)
  }
  // if goal blocked, find closest free tile (BFS radius 6)
  if(isBlockedRaw(tx,ty,blocked)){
    let best:{x:number;y:number;d:number}|null=null
    for(let r=1;r<=6;r++){
      for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
        const nx=tx+dx, ny=ty+dy
        if(nx<0||nx>=MAP_W||ny<0||ny>=MAP_H) continue
        if(!isBlockedRaw(nx,ny,blocked)){
          const d=Math.abs(dx)+Math.abs(dy)
          if(!best||d<best.d) best={x:nx,y:ny,d}
        }
      }
      if(best) break
    }
    if(best){ tx=(best as {x:number;y:number}).x; ty=(best as {x:number;y:number}).y } else return []
  }
  if(sx===tx && sy===ty) return []
  const isBlocked=(x:number,y:number)=> isBlockedRaw(x,y,blocked)
  // BFS/A* 
  const open:{x:number;y:number;g:number;h:number;f:number;parent?:{x:number;y:number}}[]=[]
  const closed=new Set<string>()
  const gScore=new Map<string,number>()
  const came=new Map<string,{x:number;y:number}>()
  const key=(x:number,y:number)=>`${x},${y}`
  const h=(x:number,y:number)=>Math.abs(x-tx)+Math.abs(y-ty)
  open.push({x:sx,y:sy,g:0,h:h(sx,sy),f:h(sx,sy)})
  gScore.set(key(sx,sy),0)
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
  let iter=0
  while(open.length && iter<8000){
    iter++
    open.sort((a,b)=>a.f-b.f)
    const cur=open.shift()!
    const ck=key(cur.x,cur.y)
    if(cur.x===tx && cur.y===ty){
      // reconstruct
      const path:Vec2[]=[]
      let cx=cur.x, cy=cur.y
      while(!(cx===sx && cy===sy)){
        path.push({x:cx*TILE+TILE/2, y:cy*TILE+TILE/2})
        const p=came.get(key(cx,cy))
        if(!p) break
        cx=p.x; cy=p.y
      }
      path.reverse()
      return path
    }
    closed.add(ck)
    for(const [dx,dy] of dirs){
      const nx=cur.x+dx, ny=cur.y+dy
      const nk=key(nx,ny)
      if(closed.has(nk)) continue
      // don't block goal
      if(!(nx===tx&&ny===ty) && isBlocked(nx,ny)) continue
      const cost = (dx!==0&&dy!==0)?1.414:1
      const ng=cur.g+cost
      const prev=gScore.get(nk)
      if(prev!==undefined && ng>=prev) continue
      gScore.set(nk,ng)
      came.set(nk,{x:cur.x,y:cur.y})
      const hh=h(nx,ny)
      const existing=open.find(o=>o.x===nx&&o.y===ny)
      if(existing){ existing.g=ng; existing.f=ng+hh }
      else open.push({x:nx,y:ny,g:ng,h:hh,f:ng+hh})
    }
  }
  // fallback: direct line
  return [{x:tx*TILE+TILE/2,y:ty*TILE+TILE/2}]
}
