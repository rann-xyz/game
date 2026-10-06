// ── Audio (WebAudio procedural) ──
export class AudioSys {
  ctx: AudioContext | null=null
  master=0.6; musicVol=0.4; sfxVol=0.7
  enabled=true
  init(){
    try{ this.ctx=new (window.AudioContext|| (window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext)()}catch{ this.enabled=false }
  }
  tone(freq:number,dur:number,vol:number,type:OscillatorType='sine', slideTo?:number){
    if(!this.ctx||!this.enabled) return
    if(this.ctx.state==='suspended') this.ctx.resume()
    const o=this.ctx.createOscillator(), g=this.ctx.createGain()
    o.type=type; o.frequency.value=freq
    if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime+dur)
    g.gain.value=vol*this.sfxVol*this.master
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime+dur)
    o.connect(g).connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime+dur)
  }
  noise(dur:number,vol:number,filterFreq:number){
    if(!this.ctx||!this.enabled) return
    if(this.ctx.state==='suspended') this.ctx.resume()
    const len=this.ctx.sampleRate*dur|0, buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate)
    const d=buf.getChannelData(0); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.5)
    const src=this.ctx.createBufferSource(); src.buffer=buf
    const f=this.ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=filterFreq; f.Q.value=1.2
    const g=this.ctx.createGain(); g.gain.value=vol*this.sfxVol*this.master
    g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+dur)
    src.connect(f).connect(g).connect(this.ctx.destination); src.start()
  }
  select(){ this.tone(880,0.12,0.25,'sine',1200) }
  move(){ this.tone(520,0.18,0.22,'triangle',680) }
  attack(){ this.tone(180,0.22,0.3,'square',90); setTimeout(()=>this.tone(260,0.14,0.2,'square'),90) }
  hit(){ this.noise(0.18,0.35,900) }
  arrow(){ this.tone(1400,0.08,0.18,'sine',700); this.noise(0.06,0.12,3000)}
  explosion(){ this.noise(0.7,0.5,180); setTimeout(()=>this.tone(55,0.5,0.4,'sine',22),30)}
  build(){ this.tone(320,0.3,0.2,'triangle',480)}
  coin(){ this.tone(1200,0.1,0.2,'sine',1600)}
  victory(){ [523,659,784,1046].forEach((f,i)=> setTimeout(()=>this.tone(f,0.45,0.22,'sine'), i*140))}
  defeat(){ [440,349,277,220].forEach((f,i)=> setTimeout(()=>this.tone(f,0.5,0.18,'triangle'), i*180))}
  ui(){ this.tone(900,0.07,0.15,'sine')}
}
export const audio=new AudioSys()
