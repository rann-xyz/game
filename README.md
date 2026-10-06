# WAR COMMAND — HD Real-Time War Strategy

Browser-based HD war strategy game. Recon → Plan → Mobilize → Position → Attack → Adapt → Capture → Resupply → Advance → Conquer.

## Features
- **RTS Engine**: Canvas rendering, A* pathfinding, projectile combat, directional/flanking, morale, supply lines
- **14 Unit Types**: workers, infantry, archers, cavalry, scouts, siege, supply wagons
- **14 Building Types**: command center, barracks, archery, stable, siege workshop, fortifications
- **5 Formations**: line/column/wedge/box/circle
- **Terrain Tactics**: forest, hills, mountains, rivers, roads
- **Fog of War** + reconnaissance, **Logistics** + supply wagons, **Technology** tree
- **Enemy AI** with 4 difficulties, **6 Campaign Missions**, Skirmish mode
- **Minimap**, save/load, WebAudio SFX

## Stack
React + TypeScript + Vite + Zustand + Canvas + Web Audio API

## Develop
```
npm install
npm run dev
npm run build
```

## Deploy
Vercel: `vercel --prod` — SPA rewrites via `vercel.json`.
