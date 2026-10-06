// ── Unit stat table ──
import type { UnitStats, UnitType, Resources } from './types'

const R: Record<string, Partial<Resources>> = {}

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  worker:      { hp:60, maxHp:60, damage:5,  armor:0, speed:90,  range:18,  attackSpeed:0.8, vision:140, morale:60, supply:1, cost:{gold:50,wood:0,stone:0,food:1}, buildTime:8, pop:1 },
  swordsman:   { hp:110,maxHp:110,damage:18, armor:3, speed:75,  range:20,  attackSpeed:1.0, vision:130, morale:75, supply:2, cost:{gold:60,wood:0,stone:0,food:1}, buildTime:12, pop:1 },
  spearman:    { hp:100,maxHp:100,damage:14, armor:2, speed:78,  range:26,  attackSpeed:1.1, vision:130, morale:70, supply:2, cost:{gold:55,wood:10,stone:0,food:1}, buildTime:10, pop:1 },
  heavy:       { hp:160,maxHp:160,damage:22, armor:6, speed:55,  range:20,  attackSpeed:0.7, vision:120, morale:85, supply:3, cost:{gold:90,wood:0,stone:20,food:1}, buildTime:18, pop:1 },
  archer:      { hp:70, maxHp:70, damage:16, armor:0, speed:80,  range:160, attackSpeed:0.9, vision:180, morale:65, supply:2, cost:{gold:50,wood:25,stone:0,food:1}, buildTime:14, pop:1 },
  crossbow:    { hp:80, maxHp:80, damage:28, armor:1, speed:65,  range:190, attackSpeed:0.5, vision:190, morale:70, supply:2, cost:{gold:75,wood:30,stone:0,food:1}, buildTime:18, pop:1 },
  lightCav:    { hp:120,maxHp:120,damage:20, armor:2, speed:145, range:22,  attackSpeed:1.0, vision:170, morale:75, supply:3, cost:{gold:80,wood:0,stone:0,food:1}, buildTime:16, pop:1 },
  heavyCav:    { hp:180,maxHp:180,damage:32, armor:5, speed:120, range:22,  attackSpeed:0.8, vision:160, morale:85, supply:4, cost:{gold:120,wood:0,stone:10,food:1}, buildTime:22, pop:1 },
  scout:       { hp:75, maxHp:75, damage:10, armor:0, speed:155, range:18,  attackSpeed:1.0, vision:280, morale:70, supply:2, cost:{gold:60,wood:0,stone:0,food:1}, buildTime:10, pop:1 },
  catapult:    { hp:100,maxHp:100,damage:65, armor:1, speed:40,  range:280, attackSpeed:0.25,vision:200, morale:60, supply:3, cost:{gold:120,wood:80,stone:40,food:1}, buildTime:28, pop:2 },
  ballista:    { hp:90, maxHp:90, damage:45, armor:1, speed:50,  range:250, attackSpeed:0.35,vision:210, morale:65, supply:3, cost:{gold:100,wood:60,stone:20,food:1}, buildTime:24, pop:2 },
  ram:         { hp:200,maxHp:200,damage:50, armor:4, speed:45,  range:28,  attackSpeed:0.4, vision:100, morale:70, supply:3, cost:{gold:80,wood:60,stone:0,food:1}, buildTime:20, pop:2 },
  supplyWagon: { hp:90, maxHp:90, damage:0,  armor:1, speed:85,  range:0,   attackSpeed:0,  vision:120, morale:55, supply:-10,cost:{gold:60,wood:30,stone:0,food:0}, buildTime:12, pop:1 },
}
void R
export const BUILDING_STATS: Record<string,{hp:number;armor:number;cost:Partial<Resources>;time:number;w:number;h:number}> = {
  commandCenter:{hp:1200,armor:5,cost:{gold:0,wood:0,stone:0,food:0},time:0,w:3,h:3},
  barracks:     {hp:600, armor:3,cost:{gold:120,wood:80,stone:0,food:0},time:20,w:2,h:2},
  archeryRange: {hp:500, armor:2,cost:{gold:100,wood:100,stone:0,food:0},time:18,w:2,h:2},
  stable:       {hp:550, armor:2,cost:{gold:140,wood:80,stone:20,food:0},time:22,w:2,h:2},
  siegeWorkshop:{hp:500, armor:2,cost:{gold:180,wood:100,stone:60,food:0},time:28,w:2,h:2},
  supplyDepot:  {hp:400, armor:2,cost:{gold:80,wood:60,stone:30,food:0},time:14,w:2,h:1},
  watchtower:   {hp:350, armor:3,cost:{gold:60,wood:40,stone:40,food:0},time:12,w:1,h:1},
  wall:         {hp:450, armor:6,cost:{gold:0,wood:0,stone:20,food:0},time:6,w:1,h:1},
  gate:         {hp:500, armor:5,cost:{gold:0,wood:20,stone:30,food:0},time:8,w:1,h:1},
  fortress:     {hp:1000,armor:6,cost:{gold:300,wood:100,stone:200,food:0},time:40,w:3,h:3},
  farm:         {hp:250, armor:1,cost:{gold:40,wood:30,stone:0,food:0},time:10,w:2,h:2},
  lumberCamp:   {hp:300, armor:1,cost:{gold:50,wood:0,stone:0,food:0},time:8,w:1,h:1},
  quarry:       {hp:300, armor:1,cost:{gold:60,wood:20,stone:0,food:0},time:8,w:1,h:1},
  mine:         {hp:300, armor:1,cost:{gold:80,wood:20,stone:10,food:0},time:10,w:1,h:1},
}

