// FX — slash ribbons, kaboom shells, hit sparks. All pooled.
import * as THREE from 'three'

export class FX {
  group: THREE.Group
  poolSlash: THREE.Group[]=[]
  poolKaboom: THREE.Group[]=[]

  constructor(scene: THREE.Scene){
    this.group=new THREE.Group(); scene.add(this.group)
  }
  slash(pos: THREE.Vector3, dir: THREE.Vector3, color=0xff5a3a){
    // thin ribbon + glow
    const g=new THREE.Group(); g.position.copy(pos)
    const geo=new THREE.PlaneGeometry(1.4, 0.22)
    const mat=new THREE.MeshBasicMaterial({color, transparent:true, opacity:.95, side:THREE.DoubleSide})
    const ribbon=new THREE.Mesh(geo, mat); ribbon.rotation.z=Math.atan2(dir.z,dir.x); ribbon.rotation.x=Math.PI/2
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(2.2,0.65), new THREE.MeshBasicMaterial({color:0xffb86a, transparent:true, opacity:.35, side:THREE.DoubleSide}))
    glow.rotation.copy(ribbon.rotation)
    g.add(ribbon, glow); this.group.add(g)
    const t0=performance.now()
    const anim=()=>{
      const t=(performance.now()-t0)/180
      if(t>=1){ this.group.remove(g); ribbon.geometry.dispose(); glow.geometry.dispose(); return }
      mat.opacity=.95*(1-t); (glow.material as THREE.MeshBasicMaterial).opacity=.35*(1-t)
      g.scale.setScalar(1+t*.35); g.position.y += 0.02
      requestAnimationFrame(anim)
    }
    requestAnimationFrame(anim)
  }
  kaboom(pos: THREE.Vector3, radius=2.2){
    const g=new THREE.Group(); g.position.copy(pos); this.group.add(g)
    const core=new THREE.Mesh(new THREE.SphereGeometry(radius*0.55,12,10), new THREE.MeshBasicMaterial({color:0xffae42, transparent:true, opacity:.95}))
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius*0.7, radius, 24), new THREE.MeshBasicMaterial({color:0xff5a3a, transparent:true, opacity:.9, side:THREE.DoubleSide}))
    ring.rotation.x=-Math.PI/2; ring.position.y=.05
    const flash=new THREE.PointLight(0xff7722, 6, 12); flash.position.y=.6
    g.add(core, ring, flash)
    const t0=performance.now()
    const anim=()=>{
      const t=(performance.now()-t0)/360
      if(t>=1){ this.group.remove(g); core.geometry.dispose(); (ring.geometry as THREE.BufferGeometry).dispose(); return }
      core.scale.setScalar(1+t*1.2); (core.material as THREE.MeshBasicMaterial).opacity=.95*(1-t)
      ring.scale.setScalar(1+t*.8); (ring.material as THREE.MeshBasicMaterial).opacity=.9*(1-t)
      flash.intensity=6*(1-t)
      requestAnimationFrame(anim)
    }
    requestAnimationFrame(anim)
    // screen shake hook via event
    document.dispatchEvent(new CustomEvent('kaboom', {detail:{pos}}))
  }
  hitRing(pos: THREE.Vector3, color=0xffcc66){
    const ring=new THREE.Mesh(new THREE.RingGeometry(.18,.28,16), new THREE.MeshBasicMaterial({color, transparent:true, opacity:.9, side:THREE.DoubleSide}))
    ring.rotation.x=-Math.PI/2; ring.position.copy(pos); ring.position.y+=.08; this.group.add(ring)
    const t0=performance.now()
    const anim=()=>{
      const t=(performance.now()-t0)/220
      if(t>=1){ this.group.remove(ring); ring.geometry.dispose(); return }
      ring.scale.setScalar(1+t*2.2); (ring.material as THREE.MeshBasicMaterial).opacity=.9*(1-t)
      requestAnimationFrame(anim)
    }
    requestAnimationFrame(anim)
  }
  damageNumber(pos: THREE.Vector3, dmg: number){
    const canvas=document.createElement('canvas'); canvas.width=128; canvas.height=64
    const ctx=canvas.getContext('2d')!; ctx.font='bold 32px JetBrains Mono'; ctx.fillStyle=dmg>40?'#ff5530':'#ffd86a'; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.lineWidth=4
    ctx.strokeText(`-${dmg|0}`, 10, 38); ctx.fillText(`-${dmg|0}`, 10, 38)
    const tex=new THREE.CanvasTexture(canvas); tex.needsUpdate=true
    const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true}))
    spr.position.copy(pos); spr.position.y+=1.5; spr.scale.set(1.6,.8,1); this.group.add(spr)
    const t0=performance.now()
    const anim=()=>{
      const t=(performance.now()-t0)/700
      if(t>=1){ this.group.remove(spr); tex.dispose(); return }
      spr.position.y+=0.02; (spr.material as THREE.SpriteMaterial).opacity=1-t
      requestAnimationFrame(anim)
    }
    requestAnimationFrame(anim)
  }
}
