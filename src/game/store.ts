import { create } from 'zustand'
import { GameEngine } from './engine'
import type { Difficulty, Mission, BuildingType, UnitType, Vec2 } from './types'

type Phase = 'menu'|'campaign'|'skirmish'|'playing'|'paused'|'victory'|'defeat'

interface State {
  engine: GameEngine
  phase: Phase
  tick: number
  showTech: boolean
  showBuild: BuildingType | null
  placingBuilding: BuildingType | null
  skirmishSeed: number
  skirmishDiff: Difficulty
  selectedCampaignMission: number
  heroMode: boolean
  heroFps: boolean
  // actions
  startSkirmish: (seed:number,diff:Difficulty)=>void
  startCampaignMission: (id:number)=>void
  setPhase: (p:Phase)=>void
  bump: ()=>void
}

const CAMPAIGNS: Mission[] = [
  { id:1, title:'First Command', brief:'Learn to command. Eliminate the frontier outpost.', objectives:[{id:'o1',title:'Destroy Enemy Command Center',desc:'Eliminate enemy CC',type:'destroy',done:false,failed:false}], enemyCount:1, difficulty:'easy', mapSeed:101 },
  { id:2, title:'Hold The Fortress', brief:'Defend the fortress against waves. Survive and counter-attack.', objectives:[{id:'o1',title:'Destroy Enemy Command Center',desc:'Hold and destroy',type:'destroy',done:false,failed:false}], enemyCount:1, difficulty:'normal', mapSeed:202 },
  { id:3, title:'Territory Claim', brief:'Capture the central supply depot.', objectives:[{id:'o1',title:'Destroy Enemy Command Center',desc:'Capture central region',type:'destroy',done:false,failed:false}], enemyCount:1, difficulty:'normal', mapSeed:303 },
  { id:4, title:'Breaking The Line', brief:'Break fortified enemy lines with siege.', objectives:[{id:'o1',title:'Destroy Enemy Fortress',desc:'Use siege to break the wall',type:'destroy',done:false,failed:false}], enemyCount:1, difficulty:'hard', mapSeed:404 },
  { id:5, title:'Two Fronts', brief:'Enemy attacks from two directions. Manage both fronts.', objectives:[{id:'o1',title:'Destroy All Enemy Command Centers',desc:'Multi-front war',type:'destroy',done:false,failed:false}], enemyCount:2, difficulty:'hard', mapSeed:505 },
  { id:6, title:'Capital Assault', brief:'Final assault on the enemy capital — a fortress city.', objectives:[{id:'o1',title:'Annihilate Enemy Capital',desc:'Destroy the heavily fortified enemy base',type:'destroy',done:false,failed:false}], enemyCount:1, difficulty:'general', mapSeed:606 },
]

export const useGame = create<State>((set,get)=>({
  engine: new GameEngine(42),
  phase: 'menu',
  tick: 0,
  showTech: false,
  showBuild: null,
  placingBuilding: null,
  skirmishSeed: 777,
  skirmishDiff: 'normal',
  selectedCampaignMission: 1,
  heroMode: false,
  heroFps: false,
  startSkirmish(seed,diff){
    const e=get().engine
    e.startSkirmish(seed,diff)
    set({ phase:'playing' })
  },
  startCampaignMission(id){
    const m=CAMPAIGNS.find(x=>x.id===id)
    if(!m) return
    const e=get().engine
    // scale difficulty per mission
    e.startMission({...m, objectives: m.objectives.map(o=>({...o}))})
    set({ phase:'playing' })
  },
  setPhase(p){ set({phase:p})},
  bump(){ set(s=>({tick:s.tick+1}))}
}))

export { CAMPAIGNS }
export type { Phase }