export const BUILDING_PRODUCES: Record<string,UnitType[]> = {
  commandCenter:['worker'],
  barracks:['swordsman','spearman','heavy'],
  archeryRange:['archer','crossbow','scout'],
  stable:['lightCav','heavyCav','supplyWagon'],
  siegeWorkshop:['catapult','ballista','ram'],
}

export const TECHS = [
  {id:'econ1',name:'Efficient Harvest',desc:'+25% gather rate',branch:'ECONOMY',cost:{gold:100,wood:50},prereq:undefined},
  {id:'econ2',name:'Deep Mining',desc:'+30% gold/stone yield',branch:'ECONOMY',cost:{gold:180,stone:60},prereq:'econ1'},
  {id:'inf1',name:'Steel Arms',desc:'+4 damage infantry',branch:'INFANTRY',cost:{gold:120,stone:30},prereq:undefined},
  {id:'inf2',name:'Plate Armor',desc:'+3 armor infantry',branch:'INFANTRY',cost:{gold:160,stone:50},prereq:'inf1'},
  {id:'rng1',name:'Longbow',desc:'+30 range archers',branch:'RANGED',cost:{gold:100,wood:60},prereq:undefined},
  {id:'rng2',name:'Piercing Bolts',desc:'+8 damage ranged',branch:'RANGED',cost:{gold:150,wood:40},prereq:'rng1'},
  {id:'cav1',name:'Horsemanship',desc:'+15% cavalry speed',branch:'CAVALRY',cost:{gold:140,food:40},prereq:undefined},
  {id:'cav2',name:'Lance Charge',desc:'+10 cav damage',branch:'CAVALRY',cost:{gold:200,wood:30},prereq:'cav1'},
  {id:'def1',name:'Fortified Walls',desc:'+200 wall HP',branch:'DEFENSE',cost:{gold:100,stone:80},prereq:undefined},
  {id:'def2',name:'Arrow Slits',desc:'Towers +15 damage',branch:'DEFENSE',cost:{gold:140,stone:60},prereq:'def1'},
  {id:'siege1',name:'Counterweight',desc:'+40 siege range',branch:'SIEGE',cost:{gold:160,wood:60,stone:30},prereq:undefined},
  {id:'log1',name:'Supply Lines',desc:'-30% supply consumption',branch:'LOGISTICS',cost:{gold:120,food:60},prereq:undefined},
]

export function counterMultiplier(attacker:UnitType, defender:UnitType):number{
  if(attacker==='spearman' && (defender==='lightCav'||defender==='heavyCav')) return 1.8
  if((attacker==='lightCav'||attacker==='heavyCav') && (defender==='archer'||defender==='crossbow'||defender==='catapult'||defender==='ballista')) return 1.6
  if((attacker==='archer'||attacker==='crossbow') && (defender==='swordsman'||defender==='spearman'||defender==='worker')) return 1.35
  if(attacker==='heavy' && defender==='swordsman') return 1.25
  return 1
}

// terrain modifiers
export function terrainSpeedMult(t:string){ if(t==='forest') return 0.7; if(t==='hill') return 0.8; if(t==='mountain') return 0.2; if(t==='water') return 0.25; if(t==='road'||t==='bridge') return 1.35; return 1 }
export function terrainVisionMult(t:string){ if(t==='forest') return 0.6; if(t==='hill') return 1.4; return 1 }
export function terrainDefenseBonus(t:string){ if(t==='forest') return 1; if(t==='hill') return 2; if(t==='village') return 1; return 0 }
