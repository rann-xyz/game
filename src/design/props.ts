import * as THREE from 'three'

// Registry of visual flavour used by ThreeWorld to auto-scatter
// No external assets — pure procedural luxury terrain dressing

export function makeStoneRing(r=2.2): THREE.Group{
  const g=new THREE.Group()
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2
    const s=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.5,0.28), new THREE.MeshStandardMaterial({color:0x7a6a5c,roughness:.9}))
    s.position.set(Math.cos(a)*r,0.22,Math.sin(a)*r); s.rotation.y=-a; s.castShadow=true; g.add(s)
  }
  return g
}
export function makeBrazier(): THREE.Group{
  const g=new THREE.Group()
  const bowl=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.18,0.18,8), new THREE.MeshStandardMaterial({color:0x2a1a0a,metalness:.4,roughness:.5}))
  bowl.position.y=0.55; g.add(bowl)
  const post=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.07,0.55,6), new THREE.MeshStandardMaterial({color:0x3a2a1a})); post.position.y=0.28; g.add(post)
  const flame=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,8), new THREE.MeshBasicMaterial({color:0xff7730})); flame.position.y=0.78; flame.name='flame'; g.add(flame)
  const light=new THREE.PointLight(0xff7722, 2, 6); light.position.y=0.85; g.add(light)
  g.userData.flame=flame; g.userData.light=light
  return g
}
export function makeBanner(team:'player'|'enemy'): THREE.Group{
  const g=new THREE.Group()
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,2.0,6), new THREE.MeshStandardMaterial({color:0x6a5a3a})); pole.position.y=1; g.add(pole)
  const cloth=new THREE.Mesh(new THREE.PlaneGeometry(0.72,1.05), new THREE.MeshStandardMaterial({color:team==='player'?0x2a6ae0:0xc03020,side:THREE.DoubleSide,roughness:.7})); cloth.position.set(0.38,1.05,0); cloth.name='cloth'; g.add(cloth)
  return g
}
export function makeGrassTuft(): THREE.Group{
  const g=new THREE.Group()
  const mat=new THREE.MeshStandardMaterial({color:0x4a8a2a, roughness:.9})
  for(let i=0;i<5;i++){
    const blade=new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.28+Math.random()*0.22), mat)
    blade.position.set((Math.random()-.5)*0.12, 0.14, (Math.random()-.5)*0.12)
    blade.rotation.y=Math.random()*Math.PI
    blade.rotation.x= (Math.random()-.5)*0.25
    g.add(blade)
  }
  return g
}
export function makeStoneScatter(): THREE.Mesh{
  const geo=new THREE.DodecahedronGeometry(0.18,0)
  geo.scale(1,0.6,1)
  const m=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color:0x6e6e6e, roughness:.95}))
  m.castShadow=true; m.receiveShadow=true; return m
}
