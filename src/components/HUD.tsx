import { useGame } from '../game/store'
import { BUILDING_STATS } from '../game/balance'
import type { BuildingType, UnitType } from '../game/types'
import { BUILDING_PRODUCES } from '../game/balance'
import { UNIT_STATS } from '../game/balance'
import { audio } from '../game/audio'

export function HUD(){
  const engine=useGame(s=>s.engine)
  const tick=useGame(s=>s.tick)
  const showTech=useGame(s=>s.showTech)
  const placingBuilding=useGame(s=>s.placingBuilding)
  void tick
  const selUnits=engine.units.filter(u=>engine.selectedIds.has(u.id) && u.state!=='dead')
  const selBuilding=engine.buildings.find(b=>b.id===engine.selectedBuildingId)
  const res=engine.resources

  return (
    <div className="hud">
      {/* top bar */}
      <div className="topbar">
        <div className="res">
          <span className="gold">◉ {res.gold|0}</span>
          <span className="wood">♣ {res.wood|0}</span>
          <span className="stone">⬢ {res.stone|0}</span>
          <span className="food">⚑ {res.food|0}</span>
          <span className="pop">☷ {engine.pop}/{engine.popCap}</span>
        </div>
        <div className="time">{Math.floor(engine.time/60)}:{String(Math.floor(engine.time%60)).padStart(2,'0')} {engine.paused?'⏸':''}</div>
        <div className="actions">
          <button onClick={()=>{ audio.ui(); useGame.setState({showTech:!showTech})}}>Research</button>
          <button onClick={()=>{ engine.paused=!engine.paused; audio.ui()}}>{engine.paused?'Resume':'Pause'}</button>
          <button onClick={()=>{ if(confirm('Save game?')){ localStorage.setItem('wargame_save',engine.serialize()); engine.notify('Saved')} }}>Save</button>
          <button onClick={()=>{ const s=localStorage.getItem('wargame_save'); if(s){ engine.deserialize(s)} else engine.notify('No save found')}}>Load</button>
          <button onClick={()=>{ useGame.setState({phase:'menu'})}}>Menu</button>
        </div>
      </div>

      {/* notifications */}
      <div className="notifs">
        {engine.notifications.slice(-4).map(n=> <div key={n.id} className="notif">{n.text}</div>)}
      </div>

      {/* bottom HUD */}
      <div className="bottombar">
        <div className="selection">
          {selUnits.length>0 && (
            <div className="sel-units">
              <div className="sel-title">{selUnits.length} selected — {engine.formation} / {engine.order}</div>
              <div className="sel-grid">
                {selUnits.slice(0,12).map(u=>(
                  <div key={u.id} className="sel-card" title={u.type}>
                    <div className="sel-name">{u.type}</div>
                    <div className="hpbar"><div style={{width:`${u.hp/u.maxHp*100}%`}} /></div>
                    <div className="small">HP {u.hp|0} · Morale {u.morale|0} · Sup {u.supply|0}</div>
                  </div>
                ))}
              </div>
              <div className="cmd-row">
                <button onClick={()=>{engine.issueStop();audio.ui()}}>Stop (S)</button>
                <button onClick={()=>engine.issueHold()}>Hold (H)</button>
                <button onClick={()=>engine.issueRetreat()}>Retreat (R)</button>
                <button onClick={()=>engine.setOrder('attackMove')}>Attack-Move (A)</button>
                <button onClick={()=>{ const f={line:'column',column:'wedge',wedge:'box',box:'circle',circle:'line'} as Record<string,string>; engine.setFormation((f[engine.formation]||'line') as unknown as typeof engine.formation)}}>Formation (F): {engine.formation}</button>
                <button onClick={()=>{ selUnits.forEach(u=>{u.morale=Math.min(100,u.morale+8)}); audio.ui()}}>Rally</button>
              </div>
            </div>
          )}
          {selBuilding && (
            <div className="sel-building">
              <div className="sel-title">{selBuilding.type} — HP {selBuilding.hp|0}/{selBuilding.maxHp}</div>
              <div className="hpbar big"><div style={{width:`${selBuilding.hp/selBuilding.maxHp*100}%`}} /></div>
              {selBuilding.queue.length>0 && <div className="queue">Queue: {selBuilding.queue.join(', ')} ({(selBuilding.queueProgress/ ( (UNIT_STATS[selBuilding.queue[0] as UnitType]?.buildTime||10)*0.5)*100|0)}%)</div>}
              <div className="train-row">
                {(BUILDING_PRODUCES[selBuilding.type]||[]).map((ut:UnitType)=>{
                  const st=UNIT_STATS[ut]
                  return <button key={ut} onClick={()=>{engine.tryTrain(selBuilding.id, ut); audio.build()}} title={`${ut} — ${st.cost.gold}g ${st.cost.wood}w`}>
                    {ut}
                  </button>
                })}
              </div>
            </div>
          )}
          {!selUnits.length && !selBuilding && (
            <div className="hint">Select units (drag or click). Right-click to move / attack. Double-click to select same type. Ctrl+Num to group. F=formation, A=attack-move, S=stop, H=hold, R=retreat. B to build.</div>
          )}
        </div>

        <div className="build-panel">
          <div className="build-title">Build {placingBuilding?`— placing ${placingBuilding} (click map)`:'— click to place'}</div>
          <div className="build-grid">
            {(Object.keys(BUILDING_STATS) as BuildingType[]).map(bt=>{
              const st=BUILDING_STATS[bt]
              return <button key={bt} className={placingBuilding===bt?'active':''} onClick={()=>{
                if(placingBuilding===bt) useGame.setState({placingBuilding:null})
                else useGame.setState({placingBuilding: bt as unknown as typeof placingBuilding}); audio.ui()
              }} title={`${bt} — cost ${JSON.stringify(st.cost)}`}>
                {bt}
              </button>
            })}
          </div>
        </div>
      </div>

      {/* tech panel */}
      {showTech && (
        <div className="tech-overlay" onClick={()=> useGame.setState({showTech:false})}>
          <div className="tech-panel" onClick={e=>e.stopPropagation()}>
            <h3>Research</h3>
            <div className="tech-grid">
              {engine.techs.map(t=>(
                <div key={t.id} className={`tech-card ${t.done?'done': t.researching?'researching':''}`}>
                  <div className="tech-name">{t.name}</div>
                  <div className="tech-desc">{t.desc} · {t.branch}</div>
                  <div className="tech-cost">{Object.entries(t.cost as unknown as Record<string,number>).filter(([,v])=>v).map(([k,v])=>`${v}${k[0]}`).join(' ')}</div>
                  {t.researching && <div className="tech-progress"><div style={{width:`${t.progress*100}%`}}/></div>}
                  {!t.done && !t.researching && <button onClick={()=>{engine.research(t.id); audio.ui()}} disabled={!!t.prereq && !engine.hasTech(t.prereq)}>Research</button>}
                  {t.done && <span className="done-badge">✓ Done</span>}
                </div>
              ))}
            </div>
            <button className="close" onClick={()=> useGame.setState({showTech:false})}>Close</button>
          </div>
        </div>
      )}

      {/* victory/defeat */}
      {(engine.victory||engine.defeat) && (
        <div className="end-overlay">
          <div className="end-panel">
            <h2>{engine.victory?'VICTORY':'DEFEAT'}</h2>
            <div className="stats">
              <div>Kills: {engine.stats.kills}</div>
              <div>Losses: {engine.stats.losses}</div>
              <div>Buildings Destroyed: {engine.stats.buildingsDestroyed}</div>
              <div>Buildings Lost: {engine.stats.buildingsLost}</div>
              <div>Time: {(engine.time/60|0)}m {(engine.time%60|0)}s</div>
            </div>
            <div className="end-actions">
              <button onClick={()=>{ engine.paused=false; engine.victory=false; engine.defeat=false; useGame.setState({phase:'menu'})}}>Menu</button>
              <button onClick={()=>{ engine.victory=false; engine.defeat=false; engine.paused=false; if(engine.mission) engine.startMission({...engine.mission, objectives: engine.mission.objectives.map(o=>({...o}))}); audio.ui()}}>Restart</button>
            </div>
          </div>
        </div>
      )}

      {/* tutorial hint for mission 1 */}
      {engine.mission?.id===1 && engine.time<25 && !engine.victory && !engine.defeat && (
        <div className="tutorial">
          <b>Tutorial:</b> Drag to select your swordsmen, right-click near enemy to attack. Workers gather automatically. Build Barracks to train more. Press F to change formation.
        </div>
      )}
    </div>
  )
}
