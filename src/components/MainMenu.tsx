import { useGame, CAMPAIGNS } from '../game/store'
import { audio } from '../game/audio'
import { useState } from 'react'

export function MainMenu(){
  const phase=useGame(s=>s.phase)
  const setPhase=useGame(s=>s.setPhase)
  const startSkirmish=useGame(s=>s.startSkirmish)
  const startCampaignMission=useGame(s=>s.startCampaignMission)
  const [tab,setTab]=useState<'menu'|'campaign'|'skirmish'|'howto'|'settings'>('menu')
  const [diff,setDiff]=useState<'easy'|'normal'|'hard'|'general'>('normal')
  const [seed,setSeed]=useState(777)

  if(phase==='playing'||phase==='paused'||phase==='victory'||phase==='defeat') return null

  return (
    <div className="menu-root">
      <div className="menu-bg" />
      <div className="menu-panel">
        <h1 className="title">WAR COMMAND</h1>
        <div className="subtitle">HD Real-Time War Strategy — Recon · Maneuver · Strike · Conquer</div>

        <div className="menu-tabs">
          <button className={tab==='menu'?'active':''} onClick={()=>setTab('menu')}>PLAY</button>
          <button className={tab==='campaign'?'active':''} onClick={()=>setTab('campaign')}>CAMPAIGN</button>
          <button className={tab==='skirmish'?'active':''} onClick={()=>setTab('skirmish')}>SKIRMISH</button>
          <button className={tab==='howto'?'active':''} onClick={()=>setTab('howto')}>HOW TO PLAY</button>
          <button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}>SETTINGS</button>
        </div>

        {tab==='menu' && (
          <div className="menu-actions">
            <button className="primary" onClick={()=>{ audio.init(); audio.ui(); startSkirmish(seed,diff)}}>▶ Quick Battle</button>
            <button onClick={()=>setTab('campaign')}>Campaign</button>
            <button onClick={()=>setTab('skirmish')}>Custom Skirmish</button>
            <div className="hint">WASD pan · Wheel zoom · Drag select · Right-click move/attack · Double-click same type · Ctrl+Num groups · F formation · A attack-move · S stop · H hold · R retreat</div>
          </div>
        )}

        {tab==='campaign' && (
          <div className="campaign-list">
            {CAMPAIGNS.map(m=>(
              <div key={m.id} className="campaign-card">
                <div className="cc-head">MISSION {m.id}: {m.title} — <span className="diff">{m.difficulty.toUpperCase()}</span></div>
                <div className="cc-brief">{m.brief}</div>
                <button className="primary" onClick={()=>{ audio.init(); audio.ui(); startCampaignMission(m.id)}}>Deploy</button>
              </div>
            ))}
          </div>
        )}

        {tab==='skirmish' && (
          <div className="skirmish-panel">
            <label>Seed <input type="number" value={seed} onChange={e=>setSeed(Number(e.target.value)||0)} /></label>
            <label>Difficulty
              <select value={diff} onChange={e=>setDiff(e.target.value as unknown as typeof diff)}>
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
                <option value="general">General</option>
              </select>
            </label>
            <button className="primary" onClick={()=>{ audio.init(); audio.ui(); startSkirmish(seed,diff)}}>Launch Skirmish</button>
          </div>
        )}

        {tab==='howto' && (
          <div className="howto">
            <h3>Recon → Plan → Mobilize → Position → Attack → Adapt → Capture → Resupply → Advance → Conquer</h3>
            <ul>
              <li><b>Workers</b> gather automatically. Build Farms for population, Supply Depots near front lines.</li>
              <li><b>Terrain:</b> Forest hides, Hills give range/vision, Water slows, Roads speed up. High ground matters.</li>
              <li><b>Counter:</b> Spearmen shred cavalry, Cavalry crushes archers, Archers punish light infantry, Heavy wins frontal.</li>
              <li><b>Directional:</b> Rear attacks +55%, side +18%. Flank to win.</li>
              <li><b>Morale & Supply:</b> Keep armies near supply; wagons extend range. Losses and being surrounded crush morale.</li>
              <li><b>Formations:</b> Line (frontal), Column (march), Wedge (charge), Box (all-around), Circle (defense).</li>
              <li><b>Siege:</b> Catapults/Ballistas/Rams demolish walls and buildings.</li>
              <li><b>Fog of War:</b> Scouts, towers, and high ground reveal. Information wins wars.</li>
            </ul>
          </div>
        )}

        {tab==='settings' && (
          <div className="settings">
            <label>Master <input type="range" min={0} max={1} step={0.05} defaultValue={0.6} onChange={e=>audio.master=Number(e.target.value)} /></label>
            <label>SFX <input type="range" min={0} max={1} step={0.05} defaultValue={0.7} onChange={e=>audio.sfxVol=Number(e.target.value)} /></label>
            <label><input type="checkbox" defaultChecked onChange={e=>audio.enabled=e.target.checked} /> Sound enabled</label>
          </div>
        )}
      </div>
      <div className="credits">WAR COMMAND — Built for Vercel HD · No external assets · Procedural battlefield</div>
    </div>
  )
}
