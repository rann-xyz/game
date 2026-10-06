// ── World generation ──
import type { Tile, ResourceType } from './types'
import { MAP_W, MAP_H } from './types'

function mulberry32(seed:number){return()=>{let t=seed+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,61|t); return ((t^t>>>14)>>>0)/4294967296}}

export function generateWorld(seed:number){
  const rnd = mulberry32(seed)
  const tiles: Tile[][] = []
  // noise-ish hills/mountains
  const peaks: {x:number;y:number;r:number}[]=[]
  for(let i=0;i<8;i++) peaks.push({x: rnd()*MAP_W|0, y:rnd()*MAP_H|0, r:4+rnd()*6|0})
  const rivers: {x:number}[]=[]
  for(let i=0;i<2;i++) rivers.push({x: (rnd()*0.6+0.2)*MAP_W|0})

  for(let y=0;y<MAP_H;y++){
    const row:Tile[]=[]
    for(let x=0;x<MAP_W;x++){
      let terrain: Tile['terrain']='plains'
      let height=0
      // hills near peaks
      let dmin=999; for(const p of peaks){ const d=Math.hypot(x-p.x,y-p.y); if(d<dmin) dmin=d }
      if(dmin<3){ terrain='mountain'; height=3 }
      else if(dmin<6){ terrain='hill'; height=2 }
      else if(dmin<8 && rnd()<0.5){ terrain='hill'; height=1 }
      // forest patches
      const forestNoise = Math.sin(x*0.4)*Math.cos(y*0.35) + (rnd()-0.5)*0.6
      if(terrain==='plains' && forestNoise>0.45) terrain='forest'
      // rivers vertical with meander
      for(const rv of rivers){
        const mx = rv.x + Math.sin(y*0.18)*6
        if(Math.abs(x-mx)<1.2) { terrain='water'; height=0 }
        else if(Math.abs(x-mx)<2.2 && terrain!=='mountain') terrain='plains'
      }
      // roads: horizontal + vertical near center
      const cx=MAP_W/2, cy=MAP_H/2
      if((Math.abs(y-cy)<0.6 || Math.abs(x-cx)<0.6) && terrain!=='water' && terrain!=='mountain') terrain='road'
      // bridges over water where road crosses river
      if(terrain==='water' && (Math.abs(y-cy)<1.2 || Math.abs(x-cx)<1.2)) terrain='bridge'

      // villages/ruins sparse
      if(terrain==='plains' && rnd()<0.012) terrain='village'
      if(terrain==='plains' && rnd()<0.006) terrain='ruins'

      const tile: Tile={terrain,height,explored:false,visible:false}
      // resource deposits
      if(terrain==='forest' && rnd()<0.18){ tile.resource='wood'; tile.resourceAmount=800+ rnd()*600|0 }
      else if(terrain==='hill' && rnd()<0.12){ tile.resource='stone'; tile.resourceAmount=600+ rnd()*500|0 }
      else if(terrain==='hill' && rnd()<0.08){ tile.resource='gold'; tile.resourceAmount=500+ rnd()*400|0 }
      else if(terrain==='plains' && rnd()<0.05){ tile.resource='food'; tile.resourceAmount=600+ rnd()*400|0 }
      row.push(tile)
    }
    tiles.push(row)
  }
  return tiles
}

export function worldToTile(x:number,y:number,TILE:number){ return {tx: Math.floor(x/TILE), ty:Math.floor(y/TILE)} }
export function tileToWorld(tx:number,ty:number,TILE:number){ return {x:tx*TILE+TILE/2, y:ty*TILE+TILE/2} }
