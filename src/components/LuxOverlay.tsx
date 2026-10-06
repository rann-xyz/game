import { useGame } from '../game/store'
import { BUILDING_STATS, BUILDING_PRODUCES, UNIT_STATS } from '../game/balance'
import type { BuildingType, UnitType } from '../game/types'
import { audio } from '../game/audio'
import { useState, useRef, useEffect } from 'react'
// Lux compact overlay — replaces cluttered HUD with simplified hero-forward UI

export function LuxOverlay(){
  const phase=useGame(s=>s.phase)
  const engine=useGame(s=>s.engine)
  const heroMode=useGame(s=>s.heroMode)
  const heroFps=useGame(s=>s.heroFps)
  const placingBuilding=useGame(s=>s.placingBuilding)
  const showTech=useGame(s=>s.showTech)
  const tick=useGame(s=>s.tick); void tick
  const [skillCd, setSkillCd]=useState({slash:0,kaboom:0,rally:0})
  const [joy, setJoy]=useState<{active:boolean;dx:number;dy:number}>({active:false,dx:0,dy:0})
  const [lockHint, setLockHint]=useState(false)
  const joyRef=useRef<HTMLDivElement>(null)
  const skillTimers=useRef({slash:0,kaboom:0,rally:0})

  // tick skill cds locally
  useEffect(()=>{
    let raf=0, last=performance.now()
    const loop=(now:number)=>{
      const dt=Math.min(0.05,(now-last)/1000); last=now
      setSkillCd(s=>({slash:Math.max(0,s.slash-dt), kaboom:Math.max(0,s.kaboom-dt), rally:Math.max(0,s.rally-dt)}))
      skillTimers.current.slash=Math.max(0, skillTimers.current.slash-dt)
      skillTimers.current.kaboom=Math.max(0, skillTimers.current.kaboom-dt)
      skillTimers.current.rally=Math.max(0, skillTimers.current.rally-dt)
      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    return ()=>cancelAnimationFrame(raf)
  },[])

  if(phase==='menu') return null

  const res=engine.resources
  const hero=engine.units.find(u=>(u as any).isHero)
  const heroHp = hero ? hero.hp/hero.maxHp : 1
  const heroAlive = hero ? hero.state!=='dead' : false
  const terr = (engine as any).capturePoints as {team:string}[]|undefined

  const doSkill=(k:'slash'|'kaboom'|'rally', cd:number)=>{
    if(skillTimers.current[k]>0) return
    const ok=(engine as any).doHeroSkill?.(k)
    if(ok){ skillTimers.current[k]=cd; setSkillCd(s=>({...s,[k]:cd})); if(k==='slash') audio.attack(); else if(k==='kaboom') audio.attack(); else audio.ui() }
  }

  // joystick -> feed hero intent via custom event polled by GameCanvas3D
  const onJoyStart=(e:React.TouchEvent|React.MouseEvent)=>{
    setJoy({active:true,dx:0,dy:0})
    ;(e.currentTarget as HTMLElement).setPointerCapture?.((e as any).pointerId)
  }
  const onJoyMove=(e:React.TouchEvent|React.MouseEvent)=>{
    if(!joy.active) return
    const rect=joyRef.current!.getBoundingClientRect()
    const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2
    const t=(e as React.TouchEvent).touches?.[0] || (e as React.MouseEvent)
    const dx=(t.clientX-cx)/(rect.width/2), dy=(t.clientY-cy)/(rect.height/2)
    const len=Math.hypot(dx,dy)
    const clamped=len>1? {dx:dx/len, dy:dy/len}:{dx,dy}
    setJoy({active:true, ...clamped})
    document.dispatchEvent(new CustomEvent('hero-joy',{detail:clamped}))
  }
  const onJoyEnd=()=>{ setJoy({active:false,dx:0,dy:0}); document.dispatchEvent(new CustomEvent('hero-joy',{detail:{dx:0,dy:0}})) }

  return (
    <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:6}}>
      <div className="openworld-vignette" />
      {/* top luxe bar */}
      <div style={{position:'absolute',top:10,left:12,right:12,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,pointerEvents:'auto'}}>
        <div className="glass-panel" style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',borderRadius:14}}>
          <span style={{color:'var(--gold)',fontWeight:800,letterSpacing:'.08em',fontFamily:'Cinzel'}}>◉ {res.gold|0}</span>
          <span style={{width:1,height:18,background:'rgba(231,196,106,.22)'}} />
          <span style={{color:'#6ACA6A',fontWeight:700}}>♣ {res.wood|0}</span>
          <span style={{color:'#B8B8B8',fontWeight:700}}>⬢ {res.stone|0}</span>
          <span style={{color:'#E7A84A',fontWeight:700}}>⚑ {res.food|0}</span>
          <span style={{width:1,height:18,background:'rgba(255,255,255,.12)'}} />
          <span style={{color:'#7AC0FF',fontWeight:700}}>☷ {engine.pop}/{engine.popCap}</span>
          <span style={{color: 'var(--muted)',fontSize:11}}>⛳ {terr?.filter(c=>c.team==='player').length||0}/{terr?.length||0}</span>
          <span style={{color:'var(--muted)',fontSize:11,marginLeft:6}}>{Math.floor(engine.time/60)}:{String(Math.floor(engine.time%60)).padStart(2,'0')}</span>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="gold-btn" onClick={()=>useGame.setState({heroMode:!heroMode})} style={{padding:'8px 14px',borderRadius:12,pointerEvents:'auto'}}>
            {heroMode? (heroFps?'FPS':'TPS') : 'TACTIC'}
          </button>
          {heroMode && <button className="gold-btn" onClick={()=>useGame.setState({heroFps:!heroFps})} style={{padding:'8px 10px',borderRadius:12,pointerEvents:'auto'}}>↺</button>}
          <button className="gold-btn" onClick={()=>useGame.setState({showTech:!showTech})} style={{padding:'8px 12px',borderRadius:12,pointerEvents:'auto'}}>Research</button>
          <button className="gold-btn" onClick={()=>useGame.setState({phase:'menu'})} style={{padding:'8px 12px',borderRadius:12,pointerEvents:'auto'}}>Menu</button>
        </div>
      </div>

      {heroMode && (
        <div style={{position:'absolute',left:14,top:64,display:'flex',alignItems:'center',gap:12,pointerEvents:'auto'}}>
          <div className="hero-orb"><div>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.6"><path d="M12 3l2.4 4.8 5.3.8-3.8 3.7.9 5.2L12 15l-4.8 2.5.9-5.2L4.3 8.6l5.3-.8z"/><circle cx="12" cy="12" r="8" opacity=".25"/></svg>
          </div></div>
          <div>
            <div style={{fontFamily:'Cinzel',color:'var(--gold)',letterSpacing:'.12em',fontSize:12,lineHeight:1}}>CHAMPION</div>
            <div style={{fontSize:10,color:'var(--muted)',letterSpacing:'.12em'}}>{heroAlive? 'IN BATTLE':'FALLEN'} · {hero?.type.toUpperCase()}</div>
          </div>
          {/* HP ring */}
          <svg className="hp-ring" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,.14)" strokeWidth={3} fill="none" />
            <circle cx="20" cy="20" r="16" strokeDasharray={`${heroHp*100.53} 100.53`} stroke="#E7C46A" />
          </svg>
        </div>
      )}

      {/* notifs */}
      <div style={{position:'absolute',top:58,left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',gap:6,pointerEvents:'none'}}>
        {engine.notifications.slice(-3).map(n=>(
          <div key={n.id} className="glass-panel" style={{padding:'7px 14px',borderRadius:12, color:'#E8EADF', fontSize:12, textAlign:'center'}}>{n.text}</div>
        ))}
      </div>

      {/* bottom simplified controls */}
      <div style={{position:'absolute',left:0,right:0,bottom:0,padding:'12px 12px 14px',display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:12,pointerEvents:'none'}}>
        {/* joystick (hero) or build wheel (tactic) */}
        <div style={{pointerEvents:'auto',display:'flex',alignItems:'center',gap:10}}>
          {heroMode ? (
            <div ref={joyRef} className="joystick" onPointerDown={onJoyStart} onPointerMove={onJoyMove} onPointerUp={onJoyEnd} onPointerLeave={onJoyEnd} onTouchStart={onJoyStart as any} onTouchMove={onJoyMove as any} onTouchEnd={onJoyEnd}>
              <div className="joystick-knob" style={{transform:`translate(${joy.dx*32}px, ${joy.dy*32}px)`}} />
              <div style={{position:'absolute',left:'50%',top:'50%',width:1,height:1,background:'transparent'}} />
            </div>
          ) : (
            <div className="glass-panel" style={{padding:10,borderRadius:16,display:'flex',gap:6,flexWrap:'wrap',maxWidth:380}}>
              {(Object.keys(BUILDING_STATS) as BuildingType[]).slice(0,6).map(bt=>(
                <button key={bt} onClick={()=>{ useGame.setState({placingBuilding: placingBuilding===bt? null : bt as any}); audio.ui()}} style={{padding:'7px 10px',borderRadius:10,border:`1px solid ${placingBuilding===bt?'var(--gold)':'rgba(255,255,255,.12)'}`,background:placingBuilding===bt?'rgba(231,196,106,.14)':'rgba(255,255,255,.06)',color:'#E8EADF',fontSize:11,letterSpacing:'.06em'}}>{bt}</button>
              ))}
              <div style={{width:'100%',height:1,background:'rgba(231,196,106,.18)',margin:'4px 0'}} />
              {(engine.buildings.find(b=>b.team==='player'&&b.type==='barracks')? (BUILDING_PRODUCES['barracks'] as UnitType[]):[]).slice(0,4).map(ut=>(
                <button key={ut} onClick={()=>{ const b=engine.buildings.find(x=>x.team==='player'&&x.type==='barracks'); if(b){ engine.tryTrain(b.id, ut); audio.build() } }} style={{padding:'6px 9px',borderRadius:10,border:'1px solid rgba(255,255,255,.14)',background:'rgba(16,22,36,.7)',color:'#E8EADF',fontSize:11}}>{ut}</button>
              ))}
            </div>
          )}
        </div>

        {/* skill bar — center luxe */}
        <div className="glass-panel" style={{display:'flex',gap:10,padding:'10px 12px',borderRadius:18,pointerEvents:'auto',alignItems:'center'}}>
          {[
            {k:'slash' as const, label:'SLASH', icon:'⚔', cd:4},
            {k:'kaboom' as const, label:'KABOOM', icon:'💥', cd:10},
            {k:'rally' as const, label:'RALLY', icon:'✦', cd:14},
          ].map(s=>(
            <button key={s.k} className="skill-btn" onClick={()=>doSkill(s.k,s.cd)} style={{pointerEvents: skillCd[s.k]>0? 'none':'auto', opacity: skillCd[s.k]>0? .62:1}}>
              <span style={{fontSize:20}}>{s.icon}</span><b>{s.label}</b>
              {skillCd[s.k]>0 && <div className="skill-cool">{skillCd[s.k].toFixed(1)}s</div>}
            </button>
          ))}
          <div style={{width:1,height:42,background:'rgba(231,196,106,.18)',margin:'0 2px'}} />
          <button className="gold-btn" onClick={()=>{ engine.selectedIds.clear(); engine.units.forEach(u=>u.selected=false); const h=engine.units.find(u=>(u as any).isHero); if(h){ engine.selectedIds.add(h.id); (h as any).selected=true } }} style={{padding:'10px 14px',borderRadius:12}}>HERO</button>
          <button className="gold-btn" onClick={()=>engine.issueRetreat()} style={{padding:'10px 12px',borderRadius:12}}>RETREAT</button>
        </div>

        <div style={{pointerEvents:'auto',display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}}>
          <div className="glass-panel" style={{padding:'8px 10px',borderRadius:12,fontSize:11,color:'var(--muted)',lineHeight:1.4,textAlign:'right'}}>
            {heroMode? 'Tap skills · Drag joystick · Pinch zoom':'Drag select · Right-click move/attack · Q/E rotate · Wheel zoom'}
            <div style={{color:'var(--gold)',letterSpacing:'.1em',marginTop:4}}>{heroMode? 'CLICK CANVAS → LOCK MOUSE · ESC UNLOCK': 'F formation · Double-click same type'}</div>
          </div>
          <div style={{display:'flex',gap:6}}>
            <button className="gold-btn" onPointerDown={()=>{ const c=document.querySelector('canvas'); c&& (c as HTMLCanvasElement).requestPointerLock?.(); setLockHint(true); setTimeout(()=>setLockHint(false),1400) }} style={{padding:'7px 10px',borderRadius:10,display: heroMode?undefined:'none'}}>LOCK MOUSE</button>
          </div>
          {lockHint && <div className="glass-panel" style={{padding:'6px 10px',borderRadius:10,fontSize:11,color:'#FFE9A8'}}>Move mouse to look · WASD move · Skills = slash/kaboom</div>}
        </div>
      </div>

      {/* tech overlay luxe */}
      {showTech && (
        <div onClick={()=>useGame.setState({showTech:false})} style={{position:'absolute',inset:0,background:'rgba(0,0,0,.52)',display:'grid',placeItems:'center',pointerEvents:'auto'}}>
          <div onClick={e=>e.stopPropagation()} className="glass-panel" style={{padding:18, borderRadius:18, minWidth:720, maxWidth:'92vw', maxHeight:'78vh', overflow:'auto'}}>
            <div style={{fontFamily:'Cinzel',letterSpacing:'.12em',color:'var(--gold)'}}>Research</div>
            <div className="luxe-divider" style={{margin:'10px 0'}} />
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              {engine.techs.map(t=>(
                <div key={t.id} style={{padding:10, borderRadius:12, border:`1px solid ${t.done?'rgba(46,184,114,.5)': t.researching?'rgba(90,170,255,.5)' : 'rgba(255,255,255,.12)'}`, background:'rgba(16,22,36,.7)'}}>
                  <div style={{fontWeight:700, fontSize:12, color:'#E8EADF'}}>{t.name}</div>
                  <div style={{fontSize:11, opacity:.8, margin:'4px 0'}}>{t.desc} · {t.branch}</div>
                  {t.researching && <div style={{height:4, background:'#0A0A0A', borderRadius:9, overflow:'hidden'}}><div style={{width:`${t.progress*100}%`, height:'100%', background:'#4AC0FF'}}/></div>}
                  {!t.done && !t.researching && <button className="gold-btn" onClick={()=>{engine.research(t.id); audio.ui()}} disabled={!!t.prereq && !engine.hasTech(t.prereq)} style={{marginTop:8, padding:'6px 10px', borderRadius:10, opacity: (!!t.prereq && !engine.hasTech(t.prereq))? .45:1}}>Research</button>}
                  {t.done && <span style={{color:'#2EB872', fontSize:11}}>✓ Done</span>}
                </div>
              ))}
            </div>
            <button className="gold-btn" onClick={()=>useGame.setState({showTech:false})} style={{marginTop:12, padding:'8px 12px', borderRadius:10}}>Close</button>
          </div>
        </div>
      )}

      {/* victory/defeat luxe */}
      {(engine.victory||engine.defeat) && (
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.62)',display:'grid',placeItems:'center',pointerEvents:'auto'}}>
          <div className="glass-panel" style={{padding:24, borderRadius:18, minWidth:360, textAlign:'center'}}>
            <div style={{fontFamily:'Cinzel', letterSpacing:'.14em', fontSize:22, color: engine.victory?'#FFE9A8':'#FF8A8A'}}>{engine.victory?'VICTORY':'DEFEAT'}</div>
            <div className="luxe-divider" style={{margin:'12px 0'}} />
            <div style={{display:'grid',gap:6, fontSize:13, color:'#E8EADF'}}><div>Kills {engine.stats.kills}</div><div>Losses {engine.stats.losses}</div><div>Buildings {engine.stats.buildingsDestroyed}/{engine.stats.buildingsLost}</div><div>Time {(engine.time/60|0)}m {(engine.time%60|0)}s</div></div>
            <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:16}}>
              <button className="gold-btn" onClick={()=>{ engine.paused=false; engine.victory=false; engine.defeat=false; useGame.setState({phase:'menu'})}} style={{padding:'10px 16px',borderRadius:12}}>Menu</button>
              <button className="gold-btn primary" onClick={()=>{ engine.victory=false; engine.defeat=false; engine.paused=false; if(engine.mission) engine.startMission({...engine.mission, objectives: engine.mission.objectives.map(o=>({...o}))}); audio.ui()}} style={{padding:'10px 16px',borderRadius:12}}>Restart</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
