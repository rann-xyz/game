import { useGame } from './game/store'
import { GameCanvas } from './components/GameCanvas'
import { HUD } from './components/HUD'
import { Minimap } from './components/Minimap'
import { MainMenu } from './components/MainMenu'

export default function App(){
  const phase=useGame(s=>s.phase)
  return (
    <div className="app">
      <div className="game-wrap">
        <GameCanvas />
        {phase!=='menu' && <HUD />}
        {phase!=='menu' && <div className="minimap-wrap"><Minimap /></div>}
        <MainMenu />
      </div>
    </div>
  )
}
