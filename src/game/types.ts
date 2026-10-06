// ── Core Game Types ──
export type Vec2 = { x: number; y: number }
export type Team = 'player' | 'enemy' | 'neutral'
export type TerrainType = 'plains' | 'forest' | 'hill' | 'mountain' | 'water' | 'bridge' | 'road' | 'village' | 'ruins'
export type ResourceType = 'gold' | 'wood' | 'stone' | 'food'
export type UnitType = 'worker' | 'swordsman' | 'spearman' | 'heavy' | 'archer' | 'crossbow' | 'lightCav' | 'heavyCav' | 'scout' | 'catapult' | 'ballista' | 'ram' | 'supplyWagon'
export type BuildingType = 'commandCenter' | 'barracks' | 'archeryRange' | 'stable' | 'siegeWorkshop' | 'supplyDepot' | 'watchtower' | 'wall' | 'gate' | 'fortress' | 'farm' | 'lumberCamp' | 'quarry' | 'mine'
export type FormationType = 'line' | 'column' | 'wedge' | 'box' | 'circle' | 'none'
export type TacticalOrder = 'attack' | 'attackMove' | 'hold' | 'defend' | 'retreat' | 'charge' | 'flank' | 'guard' | 'regroup' | 'none'
export type CommandTrait = 'strategist' | 'aggressive' | 'defensive' | 'logistics' | 'infantryExpert' | 'cavalryExpert'
export type Difficulty = 'easy' | 'normal' | 'hard' | 'general'
export type GamePhase = 'menu' | 'campaign' | 'skirmish' | 'playing' | 'paused' | 'victory' | 'defeat'
export type AgePhase = 'recon' | 'plan' | 'mobilize' | 'position' | 'attack' | 'adapt' | 'capture' | 'resupply' | 'advance' | 'conquer'

export interface Tile {
  terrain: TerrainType
  height: number // 0-3
  explored: boolean
  visible: boolean
  resource?: ResourceType
  resourceAmount?: number
  buildingId?: string
}

export interface UnitStats {
  hp: number; maxHp: number; damage: number; armor: number
  speed: number; range: number; attackSpeed: number // attacks/sec
  vision: number; morale: number; supply: number // 0-100
  cost: Record<ResourceType, number>
  buildTime: number
  pop: number
}

export interface Unit {
  id: string; type: UnitType; team: Team
  x: number; y: number; // world pixels
  tx: number; ty: number; // target
  hp: number; maxHp: number; armor: number; damage: number
  speed: number; range: number; attackSpeed: number; vision: number
  morale: number; supply: number
  facing: number // radians
  state: 'idle' | 'moving' | 'attacking' | 'gathering' | 'building' | 'dead'
  targetId?: string
  carryType?: ResourceType
  carryAmount: number; carryCap: number
  gatherCooldown: number
  attackCooldown: number
  path: Vec2[]
  formation?: FormationType
  order: TacticalOrder
  selected: boolean
  groupId?: number
}

export interface Building {
  id: string; type: BuildingType; team: Team
  x: number; y: number; w: number; h: number
  hp: number; maxHp: number; armor: number
  progress: number // 0-1 build progress, 1=done
  queue: UnitType[]
  queueProgress: number
  selected: boolean
}

export interface Projectile {
  id: string; x: number; y: number
  tx: number; ty: number; targetId: string
  damage: number; speed: number; team: Team
  type: 'arrow' | 'bolt' | 'stone' | 'fire'
  arc: number
}

export interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; color: string; size: number
  type: 'dust' | 'smoke' | 'fire' | 'spark' | 'blood' | 'debris'
}

export interface Resources { gold: number; wood: number; stone: number; food: number }
export interface Tech { id: string; name: string; desc: string; branch: string; cost: Partial<Resources>; prereq?: string; done: boolean; researching: boolean; progress: number }

export interface Objective {
  id: string; title: string; desc: string
  type: 'destroy' | 'capture' | 'defend' | 'hold' | 'eliminate'
  targetX?: number; targetY?: number; targetId?: string
  done: boolean; failed: boolean
}

export interface Mission {
  id: number; title: string; brief: string
  objectives: Objective[]
  enemyCount: number; difficulty: Difficulty
  mapSeed: number
}

export interface GameStats {
  kills: number; losses: number
  buildingsDestroyed: number; buildingsLost: number
  resourcesGathered: Resources
  startTime: number
}

export interface Camera { x: number; y: number; zoom: number; targetX: number; targetY: number; shake: number }
export interface FogCell { explored: boolean; visible: boolean; visibleTimer: number }

export const MAP_W = 80
export const MAP_H = 60
export const TILE = 32
export const WORLD_W = MAP_W * TILE
export const WORLD_H = MAP_H * TILE
