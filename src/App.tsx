import { useGame } from './game/store'
import { GameCanvas3D } from './components/GameCanvas3D'
import { HUD } from './components/HUD'
import { Minimap } from './components/Minimap'
import { MainMenu } from './components/MainMenu'

export default function App(){
  const phase=useGame(s=>s.phase)
  return (
    <div className="app">
      <div className="game-wrap">
        <GameCanvas3D />
        {phase!=='menu' && <HUD />}
        {phase!=='menu' && <div className="minimap-wrap"><Minimap /></div>}
        <MainMenu />
      </div>
    </div>
  )
}
